import { describe, expect, it } from "vitest";
import { followUpNote, summarize, type StatJob } from "./stats";

// a wednesday
const NOW = new Date(2026, 10, 11, 12);
const job = (status: StatJob["status"], dateApplied: string | null, extra: Partial<StatJob> = {}): StatJob => ({ id: `${status}-${dateApplied}-${extra.title ?? ""}`, title: "Engineer", company: "Acme", status, dateApplied, createdAt: new Date(2026, 9, 1), matchRate: null, resumeName: null, archived: false, ...extra });

describe("tracker numbers", () => {
  const jobs = [
    job("saved", null),
    job("applied", "2026-11-10", { matchRate: 80, resumeName: "Base" }),
    job("applied", "2026-10-20", { matchRate: 60, resumeName: "Base", title: "Old one" }),
    job("applied", "2026-10-28", { matchRate: 60, resumeName: "Base", title: "Exactly two weeks" }),
    job("applied", "2026-10-01", { archived: true, title: "Archived" }),
    job("interview", "2026-11-03", { matchRate: 82, resumeName: "Tailored" }),
    job("offer", "2026-10-15", { matchRate: 90, resumeName: "Tailored" }),
    job("rejected", "2026-10-22", { matchRate: 40, resumeName: "Base" }),
  ];
  const stats = summarize(jobs, NOW);

  it("counts what went out and what came back, leaving saved jobs out", () => {
    expect(stats).toMatchObject({ applied: 7, interviews: 1, offers: 1, rejected: 1, waiting: 4, responseRate: 29 });
  });

  it("puts each application in its week, mondays first", () => {
    expect(stats.weeks).toHaveLength(8);
    expect(stats.weeks.at(-1)).toEqual({ start: "2026-11-09", count: 1 });
    expect(stats.weeks.at(-2)).toEqual({ start: "2026-11-02", count: 1 });
    expect(stats.weeks.reduce((sum, week) => sum + week.count, 0)).toBe(7);
  });

  it("shows which scores and which resumes got the interviews", () => {
    expect(stats.byScore).toEqual([
      { label: "75% or more", applied: 3, interviews: 2, rate: 67 },
      { label: "50 to 74%", applied: 2, interviews: 0, rate: 0 },
      { label: "Under 50%", applied: 1, interviews: 0, rate: 0 },
      { label: "Not scanned", applied: 1, interviews: 0, rate: 0 },
    ]);
    expect(stats.byResume[0]).toEqual({ label: "Base", applied: 4, interviews: 0, rate: 0 });
    expect(stats.byResume[1]).toEqual({ label: "Tailored", applied: 2, interviews: 2, rate: 100 });
  });

  it("suggests a follow up after two weeks of silence, longest wait first, and never for an archived card", () => {
    expect(stats.followUps.map((entry) => [entry.title, entry.days])).toEqual([["Old one", 22], ["Exactly two weeks", 14]]);
    expect(followUpNote(stats.followUps[0]!, "Riley Chen")).toBe("Hello,\n\nI applied for the Old one role at Acme on October 20 and wanted to check in on where things stand. I am still very interested and happy to send anything else that would help.\n\nThank you for your time.\n\nRiley Chen");
  });

  it("counts days by the calendar, whatever the time of day", () => {
    const quiet = [job("applied", "2026-10-22")];
    expect(summarize(quiet, new Date(2026, 10, 11, 0, 5)).followUps[0]?.days).toBe(20);
    expect(summarize(quiet, new Date(2026, 10, 11, 23, 55)).followUps[0]?.days).toBe(20);
  });

  it("has nothing to say about an empty tracker", () => {
    expect(summarize([], NOW)).toMatchObject({ applied: 0, responseRate: null, byScore: [], byResume: [], followUps: [] });
  });
});
