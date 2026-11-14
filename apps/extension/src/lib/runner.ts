import type { ApplicationReport } from "./api";
import { fillEverything, pickResume, tally, type Ask, type FillSource } from "./pipeline";
import { sendApplication, whyNotSend } from "./send";
import type { Account, FieldReport, PageInfo } from "./types";

// one application to work through: the posting or the form, and the tracker card and resume it is for
export type RunJob = { url: string; jobId: string | null; resumeId: string | null };

// the outside world a run needs, swapped out in tests
export type RunHooks = {
  ask: Ask;
  // sends the tab to another address and waits for it to load
  goTo: (url: string) => Promise<void>;
  report: (report: ApplicationReport) => Promise<unknown>;
  today: string;
  source?: FillSource;
  pause?: (ms: number) => Promise<void>;
};

// how a run ended. reason is why it was left for the person, null when it was sent
export type RunOutcome = { sent: boolean; reason: string | null; filled: number; needs: number };

// the answers as the web app keeps them, so the person can look back at what went out
const answersOf = (fields: FieldReport[]) =>
  fields
    .filter((field) => field.kind !== "file" && field.value)
    .map(({ label, value, status }) => ({ label: label.slice(0, 300), value: value.slice(0, 3000), status }))
    .slice(0, 120);

// works through one application without anyone watching: finds the form, fills it, and sends it when the person's own rules allow.
// anything it is not sure about is left filled in, with the reason, for the person to finish
export async function runApplication(account: Account, job: RunJob, hooks: RunHooks): Promise<RunOutcome> {
  let page = await hooks.ask<PageInfo>({ type: "read-page" });
  // a posting, not the form: follow its own Apply link
  if (!page.hasForm && !page.fillBlocked) {
    const link = await hooks.ask<string | null>({ type: "find-apply" });
    if (link) {
      await hooks.goTo(link);
      page = await hooks.ask<PageInfo>({ type: "read-page" });
    }
  }
  if (page.fillBlocked) return { sent: false, reason: "This site does not allow tools to fill in applications.", filled: 0, needs: 0 };
  if (!page.hasForm) return { sent: false, reason: "We could not find the application form on this page.", filled: 0, needs: 0 };

  const resumeId = pickResume(account, job.jobId, job.resumeId);
  const base = { jobId: job.jobId, ats: page.ats?.name ?? null, applyUrl: page.url, resumeId, today: hooks.today };
  const result = await fillEverything(hooks.ask, account, { resumeId, jobId: job.jobId, jdText: page.job?.description ?? "", coverLetter: true }, hooks.source);
  const { filled, needs } = tally(result.fields);
  const coverLetter = result.coverLetter !== null && result.fields.some((field) => field.key === "coverLetter" && field.status === "filled");
  const filledIn = { ...base, fieldsFilled: filled, fieldsNeedingAttention: needs, answers: answersOf(result.fields), coverLetter };
  await hooks.report({ ...filledIn, status: "needs_review" }).catch(() => undefined);

  // the form may have changed while it was filled, a captcha can show up late
  const now = await hooks.ask<PageInfo>({ type: "read-page" }).catch(() => page);
  const held = whyNotSend({ ...page, captcha: now.captcha }, result.fields, account);
  if (held) return { sent: false, reason: held, filled, needs };

  const send = await sendApplication(hooks.ask, hooks.pause);
  if (!send.sent) return { sent: false, reason: send.reason ?? "The form was not sent.", filled, needs };
  await hooks.report({ ...filledIn, status: "applied", fieldsNeedingAttention: 0, sentBy: "auto" }).catch(() => undefined);
  return { sent: true, reason: null, filled, needs };
}
