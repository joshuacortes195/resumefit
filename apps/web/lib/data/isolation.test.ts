import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { getDb, schema } from "@/db";
import { exportAccount } from "./account";
import { createBuilderResume } from "./builder";
import { extensionStatus, createExtensionToken, userForToken } from "./extension";
import { addInterview, createJob, findCard, getCoverLetter, getJob, jobCounts, listInterviews, listJobs, nextInterview, saveCoverLetter, updateJob, deleteJob } from "./jobs";
import { createPracticeSession, getLinkedinReport, getPracticeSession, listLinkedinReports, listPracticeSessions, saveLinkedinReport } from "./practice";
import { getResume, listManagedResumes, listResumes, saveResume, deleteResume } from "./resumes";
import { createScan, deleteScans, getScan, latestScan, listScans, updateScan } from "./scans";

// every piece of the other person's data carries this word, so one search finds a leak anywhere
const MARK = "ZZSECRET";

const RESUME = `Jordan Lee ${MARK}
Austin, TX | jordan.lee@example.com

Work Experience
Frontend Developer, Acme Corp
Jan 2023 - Present
• Rebuilt the checkout flow in React, cutting drop off by 18%
`;
const JD = `Frontend Engineer at ${MARK} Labs\nRequirements\n3+ years of experience with TypeScript and React\nBachelor's degree`;

// makes a person with one of everything
async function person(label: string) {
  const db = await getDb();
  const id = randomUUID();
  await db.insert(schema.users).values({ id, email: `${label}-${id}@example.com`, name: `${label} ${MARK}` });
  const resume = await saveResume(id, { name: `${MARK} resume ${label}`, text: `${RESUME}\n${label}` });
  const job = await createJob(id, { title: `${MARK} Engineer`, company: `${MARK} Labs`, url: "https://jobs.example.com/shared-link", description: JD });
  const scan = await createScan(id, { resumeId: resume.id, resumeText: RESUME, layout: null, jdText: `${JD}\n${label}`, jobTitle: `${MARK} Engineer`, company: `${MARK} Labs`, jobId: job.id });
  await saveCoverLetter(id, job.id, `Dear ${MARK}`);
  const interview = await addInterview(id, job.id, { type: "Technical", datetime: new Date(Date.now() + 86_400_000), interviewerName: MARK, phone: null, email: null, meetingLink: null, description: null });
  const practice = await createPracticeSession(id, { jobId: job.id, jobTitle: `${MARK} Engineer`, company: null, jdText: JD, questions: [] } as Parameters<typeof createPracticeSession>[1]);
  const linkedin = await saveLinkedinReport(id, { headline: MARK } as Parameters<typeof saveLinkedinReport>[1], [], { score: 50 } as Parameters<typeof saveLinkedinReport>[3]);
  const built = await createBuilderResume(id, { name: `${MARK} built` });
  const token = await createExtensionToken(id);
  return { id, resume, job, scan, interview, practice, linkedin, built, token };
}

describe("two people using the app at once", () => {
  it("never shows one person anything that belongs to the other", async () => {
    const theirs = await person("B");
    // someone with an account and nothing in it
    const db = await getDb();
    const me = randomUUID();
    await db.insert(schema.users).values({ id: me, email: `A-${me}@example.com`, name: "A" });

    // everything a page can list for me
    const seen = JSON.stringify([
      await listResumes(me),
      await listManagedResumes(me),
      await listJobs(me),
      await listJobs(me, true),
      await jobCounts(me),
      await nextInterview(me),
      await listScans(me),
      await listScans(me, { search: MARK }),
      await latestScan(me),
      await listLinkedinReports(me),
      await listPracticeSessions(me),
      await listPracticeSessions(me, theirs.job.id),
      await listInterviews(me, theirs.job.id),
      await extensionStatus(me),
      await exportAccount(me),
    ]);
    expect(seen).not.toContain(MARK);
    expect(seen).not.toContain(theirs.id);

    // asking for their things by id gets nothing
    expect(await getResume(me, theirs.resume.id)).toBeNull();
    expect(await getResume(me, theirs.built)).toBeNull();
    expect(await getJob(me, theirs.job.id)).toBeNull();
    expect(await getScan(me, theirs.scan.id)).toBeNull();
    expect(await getCoverLetter(me, theirs.job.id)).toBeNull();
    expect(await getPracticeSession(me, theirs.practice)).toBeNull();
    expect(await getLinkedinReport(me, theirs.linkedin)).toBeNull();
    // the same posting saved by both of us is still two separate cards
    expect(await findCard(me, { title: `${MARK} Engineer`, company: `${MARK} Labs`, url: "https://jobs.example.com/shared-link" })).toBeNull();

    // and I cannot change or delete them
    expect(await updateJob(me, theirs.job.id, { title: "mine now" })).toBeNull();
    expect(await updateScan(me, theirs.scan.id, { jobTitle: "mine now" })).toBeNull();
    await deleteJob(me, theirs.job.id);
    await deleteScans(me, [theirs.scan.id]);
    await deleteResume(me, theirs.resume.id);
    expect((await getJob(theirs.id, theirs.job.id))?.title).toBe(`${MARK} Engineer`);
    expect((await getScan(theirs.id, theirs.scan.id))?.jobTitle).toBe(`${MARK} Engineer`);
    expect(await getResume(theirs.id, theirs.resume.id)).not.toBeNull();

    // their extension key signs in as them and nobody else
    expect((await userForToken(theirs.token))?.id).toBe(theirs.id);
  });

  it("gives each of two people their own data when both have some", async () => {
    const [first, second] = [await person("C"), await person("D")];
    for (const [mine, other] of [
      [first, second],
      [second, first],
    ] as const) {
      const jobs = await listJobs(mine.id);
      const scans = await listScans(mine.id);
      expect(jobs.map((job) => job.id)).toEqual([mine.job.id]);
      expect(scans.items.map((scan) => scan.id)).toEqual([mine.scan.id]);
      expect((await listResumes(mine.id)).map((resume) => resume.id)).not.toContain(other.resume.id);
      // the score on my card is my own scan's
      expect(jobs[0]?.matchRate).toBe(mine.scan.matchRate);
      expect(JSON.stringify(await exportAccount(mine.id))).not.toContain(other.id);
    }
  });
});
