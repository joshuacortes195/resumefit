// the tabs on a job's card, each one is part of the card's address
export const JOB_TABS = ["job", "resume", "cover-letter", "interviews", "notes"] as const;
export type JobTab = (typeof JOB_TABS)[number];

// when a job was added: "today" or "yesterday" by the calendar, then the real date, with the year once it is not this one
export function addedOn(createdAt: Date | string, now = new Date()): string {
  const added = new Date(createdAt);
  const midnight = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const days = Math.round((midnight(now) - midnight(added)) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return added.toLocaleDateString("en-US", added.getFullYear() === now.getFullYear() ? { month: "short", day: "numeric" } : { month: "short", day: "numeric", year: "numeric" });
}

// today's date where the user is, as 2026-10-08, so "date applied" matches their calendar
export function localToday(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
