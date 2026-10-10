import { api } from "./api";
import type { Account, FieldReport, PageRequest } from "./types";
import { profileValues } from "./values";

// sends one request to the page being filled
export type Ask = <T>(request: PageRequest) => Promise<T>;

// the two calls a fill needs from the web app, swapped out in tests
export type FillSource = Pick<typeof api, "resumeFile" | "answer">;

// how many written answers one fill will draft, so a long form does not eat the day's allowance
export const MAX_DRAFTS = 6;

// true for a written question worth answering without being asked: one that has to be answered, or really is a question
export function worthDrafting(field: FieldReport): boolean {
  return field.key === "question" && field.value.trim() === "" && field.label.trim().length >= 5 && (field.required || field.label.includes("?"));
}

// the resume to attach: the one made for this job, then the one asked for, then the base resume
export function pickResume(account: Account, jobId: string | null, wanted: string | null): string | null {
  const linked = jobId ? account.resumes.find((resume) => resume.linkedJobId === jobId) : undefined;
  const asked = account.resumes.find((resume) => resume.id === wanted);
  return (linked ?? asked ?? account.resumes.find((resume) => resume.isBase) ?? account.resumes[0])?.id ?? null;
}

// fills the whole form in one go: profile details, the resume, then the written questions. it never submits anything
export async function fillEverything(ask: Ask, account: Account, options: { resumeId: string | null; jobId: string | null; jdText: string; onlyNew?: boolean }, source: FillSource = api): Promise<FieldReport[]> {
  // a resume that will not download just leaves its field for the person
  const resume = options.resumeId ? await source.resumeFile(options.resumeId).catch(() => null) : null;
  let fields = await ask<FieldReport[]>({ type: "autofill", values: profileValues(account), resume, onlyNew: options.onlyNew });

  // written questions: a saved answer when one fits, otherwise a draft marked for review
  for (const question of fields.filter((field) => worthDrafting(field) && field.status !== "review").slice(0, MAX_DRAFTS)) {
    try {
      const result = await source.answer({ question: question.label.slice(0, 500), jdText: options.jdText, resumeId: options.resumeId ?? undefined, jobId: options.jobId ?? undefined });
      const next = await ask<FieldReport | null>({ type: "set-field", id: question.id, value: result.answer, status: result.source === "saved" ? "filled" : "review" });
      if (next) fields = fields.map((field) => (field.id === next.id ? next : field));
    } catch {
      // no answer this time, the field stays red for the person
    }
  }
  return fields;
}

// whether a filled form may be sent without the person: only when nothing at all is left for them.
// a captcha, a form spread over pages, a drafted answer or an empty required field each hand it back
export function canAutoSubmit(fields: FieldReport[], page: { captcha: boolean; multiPage: boolean }): boolean {
  const { filled, needs } = tally(fields);
  const resumeOk = fields.filter((field) => field.key === "resume").every((field) => field.status === "filled");
  const hasBasics = fields.some((field) => field.key === "email" && field.status === "filled");
  return !page.captcha && !page.multiPage && needs === 0 && filled >= 3 && resumeOk && hasBasics;
}

// how many fields got an answer and how many still want the person's eyes
export function tally(fields: FieldReport[]): { filled: number; needs: number } {
  return {
    filled: fields.filter((field) => field.status === "filled" || field.status === "review").length,
    needs: fields.filter((field) => field.status === "missing" || field.status === "review").length,
  };
}
