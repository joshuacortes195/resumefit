import { describe, expect, it } from "vitest";
import { getCurrentUser } from "@/lib/auth";
import { createJob, findCard, latestScores, listJobs, samePosting, tidyCompany } from "./jobs";
import { addedOn } from "@/lib/job-tabs";
import { duplicateResume, getResume, listManagedResumes, listResumes, saveResume, setBaseResume } from "./resumes";
import { addToDictionary, createScan, deleteScans, ensureCard, getScan, hashJd, listScans, previewOf, previousScan, scansToday, setScansArchived, updateScan } from "./scans";

const RESUME = `Jordan Lee
Austin, TX | jordan.lee@example.com | (512) 555-0142

Summary
Frontend developer who builds with React and JavaScript.

Work Experience
Frontend Developer, Acme Corp
Jan 2023 - Present
• Rebuilt the checkout flow in React, cutting drop off by 18%

Education
B.S. Computer Science, State University, 2021
`;

const JD = `Frontend Engineer at Brightside Labs
Requirements
3+ years of experience with TypeScript and React
Bachelor's degree
Experience with Storybook
`;

describe("resumes", () => {
  it("makes the first resume the base and reuses identical text", async () => {
    const user = await getCurrentUser();
    const first = await saveResume(user.id, { name: "First", text: RESUME });
    const again = await saveResume(user.id, { name: "Same text", text: RESUME });
    const second = await saveResume(user.id, { name: "Second", text: `${RESUME}\nSkills\nReact` });
    expect(first.isBase).toBe(true);
    expect(again.id).toBe(first.id);
    expect(second.isBase).toBe(false);
    expect((first.parsed as { contact: { name: string } }).contact.name).toBe("Jordan Lee");

    // moving the star leaves exactly one base resume
    await setBaseResume(user.id, second.id);
    const all = await listResumes(user.id);
    expect(all.filter((resume) => resume.isBase).map((resume) => resume.id)).toEqual([second.id]);

    const copy = await duplicateResume(user.id, first.id);
    expect(copy?.name).toBe("First (copy)");
    expect(copy?.isBase).toBe(false);
  });

  it("never returns someone else's resume", async () => {
    const user = await getCurrentUser();
    const resume = await saveResume(user.id, { name: "Mine", text: `${RESUME}\nmine` });
    expect(await getResume("00000000-0000-0000-0000-000000000000", resume.id)).toBeNull();
  });
});

describe("scans", () => {
  it("saves a scan with the title and company read from the posting", async () => {
    const user = await getCurrentUser();
    const scan = await createScan(user.id, { resumeId: null, resumeText: RESUME, layout: null, jdText: JD });
    expect(scan).toMatchObject({ jobTitle: "Frontend Engineer", company: "Brightside Labs", jdHash: hashJd(JD) });
    expect(scan.matchRate).toBe(scan.report.matchRate);

    const loaded = await getScan(user.id, scan.id);
    expect(loaded?.report.hardSkills.find((skill) => skill.name === "TypeScript")?.match).toBe("missing");
    expect(await getScan(user.id, "not-an-id")).toBeNull();
    expect(await scansToday(user.id)).toBeGreaterThanOrEqual(1);
  });

  it("scores again when the scan is edited", async () => {
    const user = await getCurrentUser();
    const scan = await createScan(user.id, { resumeId: null, resumeText: RESUME, layout: null, jdText: JD });
    const before = scan.report.checks.find((check) => check.id === "job-title");
    expect(before?.passed).toBe(false);

    // looking for the title the resume really has makes that check pass
    const retitled = await updateScan(user.id, scan.id, { jobTitleOverride: "Frontend Developer" });
    expect(retitled?.report.checks.find((check) => check.id === "job-title")?.passed).toBe(true);
    expect(retitled?.jobTitle).toBe("Frontend Engineer");

    // a skill added by hand shows up as a missing row
    const withSkill = await updateScan(user.id, scan.id, { customSkills: [{ name: "Storybook", category: "hard" }] });
    expect(withSkill?.report.hardSkills.find((skill) => skill.name === "Storybook")).toMatchObject({ match: "missing" });
    expect(withSkill?.matchRate).toBeLessThanOrEqual(retitled?.matchRate ?? 0);
  });

  it("checks every later scan for skills in the user's own dictionary", async () => {
    const user = await getCurrentUser();
    await addToDictionary(user.id, { name: "Storybook", category: "hard" });
    await addToDictionary(user.id, { name: "storybook", category: "hard" });
    const scan = await createScan(user.id, { resumeId: null, resumeText: RESUME, layout: null, jdText: JD });
    expect(scan.report.hardSkills.filter((skill) => skill.name.toLowerCase() === "storybook")).toHaveLength(1);
  });

  it("finds the earlier scan of the same posting", async () => {
    const user = await getCurrentUser();
    const jd = `${JD}\nExperience with Jest`;
    const first = await createScan(user.id, { resumeId: null, resumeText: RESUME, layout: null, jdText: jd });
    const second = await createScan(user.id, { resumeId: null, resumeText: `${RESUME}\nSkills\nTypeScript, Jest`, layout: null, jdText: jd });
    expect(second.matchRate).toBeGreaterThan(first.matchRate);
    expect(await previousScan(user.id, second)).toEqual({ id: first.id, matchRate: first.matchRate });
    expect(await previousScan(user.id, first)).toBeNull();
  });

  it("lists, searches, archives and deletes", async () => {
    const user = await getCurrentUser();
    const scan = await createScan(user.id, { resumeId: null, resumeText: RESUME, layout: null, jdText: "Staff Nurse at Northwind Health\nPatient care and charting in a busy ward", jobTitle: "Staff Nurse" });

    const found = await listScans(user.id, { search: "northwind" });
    expect(found.items.map((item) => item.id)).toEqual([scan.id]);
    expect(found.items[0]?.snippet).toContain("Patient care");
    expect(found.total).toBe(1);

    const paged = await listScans(user.id, { pageSize: 2, sort: "score" });
    expect(paged.items).toHaveLength(2);
    expect(paged.total).toBeGreaterThan(2);
    expect(paged.items[0]?.matchRate).toBeGreaterThanOrEqual(paged.items[1]?.matchRate ?? 0);

    await setScansArchived(user.id, [scan.id], true);
    expect((await listScans(user.id, { search: "northwind" })).total).toBe(0);
    expect((await listScans(user.id, { search: "northwind", archived: true })).total).toBe(1);

    await deleteScans(user.id, [scan.id]);
    expect(await getScan(user.id, scan.id)).toBeNull();
  });
});

describe("keeping people's data apart", () => {
  it("will not hang a scan off someone else's job", async () => {
    const { getDb, schema } = await import("@/db");
    const { createJob } = await import("./jobs");
    const { randomUUID } = await import("node:crypto");
    const db = await getDb();
    const stranger = randomUUID();
    await db.insert(schema.users).values({ id: stranger, email: `stranger-${stranger}@example.com` });
    const theirJob = await createJob(stranger, { title: "Their secret job", company: "Elsewhere" });

    const user = await getCurrentUser();
    const scan = await createScan(user.id, { resumeId: null, resumeText: RESUME, layout: null, jdText: `${JD}\nUnique line for this test only`, jobId: theirJob.id });
    expect(scan.jobId).toBeNull();
    const listed = (await listScans(user.id, { search: "Unique line for this test only" })).items[0];
    expect(listed).toMatchObject({ jobId: null, jobStatus: null });
  });
});

describe("tracker cards", () => {
  it("only calls two postings the same job when the title and the company or link agree", () => {
    const card = { title: "Software Engineer", company: "Northrop Grumman", url: "https://jobs.example.com/1" };
    // same title somewhere else is a different job, this is what used to put one company's score on another's card
    expect(samePosting(card, { title: "Software Engineer", company: "Intel Corporation", url: "https://jobs.example.com/2" })).toBe(false);
    // a page that lists many jobs under one address must not match on the link alone
    expect(samePosting(card, { title: "Hardware Engineer", company: "Northrop Grumman", url: "https://jobs.example.com/1" })).toBe(false);
    expect(samePosting(card, { title: "software engineer", company: "Northrop Grumman.", url: null })).toBe(true);
    expect(samePosting(card, { title: "Software Engineer", company: null, url: "https://jobs.example.com/1" })).toBe(true);
    expect(samePosting(card, { title: "Software Engineer", company: null, url: null })).toBe(false);
    // nothing to read a title from, so the link is all there is
    expect(samePosting(card, { title: null, company: null, url: "https://jobs.example.com/1" })).toBe(true);
  });

  it("shows a card the score of its own scan, and no score until it has one", async () => {
    const user = await getCurrentUser();
    const intel = await createJob(user.id, { title: "Software Engineer", company: "Intel Corporation" });
    const northrop = await createJob(user.id, { title: "Software Engineer", company: "Northrop Grumman" });

    // the panel still names the last job's card, the scan has to land on its own
    const found = await findCard(user.id, { title: "Software Engineer", company: "Northrop Grumman" }, intel.id);
    expect(found).toBe(northrop.id);
    const scan = await createScan(user.id, { resumeId: null, resumeText: RESUME, layout: null, jdText: `${JD}\nnorthrop`, jobTitle: "Software Engineer", company: "Northrop Grumman", jobId: found });

    const board = await listJobs(user.id);
    expect(board.find((job) => job.id === northrop.id)?.matchRate).toBe(scan.matchRate);
    expect(board.find((job) => job.id === intel.id)?.matchRate).toBeNull();

    // the history table agrees with the board about what is tracked
    const { items } = await listScans(user.id, { search: "northrop" });
    expect(items[0]).toMatchObject({ jobId: northrop.id, jobStatus: "saved", jobArchived: false, matchRate: scan.matchRate });
  });
});

describe("small things the pages show", () => {
  it("starts a job description preview at its first letter and ends it on a whole word", () => {
    const jd = "The Opportunity\nAdobe is looking for a Software Engineer who will design, build and ship features used by millions of people every single day across the world.";
    const preview = previewOf(jd);
    expect(preview.startsWith("The Opportunity Adobe")).toBe(true);
    expect(preview.endsWith("…")).toBe(true);
    expect(preview.length).toBeLessThanOrEqual(141);
    // the part before the dots is made of whole words from the posting
    const flat = jd.replace(/\s+/g, " ");
    expect(flat.startsWith(preview.slice(0, -1))).toBe(true);
    expect(flat.charAt(preview.length - 1)).toMatch(/[\s,.;:]/);
    // short ones are left as they are, and one endless word is still cut
    expect(previewOf("  Data Analyst \n SQL  ")).toBe("Data Analyst SQL");
    expect(previewOf("x".repeat(400))).toBe(`${"x".repeat(140)}…`);
  });

  it("says when a job was added by the calendar, then with the real date", () => {
    const now = new Date(2026, 9, 10, 9, 0);
    expect(addedOn(new Date(2026, 9, 10, 0, 5), now)).toBe("today");
    // late last night is yesterday, even though it is less than a day ago
    expect(addedOn(new Date(2026, 9, 9, 23, 30), now)).toBe("yesterday");
    expect(addedOn(new Date(2026, 9, 3, 12, 0), now)).toBe("Oct 3");
    expect(addedOn(new Date(2025, 11, 24, 12, 0), now)).toBe("Dec 24, 2025");
  });

  it("links a resume written for a scan to that scan's job, putting the job on the tracker when needed", async () => {
    const user = await getCurrentUser();
    const scan = await createScan(user.id, { resumeId: null, resumeText: RESUME, layout: null, jdText: `${JD}\ntailored for this one`, jobTitle: "Platform Engineer", company: "Tailwind Freight" });
    expect(scan.jobId).toBeNull();
    const jobId = await ensureCard(user.id, scan);
    const resume = await saveResume(user.id, { name: "Resume for Tailwind Freight, Platform Engineer", text: `${RESUME}\ntailored`, source: "optimized", linkedJobId: jobId });

    const listed = (await listManagedResumes(user.id)).find((entry) => entry.id === resume.id);
    expect(listed).toMatchObject({ linkedJobId: jobId, jobTitle: "Platform Engineer", jobCompany: "Tailwind Freight" });
    // the scan is on that card too, and asking again gives the same card, not a second one
    expect((await getScan(user.id, scan.id))?.jobId).toBe(jobId);
    expect(await ensureCard(user.id, { ...scan, jobId: null })).toBe(jobId);
    expect((await listJobs(user.id)).filter((job) => job.company === "Tailwind Freight")).toHaveLength(1);
  });
});

describe("every way a scan and a card get linked", () => {
  // three jobs scanned one after another, the way the mix up happened: each scan must end up on its own job and nobody else's
  const POSTINGS = [
    { title: "[Summer 2027] Software Engineer Intern", company: "Roblox", url: "https://careers.example.com/roblox/1" },
    { title: "Software Engineer (3/4) Mission Planning & Scheduling", company: "Northrop Grumman", url: "https://careers.example.com/northrop/2" },
    { title: "Software Engineering - Intern, Bachelor's", company: "Intel Corporation", url: "https://careers.example.com/intel/3" },
  ];
  const scanOf = (userId: string, posting: (typeof POSTINGS)[number], jobId: string | null) =>
    createScan(userId, { resumeId: null, resumeText: RESUME, layout: null, jdText: `${JD}\n${posting.company} ${posting.title}`, jobTitle: posting.title, company: posting.company, jobUrl: posting.url, jobId });

  it("from the extension: each scan lands on its own job, even when the panel still names the last one", async () => {
    const user = await getCurrentUser();
    let lastCard: string | null = null;
    const made: { scanId: string; jobId: string; matchRate: number }[] = [];
    for (const posting of POSTINGS) {
      // the same steps the extension's scan endpoint takes
      const found = await findCard(user.id, posting, lastCard);
      const jobId = found ?? (await createJob(user.id, posting)).id;
      const scan = await scanOf(user.id, posting, jobId);
      made.push({ scanId: scan.id, jobId, matchRate: scan.matchRate });
      lastCard = jobId;
    }
    expect(new Set(made.map((entry) => entry.jobId)).size).toBe(3);
    const scores = await latestScores(user.id, made.map((entry) => entry.jobId));
    for (const [index, posting] of POSTINGS.entries()) {
      // the scan a card points at, which is where its AI Optimize link goes, is that job's own
      const linked = await getScan(user.id, scores.get(made[index]?.jobId ?? "")?.scanId ?? "");
      expect(linked).toMatchObject({ id: made[index]?.scanId, company: posting.company, jobTitle: posting.title });
    }
  });

  it("from Find Jobs or Add Job: a job saved first gets its own scan later, and tracking a scan reuses that card", async () => {
    const user = await getCurrentUser();
    const posting = { title: "Staff Software Engineer, Frontend", company: "Harvey Demo", url: "https://jobs.example.com/harvey/9" };
    const other = { title: "Staff Software Engineer, Frontend", company: "Some Other Co", url: "https://jobs.example.com/other/4" };
    const saved = await createJob(user.id, posting);
    // a scan of the same title at another company must not touch it
    const stranger = await scanOf(user.id, other, await findCard(user.id, other));
    expect(stranger.jobId).toBeNull();
    expect((await latestScores(user.id, [saved.id])).has(saved.id)).toBe(false);

    // scanned from the web form with nothing linking it yet, then tracked from Scan History
    const mine = await scanOf(user.id, posting, null);
    expect(await ensureCard(user.id, mine)).toBe(saved.id);
    expect((await latestScores(user.id, [saved.id])).get(saved.id)).toMatchObject({ scanId: mine.id, matchRate: mine.matchRate });
  });

  it("on a rescan: the new scan stays on the same job and becomes the one the card shows", async () => {
    const user = await getCurrentUser();
    const posting = { title: "Rescan Engineer", company: "Loop Labs", url: "https://jobs.example.com/loop/1" };
    const first = await scanOf(user.id, posting, (await createJob(user.id, posting)).id);
    const again = await createScan(user.id, { resumeId: null, resumeText: `${RESUME}\nSkills\nTypeScript, Storybook`, layout: null, jdText: first.jdText, jobTitle: first.jobTitle, company: first.company, jobUrl: first.jobUrl, jobId: first.jobId });
    expect(again.jobId).toBe(first.jobId);
    const shown = (await latestScores(user.id, [first.jobId ?? ""])).get(first.jobId ?? "");
    expect(shown).toMatchObject({ scanId: again.id, scans: 2 });
    expect((await getScan(user.id, shown?.scanId ?? ""))?.company).toBe("Loop Labs");
  });
});

describe("company names from career sites", () => {
  it("drops the entity number a workday page puts in front, and nothing else", async () => {
    expect(tidyCompany("100 Intel Corporation", "https://intel.wd1.myworkdayjobs.com/External/job/Santa-Clara/Intern_JR1")).toBe("Intel Corporation");
    expect(tidyCompany("  0042 Acme Health ", "https://acme.wd5.myworkdayjobs.com/x")).toBe("Acme Health");
    // real names that start with a number, and the same shape on any other site
    expect(tidyCompany("100 Thieves", "https://boards.greenhouse.io/100thieves/jobs/1")).toBe("100 Thieves");
    expect(tidyCompany("84 Lumber", null)).toBe("84 Lumber");
    expect(tidyCompany("3M", "https://3m.wd1.myworkdayjobs.com/x")).toBe("3M");
    expect(tidyCompany("  ", "https://x.wd1.myworkdayjobs.com/x")).toBeNull();

    // it is applied where jobs and scans are saved, so the extension, the link importer and the form are all covered
    const user = await getCurrentUser();
    const url = "https://intel.wd1.myworkdayjobs.com/External/job/123";
    const job = await createJob(user.id, { title: "Validation Intern", company: "100 Intel Corporation", url });
    const scan = await createScan(user.id, { resumeId: null, resumeText: RESUME, layout: null, jdText: `${JD}\nintel validation`, jobTitle: "Validation Intern", company: "100 Intel Corporation", jobUrl: url, jobId: job.id });
    expect([job.company, scan.company]).toEqual(["Intel Corporation", "Intel Corporation"]);
  });
});
