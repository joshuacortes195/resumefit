import { describe, expect, it } from "vitest";
import { getCurrentUser } from "@/lib/auth";
import { duplicateResume, getResume, listResumes, saveResume, setBaseResume } from "./resumes";
import { addToDictionary, createScan, deleteScans, getScan, hashJd, listScans, previousScan, scansToday, setScansArchived, updateScan } from "./scans";

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
