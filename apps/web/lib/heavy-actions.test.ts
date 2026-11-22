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
