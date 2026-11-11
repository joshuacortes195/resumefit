import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { scanResume } from "@resumefit/scoring";
import { HARD_SKILLS, SOFT_SKILLS } from "@resumefit/skills-data";

// a made up resume shaped like a real student one (wrapped bullets, two jobs, four projects) and the AWS SDE Intern, Embedded Development (Linux) posting.
// Jobscan scored a resume of this shape against this posting at 76 and ResumeFit at 60
const fixtures = new URL("../../../packages/scoring/src/fixtures/", import.meta.url);
const RESUME = readFileSync(new URL("aws-embedded-resume.txt", fixtures), "utf8");
const POSTING = readFileSync(new URL("aws-embedded-posting.txt", fixtures), "utf8");
const TODAY = new Date(2026, 9, 28);

// what a model read of this posting handed back, the phrases that used to show up as missing skills
const HINTS = {
  hardSkills: ["general-purpose programming language", "Data structures implementation", "Basic algorithm development", "Design and development", "Embedded Development", "Firmware"],
  softSkills: ["ownership mindset", "think big"],
};

describe("AWS embedded posting against a student resume", () => {
  const result = scanResume({ resumeText: RESUME, jdText: POSTING, hardSkills: HARD_SKILLS, softSkills: SOFT_SKILLS, hints: HINTS, today: TODAY });
  const missing = (rows: typeof result.hardSkills) => rows.filter((row) => row.match === "missing").map((row) => row.name);

  it("reads the two jobs as two jobs, both with dates", () => {
    expect(result.resume.experience.map((job) => [job.title, job.dates?.text])).toEqual([
      ["Software Engineering Intern", "Dec 2025 - Present"],
      ["IT Technician", "May 2025 - Dec 2025"],
    ]);
    expect(result.checks.find((check) => check.id === "dates")?.passed).toBe(true);
  });

  it("does not count the other choices in a list the resume already covers", () => {
    // Go and Rust sit in "Java, Python, C++, C#, Go, Rust, or TypeScript", and the degree fields in "Computer Science, Computer Engineering, Data Science, ..."
    for (const name of ["Go", "Rust", "Computer engineering", "Data science", "NoSQL", "Debugging"]) expect(missing(result.hardSkills)).not.toContain(name);
  });

  it("keeps posting filler and culture lines out of the missing lists", () => {
    const all = [...result.hardSkills, ...result.softSkills].map((row) => row.name.toLowerCase());
    for (const name of ["general-purpose programming language", "design and development", "recruiting", "ownership mindset", "think big", "ownership"]) expect(all).not.toContain(name);
  });

  it("covers data structure and algorithm phrases with Data Structures & Algorithms", () => {
    const rows = Object.fromEntries(result.hardSkills.map((row) => [row.name, row.match]));
    expect(rows["Data structures implementation"]).toBe("exact");
    expect(rows["Basic algorithm development"]).toBe("exact");
  });

  it("flags the same real gaps Jobscan did", () => {
    expect(missing(result.hardSkills)).toEqual(expect.arrayContaining(["Microservices", "Distributed Systems", "CI/CD"]));
    expect(missing(result.softSkills)).toContain("Troubleshooting");
    // no city and state up top, and a bare Experience heading
    expect(result.checks.find((check) => check.id === "location")?.passed).toBe(false);
    expect(result.checks.find((check) => check.id === "experience-heading")?.passed).toBe(false);
  });

  it("only counts soft skills the job really asks for as gaps", () => {
    expect(result.issuesToFix.softSkills).toBeLessThanOrEqual(2);
  });

  it("scores in the band this resume earns", () => {
    // 49 before these fixes. the resume Jobscan saw adds C++ and more, which this one does not have
    expect(result.matchRate).toBeGreaterThanOrEqual(52);
    expect(result.matchRate).toBeLessThanOrEqual(64);
  });

});
