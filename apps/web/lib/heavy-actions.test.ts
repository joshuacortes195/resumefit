import { describe, expect, it, vi } from "vitest";
import { getDb, schema } from "@/db";
import { RATE_LIMITS } from "@/lib/rate-limit";

// one plain member is signed in for every action here
const ME = "00000000-0000-4000-8000-0000000000aa";
vi.mock("@/lib/auth", () => ({
  authMode: () => "hosted",
  forgetLocalUser: () => undefined,
  getCurrentUser: async () => ({ id: ME, email: "heavy@example.com", name: "Heavy", isAdmin: false }),
}));

// the pages refresh after a change, which needs the framework, so it does nothing here
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));

const { compareResumes, setTargetTitle } = await import("@/app/actions/scans");
const { startBlankResume } = await import("@/app/actions/builder");
const { duplicateResumeAction } = await import("@/app/actions/resumes");
const { saveOptimizedResume } = await import("@/app/actions/writing");
const { createLinkedinReport, startPractice } = await import("@/app/actions/practice");
const { DAILY_RESUME_LIMIT, listResumes } = await import("@/lib/data/resumes");
const { createScan, MAX_COMPARE_CHARS, rankResumes } = await import("@/lib/data/scans");
const { saveResume } = await import("@/lib/data/resumes");

// the member, made once for the whole file
const ready = (async () => {
  await (await getDb()).insert(schema.users).values({ id: ME, email: "heavy@example.com" }).onConflictDoNothing();
})();

const RESUME = "Jordan Lee\njordan@example.com\n\nWork Experience\nFrontend Developer, Acme Corp\nJan 2023 - Present\n• Built the checkout in React and TypeScript\n";
const JD = "Frontend Engineer at Brightside Labs\nRequirements\n3+ years of experience with TypeScript and React\nBachelor's degree\n";

describe("work that scores a report again", () => {
  it("only lets a few resume comparisons through a minute", async () => {
    await ready;
    const resume = await saveResume(ME, { name: "Mine", text: RESUME });
    const scan = await createScan(ME, { resumeId: resume.id, resumeText: RESUME, layout: null, jdText: JD });
    const results = [];
    for (let round = 0; round < RATE_LIMITS.compare + 2; round++) results.push(await compareResumes(scan.id));
    expect(results.filter((result) => result.ok)).toHaveLength(RATE_LIMITS.compare);
    expect(results.at(-1)).toMatchObject({ ok: false, error: expect.stringContaining("comparisons") });
  });

  it("limits the changes that score a report again", async () => {
    await ready;
    const scan = await createScan(ME, { resumeId: null, resumeText: RESUME, layout: null, jdText: JD });
    const results = [];
    for (let round = 0; round < RATE_LIMITS.rescore + 2; round++) results.push(await setTargetTitle(scan.id, `Title ${round}`));
    expect(results.filter((result) => result.ok)).toHaveLength(RATE_LIMITS.rescore);
    expect(results.at(-1)).toMatchObject({ ok: false });
  });

  it("stops comparing once a very long posting and very long resumes have used up the reading budget", async () => {
    await ready;
    // sixty long resumes against the longest posting a scan takes used to be sixty full scans in one click
    const long = (seed: number) => `${RESUME}\n${Array.from({ length: 7000 }, (_, index) => ["react", "typescript", "python", "sql"][(index + seed) % 4]).join(" ")}`;
    for (let index = 0; index < 20; index++) await saveResume(ME, { name: `Long ${index}`, text: long(index).slice(0, 59_000) });
    const jdText = `${JD}\n${"typescript react ".repeat(3500)}`.slice(0, 60_000);
    const scan = await createScan(ME, { resumeId: null, resumeText: RESUME, layout: null, jdText });
    const ranked = await rankResumes(ME, scan);
    // the newest few are still compared, never more than the budget lets the posting be read
    expect(ranked.length).toBeGreaterThan(0);
    expect(ranked.length).toBeLessThanOrEqual(Math.floor(MAX_COMPARE_CHARS / jdText.length));
    expect(ranked.length).toBeLessThan(20);
  });
});

describe("things that add rows", () => {
  it("scores and saves only so many linkedin reports and practice sessions a minute", async () => {
    await ready;
    const posting = `${JD}\nWe build accessible interfaces with a small team.`;
    const reports = [];
    for (let round = 0; round < RATE_LIMITS.scan + 1; round++) reports.push(await createLinkedinReport({ profile: { headline: "Frontend developer", about: "", experience: "", skills: [] }, jobDescriptions: [posting] }));
    expect(reports.filter((result) => result.ok)).toHaveLength(RATE_LIMITS.scan);
    // the same minute's limit is used up, so a practice session has to wait too
    expect(await startPractice({ jdText: posting })).toMatchObject({ ok: false, error: expect.stringContaining("short time") });
  });

  it("holds every way of adding a resume to the same daily limit as an upload", async () => {
    await ready;
    const db = await getDb();
    const [some] = await listResumes(ME);
    const scan = await createScan(ME, { resumeId: some?.id ?? null, resumeText: RESUME, layout: null, jdText: JD });
    // fill the rest of the day's allowance straight into the table
    const have = (await listResumes(ME)).length;
    await db.insert(schema.resumes).values(Array.from({ length: Math.max(0, DAILY_RESUME_LIMIT - have) }, (_, index) => ({ userId: ME, name: `Filler ${index}`, rawText: `filler ${index}` })));
    const before = (await listResumes(ME)).length;

    const limit = { ok: false, error: expect.stringContaining(`${DAILY_RESUME_LIMIT} resumes`) };
    expect(await startBlankResume()).toMatchObject(limit);
    expect(await duplicateResumeAction(some?.id ?? "")).toMatchObject(limit);
    expect(await saveOptimizedResume({ scanId: scan.id, text: `${RESUME}\nSkills\nTypeScript, React`, optimizationId: null, acceptedIds: [], afterScore: 80 })).toMatchObject(limit);
    expect((await listResumes(ME)).length).toBe(before);
  });
});
