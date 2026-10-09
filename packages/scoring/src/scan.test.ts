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

  it("guesses the job title from the posting when none is typed in", () => {
    const result = scanResume({ resumeText: TAILORED, jdText: JD, hardSkills: HARD, softSkills: SOFT });
    expect(result.jobTitle).toBe("Frontend Engineer");
    expect(result.checks.find((check) => check.id === "job-title")).toMatchObject({ passed: true });
  });

  it("gives a custom skill its own row and rescans with it", () => {
    const result = scanResume({ resumeText: TAILORED, jdText: JD, hardSkills: HARD, softSkills: SOFT, customSkills: [{ name: "Storybook", category: "hard" }] });
    expect(result.hardSkills.find((skill) => skill.name === "Storybook")).toMatchObject({ match: "missing", jdCount: 1, importance: "required" });
    expect(result.issuesToFix.hardSkills).toBe(1);
  });

  it("leaves skills in the benefits section out of the report", () => {
    const withPerks = `${JD}\n\nBenefits\nFree Docker and GraphQL training`;
    const result = scanResume({ resumeText: TAILORED, jdText: withPerks, hardSkills: [...HARD, { name: "Docker" }, { name: "GraphQL" }], softSkills: SOFT });
    expect(result.hardSkills.map((skill) => skill.name)).not.toContain("Docker");
  });

  it("uses hints to fill gaps but never over our own read", () => {
    const jd = "Come build things with us.\nYou will write TypeScript and use Storybook and Chromatic every day.";
    const hints = { jobTitle: "UI Engineer", yearsRequired: 4, educationRequired: "Bachelor's", hardSkills: ["Storybook", "TypeScript", "experience", "Rust"], softSkills: ["Communication"] };
    const result = scanResume({ resumeText: TAILORED, jdText: jd, hardSkills: HARD, softSkills: SOFT, hints });
    expect(result.jobTitle).toBe("UI Engineer");
    expect(result.jd.yearsRequired).toBe(4);
    expect(result.jd.educationRequired).toBe("Bachelor's");
    // storybook is new and in the posting, rust is not in the posting, typescript was already known
    expect(result.hardSkills.map((skill) => skill.name).sort()).toEqual(["Storybook", "TypeScript"]);
    expect(result.softSkills).toEqual([]);

    // a title we can read ourselves is kept
    expect(scanResume({ resumeText: TAILORED, jdText: JD, hardSkills: HARD, softSkills: SOFT, hints }).jobTitle).toBe("Frontend Engineer");
  });

  it("gives the same answer every time", () => {
    const input = { resumeText: TAILORED, jdText: JD, hardSkills: HARD, softSkills: SOFT };
    expect(scanResume(input)).toEqual(scanResume(input));
  });
});
