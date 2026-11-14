import type { JobStatus } from "@resumefit/shared";

// one job from the tracker, with only what the numbers need
export type StatJob = { id: string; title: string; company: string | null; status: JobStatus; dateApplied: string | null; createdAt: Date; matchRate: number | null; resumeName: string | null; archived: boolean };

// how one group of applications did: how many went out, and how many led to an interview or an offer
export type StatRow = { label: string; applied: number; interviews: number; rate: number | null };

// an application that has sat without an answer long enough to be worth a nudge
export type FollowUp = { id: string; title: string; company: string | null; dateApplied: string; days: number };

export type Stats = {
  applied: number;
  interviews: number;
  offers: number;
  rejected: number;
  // still waiting to hear back
  waiting: number;
  // share of sent applications that led to an interview or an offer, null with nothing sent
  responseRate: number | null;
  // applications sent in each of the last eight weeks, oldest first
  weeks: { start: string; count: number }[];
  byScore: StatRow[];
  byResume: StatRow[];
  followUps: FollowUp[];
};

// how many days without an answer before a follow up is suggested
export const FOLLOW_UP_DAYS = 14;

const SENT: JobStatus[] = ["applied", "interview", "offer", "rejected"];
const day = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

// a share as a whole percent, null when there is nothing to take a share of
const share = (part: number, whole: number) => (whole === 0 ? null : Math.round((100 * part) / whole));

// whole calendar days from a date to today, so the time of day never makes it a day short
function daysBetween(date: string, now: Date): number {
  const [year = 0, month = 1, dayOfMonth = 1] = date.split("-").map(Number);
  return Math.round((Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - Date.UTC(year, month - 1, dayOfMonth)) / 86_400_000);
}

// one row of a breakdown
function row(label: string, jobs: StatJob[]): StatRow {
  const interviews = jobs.filter((job) => job.status === "interview" || job.status === "offer").length;
  return { label, applied: jobs.length, interviews, rate: share(interviews, jobs.length) };
}

// turns the tracker into numbers: what went out, what came back, and which scores and resumes got the answers
export function summarize(jobs: StatJob[], now = new Date()): Stats {
  const sent = jobs.filter((job) => SENT.includes(job.status));
  const count = (status: JobStatus) => sent.filter((job) => job.status === status).length;
  // the day it was sent, or the day the card was made when no date was noted
  const sentOn = (job: StatJob) => (job.dateApplied ? new Date(`${job.dateApplied}T12:00:00`) : job.createdAt);

  // the last eight weeks, each starting on a monday
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
  const weeks = Array.from({ length: 8 }, (_, index) => {
    const start = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() - 7 * (7 - index));
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
    return { start: day(start), count: sent.filter((job) => sentOn(job) >= start && sentOn(job) < end).length };
  });

  const bands: [string, (rate: number | null) => boolean][] = [
    ["75% or more", (rate) => rate !== null && rate >= 75],
    ["50 to 74%", (rate) => rate !== null && rate >= 50 && rate < 75],
    ["Under 50%", (rate) => rate !== null && rate < 50],
    ["Not scanned", (rate) => rate === null],
  ];
  const resumes = [...new Set(sent.map((job) => job.resumeName ?? "No resume noted"))];

  const followUps = sent
    .filter((job) => job.status === "applied" && !job.archived && job.dateApplied)
    .map((job) => ({ id: job.id, title: job.title, company: job.company, dateApplied: job.dateApplied as string, days: daysBetween(job.dateApplied as string, now) }))
    .filter((job) => job.days >= FOLLOW_UP_DAYS)
    .sort((a, b) => b.days - a.days);

  return {
    applied: sent.length,
    interviews: count("interview"),
    offers: count("offer"),
    rejected: count("rejected"),
    waiting: count("applied"),
    responseRate: share(count("interview") + count("offer"), sent.length),
    weeks,
    byScore: bands.map(([label, fits]) => row(label, sent.filter((job) => fits(job.matchRate)))).filter((entry) => entry.applied > 0),
    byResume: resumes.map((name) => row(name, sent.filter((job) => (job.resumeName ?? "No resume noted") === name))).sort((a, b) => b.applied - a.applied),
    followUps,
  };
}

// a short, polite note asking where an application stands, ready to paste into an email
export function followUpNote(job: Pick<FollowUp, "title" | "company" | "dateApplied">, name: string | null): string {
  const sent = new Date(`${job.dateApplied}T12:00:00`).toLocaleDateString("en-US", { month: "long", day: "numeric" });
  return `Hello,\n\nI applied for the ${job.title} role${job.company ? ` at ${job.company}` : ""} on ${sent} and wanted to check in on where things stand. I am still very interested and happy to send anything else that would help.\n\nThank you for your time.\n\n${name ?? ""}`.trim();
}
