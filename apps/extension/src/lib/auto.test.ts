// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { findApplyLink } from "./apply-link";
import { showBar } from "./bar";
import { fillEverything, MAX_DRAFTS, pickResume, tally, worthDrafting, type Ask } from "./pipeline";
import type { Account, FieldReport, PageRequest } from "./types";

// a field as the page reports it, with only the interesting bits spelled out
const field = (id: string, extra: Partial<FieldReport> = {}): FieldReport => ({ id, key: "question", label: "Why do you want to work here?", kind: "textarea", required: true, status: "missing", value: "", ...extra });

const ACCOUNT = {
  user: { email: "jordan.lee@example.com", name: "Jordan Lee" },
  profileReady: true,
  current: { title: null, company: null },
  resumes: [
    { id: "base", name: "Base", isBase: true, linkedJobId: null },
    { id: "tailored", name: "For Acme", isBase: false, linkedJobId: "job-1" },
    { id: "other", name: "Other", isBase: false, linkedJobId: null },
  ],
  profile: { fullName: "Jordan Lee", email: "jordan.lee@example.com", eeoGender: "", eeoRace: "", eeoVeteran: "", eeoDisability: "" },
} as unknown as Account;

describe("finding the way to the form", () => {
  it("follows a plain Apply link and ignores links that only mention applying", () => {
    document.body.innerHTML = `<a href="/about">How to apply for jobs here</a><a href="/jobs/77/apply"> Apply   now </a>`;
    expect(findApplyLink(document, "https://careers.example.com/jobs/77")).toBe("https://careers.example.com/jobs/77/apply");
  });

  it("goes to a greenhouse form that sits in a frame", () => {
    // read into a page of its own that never loads anything, so the test stays off the internet
    const page = new DOMParser().parseFromString(`<iframe src="https://boards.greenhouse.io/embed/job_app?for=acme&token=12"></iframe>`, "text/html");
    expect(findApplyLink(page, "https://acme.example.com/careers?gh_jid=12")).toBe("https://boards.greenhouse.io/embed/job_app?for=acme&token=12");
  });

  it("gives up on anchors, insecure pages and pages with no button", () => {
    document.body.innerHTML = `<a href="#apply">Apply</a><a href="http://old.example.com/apply">Apply now</a><a href="mailto:jobs@example.com">Apply</a>`;
    expect(findApplyLink(document, "https://careers.example.com/jobs/77")).toBeNull();
  });
});

describe("filling a whole form in one go", () => {
  it("drafts only the questions that need an answer", () => {
    expect(worthDrafting(field("a"))).toBe(true);
    // optional, and not really a question
    expect(worthDrafting(field("b", { required: false, label: "Additional information" }))).toBe(false);
    // already has something in it
    expect(worthDrafting(field("c", { value: "Because." }))).toBe(false);
    expect(worthDrafting(field("d", { key: "email", kind: "text" }))).toBe(false);
  });

  it("uses saved answers as they are and marks fresh drafts for review", async () => {
    const page = [field("rf-0", { key: "email", kind: "text", label: "Email", status: "filled", value: "jordan.lee@example.com" }), field("rf-1"), field("rf-2", { label: "Describe a hard week." }), field("rf-3", { required: false, label: "Anything else" })];
    const asked: PageRequest[] = [];
    const ask = (async (request: PageRequest) => {
      asked.push(request);
      if (request.type === "autofill") return page;
      if (request.type === "set-field") return { ...page.find((entry) => entry.id === request.id), value: request.value, status: request.status };
      return null;
    }) as Ask;
    const questions: string[] = [];
    const source = {
      resumeFile: async () => ({ name: "resume.pdf", type: "application/pdf", base64: "" }),
      answer: async ({ question, jobId }: { question: string; jobId?: string }) => {
        questions.push(`${question} (${jobId})`);
        return question.startsWith("Why") ? { answer: "I like the work.", source: "saved" as const } : { answer: "A draft.", source: "ai" as const };
      },
    };
    const result = await fillEverything(ask, ACCOUNT, { resumeId: "base", jobId: "job-1", jdText: "" }, source);
    expect(questions).toEqual(["Why do you want to work here? (job-1)", "Describe a hard week. (job-1)"]);
    expect(result.map((entry) => entry.status)).toEqual(["filled", "filled", "review", "missing"]);
    expect(tally(result)).toEqual({ filled: 3, needs: 2 });
    // it only ever fills and sets fields
    expect(new Set(asked.map((request) => request.type))).toEqual(new Set(["autofill", "set-field"]));
  });

  it("keeps going when an answer cannot be drafted, and stops after a handful", async () => {
    const page = Array.from({ length: MAX_DRAFTS + 3 }, (_, index) => field(`rf-${index}`));
    let calls = 0;
    const ask = (async (request: PageRequest) => (request.type === "autofill" ? page : null)) as Ask;
    const source = {
      resumeFile: async () => {
        throw new Error("gone");
      },
      answer: async () => {
        calls++;
        throw new Error("busy");
      },
    };
    const result = await fillEverything(ask, ACCOUNT, { resumeId: "base", jobId: null, jdText: "" }, source);
    expect(calls).toBe(MAX_DRAFTS);
    expect(result.every((entry) => entry.status === "missing")).toBe(true);
  });

  it("attaches the resume made for the job, then the one asked for, then the base one", () => {
    expect(pickResume(ACCOUNT, "job-1", "other")).toBe("tailored");
    expect(pickResume(ACCOUNT, "job-2", "other")).toBe("other");
    expect(pickResume(ACCOUNT, null, null)).toBe("base");
  });
});

describe("the bar on the page", () => {
  const read = () => document.getElementById("resumefit-bar")?.shadowRoot;

  it("says what was filled and what needs the person, and never offers to submit", () => {
    let next = 0;
    let refill = 0;
    showBar(document, { state: "done", filled: 12, needs: 2, captcha: true, multiPage: false }, { onNext: () => next++, onRefill: () => refill++ });
    const root = read();
    expect(root?.querySelector(".title")?.textContent).toBe("Filled 12 fields, 2 need you");
    expect(root?.querySelector(".note")?.textContent).toContain("press the site's own Submit button");
    expect(root?.querySelector(".note")?.textContent).toContain("captcha is yours");
    const buttons = [...(root?.querySelectorAll("button") ?? [])];
    expect(buttons.map((button) => button.textContent)).toEqual(["Show next", "Fill again", "×"]);
    buttons[0]?.click();
    buttons[1]?.click();
    expect([next, refill]).toEqual([1, 1]);
    // closing takes it off the page
    buttons[2]?.click();
    expect(document.getElementById("resumefit-bar")).toBeNull();
  });

  it("replaces itself when the state changes", () => {
    showBar(document, { state: "working" }, { onNext: () => undefined, onRefill: () => undefined });
    showBar(document, { state: "applied" }, { onNext: () => undefined, onRefill: () => undefined });
    expect(document.querySelectorAll("#resumefit-bar")).toHaveLength(1);
    expect(read()?.querySelector(".title")?.textContent).toBe("Application sent");
  });
});
