import type { Ask } from "./pipeline";
import type { Account, FieldReport, PageInfo, SubmitResult } from "./types";

// the applicant systems whose forms we know well enough to send
const SENDABLE = ["greenhouse", "lever", "ashby"];

// how long we wait for the page to say the application went through
export const CONFIRM_SECONDS = 20;

// why this form will not be sent for the person, or null when it can be.
// every reason is something they can read and act on
export function whyNotSend(page: PageInfo, fields: FieldReport[], account: Account): string | null {
  const mode = account.profile?.autoSend ?? "off";
  if (mode === "off") return "Sending is switched off in your application profile.";
  if (page.fillBlocked) return "This site does not allow tools to send applications.";
  if (!page.ats || !SENDABLE.includes(page.ats.id)) return "We only send on Greenhouse, Lever and Ashby forms.";
  if (page.multiPage) return "This form has several pages.";
  if (page.captcha) return "The form has a captcha, which only you can do.";
  if ((account.sendsLeft ?? 0) <= 0) return "You have reached the number of applications you let us send in a day.";
  const empty = fields.filter((field) => field.status === "missing").length;
  if (empty > 0) return `${empty} required ${empty === 1 ? "answer is" : "answers are"} still empty.`;
  // a resume box with nothing in it means the upload did not take
  if (fields.some((field) => field.key === "resume" && field.status !== "filled")) return "Your resume could not be attached.";
  const drafts = fields.filter((field) => field.status === "review").length;
  if (mode === "safe" && drafts > 0) return `${drafts} ${drafts === 1 ? "answer is a draft" : "answers are drafts"} you have not read.`;
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
