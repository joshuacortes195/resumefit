import { describe, expect, it } from "vitest";
import { parseResume, scanResume, stuffingNote } from "@resumefit/scoring";
import { HARD_SKILLS, SOFT_SKILLS } from "@resumefit/skills-data";

const BASE = `Sam Rivera
Denver, CO | sam@example.com | (303) 555-0100

Summary
Data analyst who builds dashboards people use.

Work Experience
Data Analyst, Northwind Health
Jan 2022 - Present
• Built 14 Tableau dashboards on SQL views, cutting weekly reporting from 6 hours to 1
• Trained 9 nurses to read the dashboards
• Cleaned 3 years of intake data and found 2,100 duplicate patient records

Education
B.S. Statistics, State University, 2021

Skills
SQL, Tableau, Excel
`;
const JD = `Data Analyst at Brightside Labs

Requirements
3+ years of experience with SQL and Tableau
Clear written communication
`;
const scan = (resumeText: string) => scanResume({ resumeText, jdText: JD, hardSkills: HARD_SKILLS, softSkills: SOFT_SKILLS, today: new Date(2026, 10, 15) });

describe("keyword stuffing", () => {
  it("says nothing about a resume that reads fine", () => {
    expect(scan(BASE).checks.some((check) => check.id === "stuffing")).toBe(false);
  });

  it("names a skill repeated far more than the job asks for, without moving the score", () => {
    const stuffed = `${BASE}SQL SQL SQL SQL SQL SQL SQL SQL SQL SQL\n`;
    const result = scan(stuffed);
    const note = result.checks.find((check) => check.id === "stuffing");
    expect(note).toMatchObject({ category: "recruiterTips", info: true, passed: true });
    expect(note?.message).toMatch(/^SQL \(\d+ times\) is repeated far more than the job description asks for\./);
    // a note is never counted, so the recruiter tips score is what it was
    expect(result.categoryScores.recruiterTips).toBe(scan(BASE).categoryScores.recruiterTips);
    expect(result.issuesToFix.recruiterTips).toBe(scan(BASE).issuesToFix.recruiterTips);
  });

  it("flags a skills list that outweighs the rest of the resume", () => {
    const parsed = parseResume(`Sam Rivera\nsam@example.com\n\nWork Experience\nAnalyst, Acme\nJan 2022 - Present\n• Built reports\n\nSkills\n${Array.from({ length: 160 }, (_, index) => `skill${index}`).join(", ")}\n`);
    expect(stuffingNote([], parsed)?.message).toMatch(/Your skills section is \d+% of the whole resume\./);
    // a short resume is not judged on shares
    expect(stuffingNote([], parseResume("Sam\n\nSkills\nSQL, Excel\n"))).toBeNull();
  });
});
