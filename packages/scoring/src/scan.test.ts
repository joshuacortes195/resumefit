import { describe, expect, it } from "vitest";
import { scanResume } from "./scan";
import type { SkillTerm } from "./match";

// skill lists for the tests
const HARD: SkillTerm[] = [
  { name: "TypeScript", aliases: ["TS"] },
  { name: "React", aliases: ["React.js"] },
  { name: "PostgreSQL", aliases: ["Postgres"], related: ["SQL"] },
  { name: "Kubernetes", aliases: ["k8s"] },
  { name: "CI/CD", aliases: ["continuous integration"] },
];
const SOFT: SkillTerm[] = [{ name: "Communication" }, { name: "Collaboration", aliases: ["teamwork"] }];

const JD = `Frontend Engineer
We need strong TypeScript and React skills. You will write TypeScript daily, store data in PostgreSQL,
ship through CI/CD and deploy to Kubernetes. Communication and collaboration matter here.`;

// resume written for this job
const TAILORED = `Jordan Lee
Austin, TX | jordan.lee@example.com | (512) 555-0142
linkedin.com/in/jordanlee

Summary
Frontend Engineer with four years of TypeScript and React work. Clear communication and close collaboration with design.

Work Experience
Frontend Engineer, Acme Corp
• Cut page load time by 40% with React code splitting
• Moved 30 screens to TypeScript with zero regressions
• Tuned PostgreSQL queries, saving 2 seconds per report
• Set up CI/CD that ships 15 releases a week
• Ran Kubernetes deploys for 6 services

Education
B.S. Computer Science, State University
`;

// resume that was not written for this job
const GENERIC = `Sam Rivera

My Journey
Barista, Corner Cafe
• Hard worker and team player who made drinks
• Opened the store on weekends
`;

describe("scanResume", () => {
  it("scores a tailored resume high", () => {
    const result = scanResume({ resumeText: TAILORED, jdText: JD, jobTitle: "Frontend Engineer", hardSkills: HARD, softSkills: SOFT });
    expect(result.matchRate).toBeGreaterThanOrEqual(75);
    expect(result.issuesToFix.hardSkills).toBe(0);
    expect(result.hardSkills.every((skill) => skill.match === "exact")).toBe(true);
  });

  it("scores a generic resume low and says what to fix", () => {
    const result = scanResume({ resumeText: GENERIC, jdText: JD, jobTitle: "Frontend Engineer", hardSkills: HARD, softSkills: SOFT });
    expect(result.matchRate).toBeLessThan(40);
    expect(result.issuesToFix.hardSkills).toBe(5);
    expect(result.issuesToFix.searchability).toBeGreaterThan(3);

    // the creative heading and the cliches get called out by name
    const byId = Object.fromEntries(result.checks.map((check) => [check.id, check]));
    expect(byId["experience-heading"]?.message).toContain("My Journey");
    expect(byId["tone"]?.message).toContain("team player");
    expect(byId["email"]?.passed).toBe(false);
  });

  it("skips the job title check when no title is given", () => {
    const result = scanResume({ resumeText: TAILORED, jdText: JD, hardSkills: HARD, softSkills: SOFT });
    expect(result.checks.some((check) => check.id === "job-title")).toBe(false);
  });

  it("gives the same answer every time", () => {
    const input = { resumeText: TAILORED, jdText: JD, hardSkills: HARD, softSkills: SOFT };
    expect(scanResume(input)).toEqual(scanResume(input));
  });
});
