import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { getDb, schema } from "@/db";
import { GLOBAL_DAILY_CAP, globalCapReached, USER_DAILY_CAP } from "@/lib/ai/limits";
import { geminiCall, groqCall, MAX_OUTPUT_TOKENS, type ProviderRequest } from "@/lib/ai/providers";
import { AiLimitError, generateText, type ReadyProvider } from "@/lib/ai/router";

// stands in for the gemini library and remembers the settings each request was sent with
const geminiConfigs = vi.hoisted(() => [] as Record<string, unknown>[]);
vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = {
      generateContent: async ({ config }: { config: Record<string, unknown> }) => {
        geminiConfigs.push(config);
        return { text: "ok", usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1 } };
      },
    };
  },
}));

// a person to spend the allowance as
async function someone(): Promise<string> {
  const id = randomUUID();
  await (await getDb()).insert(schema.users).values({ id, email: `spend-${id}@example.com` });
  return id;
}

// a provider that answers every time and counts how often it was asked
function counting(): ReadyProvider & { requests: ProviderRequest[] } {
  const requests: ProviderRequest[] = [];
  return { name: "gemini", model: "m", fastModel: "m", requests, call: async (request) => (requests.push(request), { text: "ok", tokensIn: 1, tokensOut: 1 }) };
}

describe("the shared daily allowance", () => {
  it("stops a brand new account once everyone together has used the day's allowance", async () => {
    const db = await getDb();
    // lots of fresh accounts, each well under its own share, together use up the whole day
    const accounts = await Promise.all(Array.from({ length: Math.ceil(GLOBAL_DAILY_CAP / (USER_DAILY_CAP / 2)) }, () => someone()));
    const rows = Array.from({ length: GLOBAL_DAILY_CAP }, (_, index) => ({ userId: accounts[index % accounts.length] ?? "", feature: "bullets", provider: "gemini", model: "m" }));
    await db.insert(schema.aiUsage).values(rows);
    expect(await globalCapReached()).toBe(true);

    // the next new account is turned away before any provider is asked
    const provider = counting();
    const newcomer = await someone();
    await expect(generateText("cover-letter", { system: "s", prompt: "p" }, { userId: newcomer, providers: [provider] })).rejects.toThrow(AiLimitError);
    await expect(generateText("cover-letter", { system: "s", prompt: "p" }, { userId: newcomer, providers: [provider] })).rejects.toThrow("shared AI allowance");
    expect(provider.requests).toHaveLength(0);
  });
});

describe("how much a model may write back", () => {
  it("caps the reply length on gemini", async () => {
    await geminiCall("key")({ system: "s", prompt: "p", json: false, model: "m", signal: AbortSignal.timeout(5000) });
    expect(geminiConfigs.at(-1)?.maxOutputTokens).toBe(MAX_OUTPUT_TOKENS);
  });

  it("caps the reply length on groq, on the second try without strict json too", async () => {
    const bodies: { max_completion_tokens?: number; response_format?: unknown }[] = [];
    const real = globalThis.fetch;
    globalThis.fetch = (async (_url: unknown, init?: { body?: string }) => {
      const body = JSON.parse(init?.body ?? "{}") as { max_completion_tokens?: number; response_format?: unknown };
      bodies.push(body);
      if (body.response_format) return new Response('{"error":{"message":"Failed to generate JSON","code":"json_validate_failed"}}', { status: 400 });
      return new Response(JSON.stringify({ choices: [{ message: { content: "{}" } }] }), { status: 200 });
    }) as typeof fetch;
    try {
      await groqCall("key")({ system: "s", prompt: "p", json: true, model: "m", signal: AbortSignal.timeout(5000) });
    } finally {
      globalThis.fetch = real;
    }
    expect(bodies).toHaveLength(2);
    expect(bodies.every((body) => body.max_completion_tokens === MAX_OUTPUT_TOKENS)).toBe(true);
  });
});
