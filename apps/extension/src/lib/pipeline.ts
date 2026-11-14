import { api } from "./api";
import type { Account, FieldReport, FileData, PageRequest } from "./types";
import { profileValues } from "./values";

// sends one request to the page being filled
export type Ask = <T>(request: PageRequest) => Promise<T>;

// the calls a fill needs from the web app, swapped out in tests
export type FillSource = Pick<typeof api, "resumeFile" | "coverLetterFile" | "answer"> & Partial<Pick<typeof api, "savedAnswer">>;

// how many written answers one fill will draft, so a long form does not eat the day's allowance
export const MAX_DRAFTS = 6;
// how many empty required answers one fill will look up in what the person answered before
export const MAX_LOOKUPS = 12;

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

export type FillOptions = {
  resumeId: string | null;
  jobId: string | null;
  jdText: string;
  // attach the cover letter saved on the job's tracker card, when the form has a place for one
  coverLetter?: boolean;
  // only fill what is new, for the next step of a long form
  onlyNew?: boolean;
};

// what one fill did: every field with how it went, and which files went along
export type FillResult = { fields: FieldReport[]; resume: FileData | null; coverLetter: FileData | null };

// fills the form that is showing in one go: profile details, the resume, the cover letter, then the written questions.
// it only ever asks the page to fill and set fields. nothing here can send the form
export async function fillEverything(ask: Ask, account: Account, options: FillOptions, source: FillSource = api): Promise<FillResult> {
  // a file that will not download just leaves its field for the person
  const resume = options.resumeId ? await source.resumeFile(options.resumeId).catch(() => null) : null;
  const coverLetter = options.coverLetter && options.jobId ? await source.coverLetterFile(options.jobId).catch(() => null) : null;
  const values = profileValues(account);
  let fields = await ask<FieldReport[]>({ type: "autofill", values, resume, coverLetter, onlyNew: options.onlyNew });
  const swap = (next: FieldReport | null) => {
    if (next) fields = fields.map((field) => (field.id === next.id ? next : field));
  };

  // written questions: the person's saved answer when one fits, otherwise a draft that is always marked for them to check
  for (const question of fields.filter((field) => worthDrafting(field) && field.status !== "review" && field.fresh !== false).slice(0, MAX_DRAFTS)) {
    try {
      const result = await source.answer({ question: question.label.slice(0, 500), jdText: options.jdText, resumeId: options.resumeId ?? undefined, jobId: options.jobId ?? undefined });
      swap(await ask<FieldReport | null>({ type: "set-field", id: question.id, value: result.answer, status: result.source === "saved" ? "filled" : "review" }));
    } catch {
      // no answer this time, the field stays red for the person
    }
  }
  // required answers the profile had nothing for: use what the person answered before, for this job or saved for all of them.
  // nothing is drafted here, a choice like "how did you hear about us" is never guessed
  const lookup = source.savedAnswer;
  if (lookup) {
    for (const empty of fields.filter((field) => field.status === "missing" && field.kind !== "file" && field.fresh !== false && field.label.trim().length > 1).slice(0, MAX_LOOKUPS)) {
      try {
        const { answer } = await lookup({ question: empty.label.slice(0, 500), jobId: options.jobId ?? undefined });
        if (answer) swap(await ask<FieldReport | null>({ type: "set-field", id: empty.id, value: answer, status: "filled", key: empty.key ?? undefined }));
      } catch {
        // still empty, and still the person's to answer
      }
    }
  }
  return { fields, resume, coverLetter };
}

// how many fields got an answer and how many still want the person's eyes
export function tally(fields: FieldReport[]): { filled: number; needs: number } {
  return {
    filled: fields.filter((field) => field.status === "filled" || field.status === "review").length,
    needs: fields.filter((field) => field.status === "missing" || field.status === "review").length,
  };
}
