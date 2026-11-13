import { describe, expect, it } from "vitest";
import { fillEverything, MAX_DRAFTS, pickResume, tally, worthDrafting, type Ask } from "./pipeline";
import type { Account, FieldReport, PageRequest } from "./types";

// a field as the page reports it, with only the interesting bits spelled out
const field = (id: string, extra: Partial<FieldReport> = {}): FieldReport => ({ id, key: "question", label: "Why do you want to work here?", kind: "textarea", required: true, status: "missing", value: "", ...extra });

const ACCOUNT = {
  user: { email: "jordan.lee@example.com", name: "Jordan Lee" },
  autoApply: true,
  profileReady: true,
  current: { title: null, company: null },
  resumes: [
    { id: "base", name: "Base", isBase: true, linkedJobId: null },
    { id: "tailored", name: "For Acme", isBase: false, linkedJobId: "job-1" },
    { id: "other", name: "Other", isBase: false, linkedJobId: null },
  ],
  profile: { fullName: "Jordan Lee", email: "jordan.lee@example.com", eeoGender: "", eeoRace: "", eeoVeteran: "", eeoDisability: "" },
} as unknown as Account;

const PDF = { name: "resume.pdf", type: "application/pdf", base64: "" };

describe("filling a whole form in one go", () => {
  it("drafts only the questions that need an answer", () => {
    expect(worthDrafting(field("a"))).toBe(true);
    // optional, and not really a question
    expect(worthDrafting(field("b", { required: false, label: "Additional information" }))).toBe(false);
    // already has something in it
    expect(worthDrafting(field("c", { value: "Because." }))).toBe(false);
    expect(worthDrafting(field("d", { key: "email", kind: "text" }))).toBe(false);
  });

  it("uses saved answers as they are and marks every fresh draft for the person to check", async () => {
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
      resumeFile: async () => PDF,
      coverLetterFile: async () => ({ ...PDF, name: "Cover-Letter.pdf" }),
      answer: async ({ question, jobId }: { question: string; jobId?: string }) => {
        questions.push(`${question} (${jobId})`);
        return question.startsWith("Why") ? { answer: "I like the work.", source: "saved" as const } : { answer: "A draft.", source: "ai" as const };
      },
    };
    const result = await fillEverything(ask, ACCOUNT, { resumeId: "base", jobId: "job-1", jdText: "", coverLetter: true }, source);
    expect(questions).toEqual(["Why do you want to work here? (job-1)", "Describe a hard week. (job-1)"]);
    expect(result.fields.map((entry) => entry.status)).toEqual(["filled", "filled", "review", "missing"]);
    expect(tally(result.fields)).toEqual({ filled: 3, needs: 2 });
    // both files went to the page with the profile answers
    expect(asked[0]).toMatchObject({ type: "autofill", resume: { name: "resume.pdf" }, coverLetter: { name: "Cover-Letter.pdf" } });
    // it only ever fills and sets fields, there is no request that could send the form
    expect(new Set(asked.map((request) => request.type))).toEqual(new Set(["autofill", "set-field"]));
  });

  it("keeps going when a file or an answer cannot be had, and stops drafting after a handful", async () => {
    const page = Array.from({ length: MAX_DRAFTS + 3 }, (_, index) => field(`rf-${index}`));
    let calls = 0;
    const sent: PageRequest[] = [];
    const ask = (async (request: PageRequest) => {
      sent.push(request);
      return request.type === "autofill" ? page : null;
    }) as Ask;
    const gone = async () => {
      throw new Error("gone");
    };
    const source = {
      resumeFile: gone,
      coverLetterFile: gone,
      answer: async () => {
        calls++;
        throw new Error("busy");
      },
    };
    const result = await fillEverything(ask, ACCOUNT, { resumeId: "base", jobId: null, jdText: "", coverLetter: true }, source);
    expect(calls).toBe(MAX_DRAFTS);
    expect(result.fields.every((entry) => entry.status === "missing")).toBe(true);
    // without a job there is no cover letter to fetch, and the missing resume is simply left for the person
    expect(sent[0]).toMatchObject({ resume: null, coverLetter: null });
  });

  it("leaves questions from an earlier step alone on the next one", async () => {
    const page = [field("rf-0", { fresh: false }), field("rf-1")];
    const asked: string[] = [];
    const ask = (async (request: PageRequest) => (request.type === "autofill" ? page : null)) as Ask;
    const source = { resumeFile: async () => PDF, coverLetterFile: async () => PDF, answer: async ({ question }: { question: string }) => (asked.push(question), { answer: "A draft.", source: "ai" as const }) };
    await fillEverything(ask, ACCOUNT, { resumeId: null, jobId: null, jdText: "", onlyNew: true }, source);
    expect(asked).toHaveLength(1);
  });

  it("attaches the resume made for the job, then the one asked for, then the base one", () => {
    expect(pickResume(ACCOUNT, "job-1", "other")).toBe("tailored");
    expect(pickResume(ACCOUNT, "job-2", "other")).toBe("other");
    expect(pickResume(ACCOUNT, null, null)).toBe("base");
  });
});
