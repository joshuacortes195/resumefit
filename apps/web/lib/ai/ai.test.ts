import { describe, expect, it } from "vitest";
import { z } from "zod";
import { decrypt, encrypt } from "@/lib/ai/crypto";
import { jdHints } from "@/lib/ai/jd";
import { DAILY_CAPS, GLOBAL_DAILY_CAP, logUsage, remainingToday, USER_DAILY_CAP, userCapReached } from "@/lib/ai/limits";
import { jdExtractionSchema, type JdExtraction } from "@/lib/ai/prompts/jd-extraction";
import { tidy } from "@/lib/ai/prompts/style";
import { ProviderError, type ProviderRequest } from "@/lib/ai/providers";
import { redact } from "@/lib/ai/redact";
import { AiBusyError, AiLimitError, AiUnavailableError, generateJSON, generateText, type ReadyProvider } from "@/lib/ai/router";
import { getCurrentUser } from "@/lib/auth";
import { createScan } from "@/lib/data/scans";

const shape = z.object({ answer: z.string(), score: z.number() });

// a fake provider that plays back a list of replies and remembers what it was asked
function fake(name: ReadyProvider["name"], replies: (string | Error)[]): ReadyProvider & { requests: ProviderRequest[] } {
  const requests: ProviderRequest[] = [];
  return {
    name,
    model: `${name}-main`,
    fastModel: `${name}-fast`,
    requests,
    call: async (request) => {
      requests.push(request);
      const reply = replies[requests.length - 1] ?? replies.at(-1) ?? "";
      if (reply instanceof Error) throw reply;
      return { text: reply, tokensIn: 10, tokensOut: 5 };
    },
  };
}

describe("provider router", () => {
  it("uses the first provider when it answers", async () => {
    const user = await getCurrentUser();
    const gemini = fake("gemini", ['{"answer":"hi","score":1}']);
    const groq = fake("groq", ['{"answer":"no","score":2}']);
    const result = await generateJSON("bullets", { system: "s", prompt: "p" }, shape, { userId: user.id, providers: [gemini, groq] });
    expect(result).toEqual({ answer: "hi", score: 1 });
    expect(groq.requests).toHaveLength(0);
    // the shape we want is spelled out for the model
    expect(gemini.requests[0]?.system).toContain('"answer"');
    expect(gemini.requests[0]?.json).toBe(true);
  });

  it("moves on in order when a provider is rate limited, down or times out", async () => {
    const user = await getCurrentUser();
    const gemini = fake("gemini", [new ProviderError("rate limited", 429)]);
    const groq = fake("groq", [new ProviderError("server error", 503)]);
    const cloudflare = fake("cloudflare", ['{"answer":"third","score":3}']);
    const result = await generateJSON("bullets", { system: "s", prompt: "p" }, shape, { userId: user.id, providers: [gemini, groq, cloudflare] });
    expect(result.answer).toBe("third");
    expect([gemini.requests.length, groq.requests.length, cloudflare.requests.length]).toEqual([1, 1, 1]);
  });

  it("gives a bad reply one chance to be fixed, then moves on", async () => {
    const user = await getCurrentUser();
    // fixed on the second try, wrapped in a code fence for good measure
    const fixer = fake("gemini", ['{"answer": 5}', '```json\n{"answer":"fixed","score":2}\n```']);
    expect(await generateJSON("bullets", { system: "s", prompt: "p" }, shape, { userId: user.id, providers: [fixer] })).toEqual({ answer: "fixed", score: 2 });
    expect(fixer.requests[1]?.prompt).toContain("could not be used");

    // still wrong after the retry, so the next provider gets asked
    const stubborn = fake("gemini", ["not json", "still not json"]);
    const backup = fake("groq", ['{"answer":"backup","score":1}']);
    expect((await generateJSON("bullets", { system: "s", prompt: "p" }, shape, { userId: user.id, providers: [stubborn, backup] })).answer).toBe("backup");
    expect(stubborn.requests).toHaveLength(2);
  });

  it("says it is busy when every provider fails, and unavailable when there are none", async () => {
    const user = await getCurrentUser();
    const down = [fake("gemini", [new ProviderError("x", 429)]), fake("groq", [new ProviderError("x", 500)])];
    await expect(generateText("bullets", { system: "s", prompt: "p" }, { userId: user.id, providers: down })).rejects.toThrow(AiBusyError);
    await expect(generateText("bullets", { system: "s", prompt: "p" }, { userId: user.id, providers: [] })).rejects.toThrow(AiUnavailableError);
  });

  it("tries a provider's smaller model when the main one wants billing or is gone", async () => {
    const user = await getCurrentUser();
    // the main model asks for payment, the small one answers
    const gemini = fake("gemini", [new ProviderError("billing required", 402), "from the small model"]);
    const groq = fake("groq", ["from groq"]);
    expect(await generateText("bullets", { system: "s", prompt: "p" }, { userId: user.id, providers: [gemini, groq] })).toBe("from the small model");
    expect(gemini.requests.map((request) => request.model)).toEqual(["gemini-main", "gemini-fast"]);
    expect(groq.requests).toHaveLength(0);

    // a rate limit is about the whole provider, so the small model is not tried
    const limited = fake("gemini", [new ProviderError("slow down", 429), "never asked"]);
    expect(await generateText("bullets", { system: "s", prompt: "p" }, { userId: user.id, providers: [limited, groq] })).toBe("from groq");
    expect(limited.requests).toHaveLength(1);

    // both models gone, on to the next provider
    const gone = fake("gemini", [new ProviderError("no such model", 404), new ProviderError("no such model", 404)]);
    expect(await generateText("bullets", { system: "s", prompt: "p" }, { userId: user.id, providers: [gone, groq] })).toBe("from groq");
    expect(gone.requests).toHaveLength(2);
  });

  it("picks the fast model when asked", async () => {
    const user = await getCurrentUser();
    const gemini = fake("gemini", ["plain text"]);
    await generateText("bullets", { system: "s", prompt: "p" }, { userId: user.id, providers: [gemini], fast: true });
    expect(gemini.requests[0]?.model).toBe("gemini-fast");
  });
});

describe("daily limits", () => {
  it("counts each call and stops at the cap", async () => {
    const user = await getCurrentUser();
    const cap = DAILY_CAPS.linkedin ?? 0;
    const before = (await remainingToday(user.id, "linkedin")) ?? 0;
    const gemini = fake("gemini", ["ok"]);
    await generateText("linkedin", { system: "s", prompt: "p" }, { userId: user.id, providers: [gemini] });
    expect(await remainingToday(user.id, "linkedin")).toBe(before - 1);

    // use up the rest, then the next call is turned away before any provider is asked
    for (let used = cap - before + 1; used < cap; used++) await logUsage({ userId: user.id, feature: "linkedin", provider: "gemini", model: "m", tokensIn: 0, tokensOut: 0 });
    expect(await remainingToday(user.id, "linkedin")).toBe(0);
    const asked = gemini.requests.length;
    await expect(generateText("linkedin", { system: "s", prompt: "p" }, { userId: user.id, providers: [gemini] })).rejects.toThrow(AiLimitError);
    expect(gemini.requests).toHaveLength(asked);
  });

  it("stops one person at their share of the day, whatever they spend it on", async () => {
    const { randomUUID } = await import("node:crypto");
    const { getDb, schema } = await import("@/db");
    const db = await getDb();
    const [heavy, other] = [randomUUID(), randomUUID()];
    await db.insert(schema.users).values([
      { id: heavy, email: `heavy-${heavy}@example.com` },
      { id: other, email: `other-${other}@example.com` },
    ]);
    // spread over features so no single feature's cap is reached, job description reads included
    const spread = ["jd-extraction", "bullets", "builder", "interview", "optimize"] as const;
    await db.insert(schema.aiUsage).values(Array.from({ length: USER_DAILY_CAP }, (_, index) => ({ userId: heavy, feature: index < 120 ? "jd-extraction" : (spread[index % spread.length] ?? "bullets"), provider: "gemini", model: "m" })));
    expect(await userCapReached(heavy)).toBe(true);

    const gemini = fake("gemini", ["ok", "ok"]);
    await expect(generateText("cover-letter", { system: "s", prompt: "p" }, { userId: heavy, providers: [gemini] })).rejects.toThrow("all of your AI actions for today");
    expect(gemini.requests).toHaveLength(0);
    // everyone else carries on, the shared allowance is nowhere near used
    expect(USER_DAILY_CAP * 8).toBeLessThanOrEqual(GLOBAL_DAILY_CAP);
    expect(await generateText("cover-letter", { system: "s", prompt: "p" }, { userId: other, providers: [gemini] })).toBe("ok");
  });

  it("turns away a burst of requests from one person", async () => {
    const { randomUUID } = await import("node:crypto");
    const { getDb, schema } = await import("@/db");
    const { RATE_LIMITS } = await import("@/lib/rate-limit");
    const id = randomUUID();
    await (await getDb()).insert(schema.users).values({ id, email: `burst-${id}@example.com` });
    const gemini = fake("gemini", Array.from({ length: 40 }, () => "ok"));
    const results = await Promise.allSettled(Array.from({ length: RATE_LIMITS.ai + 5 }, () => generateText("interview", { system: "s", prompt: "p" }, { userId: id, providers: [gemini] })));
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(RATE_LIMITS.ai);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(5);
  });

  it("never caps reading a job description", async () => {
    const user = await getCurrentUser();
    expect(await remainingToday(user.id, "jd-extraction")).toBeNull();
  });
});

describe("redaction", () => {
  const resume = `Jordan Lee
123 Main Street, Apt 4
Austin, TX | jordan.lee@example.com | (512) 555-0142
https://linkedin.com/in/jordanlee | github.com/jordanlee

Jordan Lee built 12 dashboards in 2023.`;

  it("hides every personal detail and puts each one back", () => {
    const redacted = redact(resume, { name: "Jordan Lee", location: "Austin, TX" });
    for (const secret of ["Jordan", "jordan.lee@example.com", "555-0142", "linkedin.com", "github.com/jordanlee", "Main Street", "Austin"]) {
      expect(redacted.text).not.toContain(secret);
    }
    // the work itself is untouched
    expect(redacted.text).toContain("built 12 dashboards in 2023");
    expect(redacted.restore(redacted.text)).toBe(resume);
  });

  it("uses the same placeholder for a repeated detail and restores text the model rewrote", () => {
    const redacted = redact(resume, { name: "Jordan Lee" });
    const name = redacted.text.split("\n")[0] ?? "";
    expect(redacted.text.split(name)).toHaveLength(3);
    expect(redacted.restore(`Dear team, ${name} here.`)).toBe("Dear team, Jordan Lee here.");
  });
});

describe("key encryption", () => {
  it("round trips and fails closed", () => {
    const secret = "a".repeat(40);
    const sealed = encrypt("my-api-key", secret);
    expect(sealed).not.toContain("my-api-key");
    expect(decrypt(sealed, secret)).toBe("my-api-key");
    expect(decrypt(sealed, "b".repeat(40))).toBeNull();
    expect(decrypt("garbage", secret)).toBeNull();
    // the same value never encrypts to the same text twice
    expect(encrypt("my-api-key", secret)).not.toBe(sealed);
  });
});

describe("style tidy up", () => {
  it("swaps long dashes for commas", () => {
    expect(tidy("Built the checkout flow — cutting drop off by 18%")).toBe("Built the checkout flow, cutting drop off by 18%");
  });
});

describe("job description hints", () => {
  const extraction: JdExtraction = {
    job_title: "Platform Engineer",
    company: "Northwind",
    seniority: "senior",
    years_required_min: 6,
    years_required_max: null,
    education_required: "Bachelor's",
    education_preferred: null,
    hard_skills: [{ name: "Backstage", importance: "required", count: 2 }],
    soft_skills: [],
    certifications: [],
    tools: ["ArgoCD"],
    responsibilities_summary: "Run the platform.",
    detected_ats_hint: null,
  };
  const jd = "Join our platform group.\nYou will run Backstage and ArgoCD for forty teams and keep Backstage plugins healthy.";

  it("checks the model's reply against the schema", () => {
    expect(jdExtractionSchema.safeParse(extraction).success).toBe(true);
    expect(jdExtractionSchema.safeParse({ ...extraction, hard_skills: [{ name: "x", importance: "maybe", count: 1 }] }).success).toBe(false);
  });

  it("reads a posting once, then answers from the saved copy for everyone", async () => {
    const user = await getCurrentUser();
    const gemini = fake("gemini", [JSON.stringify(extraction)]);
    const first = await jdHints(user.id, jd, { providers: [gemini] });
    expect(first?.hardSkills).toEqual(["Backstage", "ArgoCD"]);
    // same posting with different spacing, no second call
    const again = await jdHints(user.id, jd.replace(/\n/g, "  \n"), { providers: [gemini] });
    expect(again?.jobTitle).toBe("Platform Engineer");
    expect(gemini.requests).toHaveLength(1);

    // the scan picks the hinted skills and title up
    const scan = await createScan(user.id, { resumeId: null, resumeText: "Summary\nPlatform person who runs ArgoCD.\n".repeat(3), layout: null, jdText: jd, hints: first });
    expect(scan.jobTitle).toBe("Platform Engineer");
    expect(scan.report.hardSkills.map((skill) => [skill.name, skill.match])).toEqual([
      ["Backstage", "missing"],
      ["ArgoCD", "exact"],
    ]);
    expect(scan.report.jd.yearsRequired).toBe(6);
  });

  it("returns nothing, without failing, when no provider is set up or all are down", async () => {
    const user = await getCurrentUser();
    expect(await jdHints(user.id, "A posting nobody has read yet, about welding and fabrication.", { providers: [] })).toBeNull();
    expect(await jdHints(user.id, "Another unread posting, about nursing on a night shift.", { providers: [fake("gemini", [new ProviderError("x", 429)])] })).toBeNull();
  });
});
