import type { Ask } from "./pipeline";
import type { Account, FieldReport, PageInfo, SubmitResult } from "./types";

// the applicant systems whose forms we know well enough to send
const SENDABLE = ["greenhouse", "lever", "ashby"];

// how long we wait for the page to say the application went through
export const CONFIRM_SECONDS = 20;

// questions that are about the employer, like "why do you want to work here". a draft for one of these is never sent unread
const ABOUT_EMPLOYER = /\bwhy\b.{0,60}\b(us|here|join|our|this (company|role|position|team|job|opportunity)|work (at|for|with))\b|\bwhat (interests|excites|attracts|draws|appeals|motivates)\b|\b(our|this) (company|mission|products?|values|team|culture|role|position)\b|\babout (us|our)\b|\binterest(ed)? in (us|this|our|working|joining)\b/i;
// a question that names somewhere to work, like "at Acme" or "join Acme"
const NAMES_A_PLACE = /\b(at|join|joining)\s+[A-Z][A-Za-z0-9&.'-]+/;

// true for a written question whose answer depends on the employer, so only the person can really answer it
export function aboutCompany(label: string, company = ""): boolean {
  const name = company.trim().toLowerCase();
  if (name.length > 2 && label.toLowerCase().includes(name)) return true;
  // the first word of a question is always capitalised, so it is skipped when looking for a name
  // the short kind: "Why Acme?"
  if (/^\s*[Ww]hy\s+[A-Z][\w&.'-]*(\s+[A-Z][\w&.'-]*)?\s*\??\s*$/.test(label)) return true;
  return ABOUT_EMPLOYER.test(label) || NAMES_A_PLACE.test(label.replace(/^\s*\S+/, ""));
}

// one thing a form is waiting on the person for: a required answer we do not have, or a question about the employer
export type Waiting = { label: string; written: boolean; options?: string[] };

// what the person has to answer before this form can go. in the hands-off mode only an empty required answer counts
export function waitingOn(fields: FieldReport[], account: Account, company = ""): Waiting[] {
  const mode = account.profile?.autoSend ?? "off";
  return fields
    .filter((field) => field.kind !== "file" && field.label.trim().length > 1 && (field.status === "missing" || (mode !== "all" && field.status === "review" && field.key === "question" && aboutCompany(field.label, company))))
    .map((field) => ({ label: field.label.slice(0, 300), written: field.kind === "text" || field.kind === "textarea", ...(field.options?.length ? { options: field.options.slice(0, 40).map((option) => option.slice(0, 200)) } : {}) }))
    .slice(0, 40);
}

// why this form can never be sent for the person, whatever they answer: the kind of form it is, or a captcha. null when it could be.
// these are the ones they finish on the job site themselves
export function stuckOn(page: PageInfo, account: Account): string | null {
  if ((account.profile?.autoSend ?? "off") === "off") return "Sending is switched off in your application profile.";
  if (page.fillBlocked) return "This site does not allow tools to send applications.";
  if (!page.ats || !SENDABLE.includes(page.ats.id)) return "We only send on Greenhouse, Lever and Ashby forms.";
  if (page.multiPage) return "This form has several pages.";
  if (page.captcha) return "The form has a captcha, which only you can do.";
  return null;
}

// why this form will not be sent for the person, or null when it can be.
// every reason is something they can read and act on
export function whyNotSend(page: PageInfo, fields: FieldReport[], account: Account): string | null {
  const mode = account.profile?.autoSend ?? "off";
  const stuck = stuckOn(page, account);
  if (stuck) return stuck;
  if ((account.sendsLeft ?? 0) <= 0) return "You have reached the number of applications you let us send in a day.";
  const empty = fields.filter((field) => field.status === "missing").length;
  if (empty > 0) return `${empty} required ${empty === 1 ? "answer is" : "answers are"} still empty.`;
  // a resume box with nothing in it means the upload did not take
  if (fields.some((field) => field.key === "resume" && field.status !== "filled")) return "Your resume could not be attached.";
  // a drafted answer to a question about the employer is the one thing left for the person
  const theirs = fields.filter((field) => field.status === "review" && field.key === "question" && aboutCompany(field.label, page.job?.company)).length;
  if (mode === "safe" && theirs > 0) return `${theirs} ${theirs === 1 ? "question is" : "questions are"} about this company, and that answer should be yours.`;
  return null;
}

export type SendResult = { sent: boolean; reason?: string };

// presses Submit and waits for the page to say thanks. it presses once and never again, whatever happens next
export async function sendApplication(ask: Ask, pause: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)), seconds = CONFIRM_SECONDS): Promise<SendResult> {
  const result = await ask<SubmitResult>({ type: "submit" });
  if (!result.pressed) return { sent: false, reason: result.reason };
  for (let second = 0; second < seconds; second++) {
    await pause(1000);
    // the page may be moving to its thank you page, so a look that fails is just tried again
    const page = await ask<PageInfo>({ type: "read-page" }).catch(() => null);
    if (page?.confirmed) return { sent: true };
  }
  return { sent: false, reason: "We pressed Submit, but the page never said the application went through. Have a look at it." };
}
