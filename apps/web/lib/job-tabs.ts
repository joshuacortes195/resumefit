// the tabs on a job's card, each one is part of the card's address
export const JOB_TABS = ["job", "resume", "cover-letter", "interviews", "notes"] as const;
export type JobTab = (typeof JOB_TABS)[number];

// today's date where the user is, as 2026-10-08, so "date applied" matches their calendar
export function localToday(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
