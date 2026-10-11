import { describe, expect, it } from "vitest";
import { scanResume } from "./scan";
import { matchRate } from "./score";
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

describe("a posting we could not read skills from", () => {
  const SKILLS = ["Python", "C++", "Linux", "Git", "SQL", "React", "TypeScript"].map((name) => ({ name }));
  const JUNIOR = "Sam Rivera\nsam@example.com\n\nExperience\nSoftware Engineering Intern, Acme\nJun 2025 - Aug 2025\n• Built internal tools in Python, cutting report time by 40%\n\nSkills\nPython, Git, React, TypeScript";
  // a posting the way some careers sites hand it over in their structured data: the whole thing on one line
  const FLAT =
    "Job Details: Job Description: Join our team as a software engineering intern working on validation tools in Python and C++ on Linux. Qualifications: You must possess the below minimum qualifications to be initially considered for this position. Minimum Qualifications: Candidate must be pursuing a Bachelor's degree in Computer Science. Experience with Python, Git and SQL. Preferred Qualifications: 3+ years of experience with C++ in a production environment. We are an equal opportunity employer and all qualified applicants will receive consideration without regard to race. Benefits: We offer a total compensation package that ranks among the best in the industry.";
  const scan = (jdText: string, hardSkills = SKILLS, resumeText = JUNIOR, jobTitle?: string) => scanResume({ resumeText, jdText, jobTitle, hardSkills, softSkills: [], today: new Date(2026, 5, 15) });

  it("reads the same skills from a posting on one line as from the same posting with its line breaks", () => {
    const flat = scan(FLAT);
    const broken = scan(FLAT.replace(/(?<=[.:]) /g, "\n"));
    // one legal sentence at the end used to wipe out the whole line, and with it every skill
    expect(flat.hardSkills.map((skill) => skill.name).sort()).toEqual(["C++", "Git", "Linux", "Python", "SQL"]);
    expect(flat.hardSkills.map((skill) => [skill.name, skill.match]).sort()).toEqual(broken.hardSkills.map((skill) => [skill.name, skill.match]).sort());
    expect(flat.matchRate).toBe(broken.matchRate);
    // the nice to have part is still told apart, so its years are not read as required
    expect(flat.jd.yearsRequired).toBeNull();
    expect(flat.hardSkills.find((skill) => skill.name === "SQL")?.importance).toBe("required");
  });

  it("never lets an empty skill list raise the score", () => {
    const withSkills = scan(FLAT);
    const none = scan(FLAT, []);
    expect(none.hardSkills).toEqual([]);
    expect(none.unread).toEqual(["hardSkills", "softSkills"]);
    expect(none.categoryScores.hardSkills).toBe(0);
    expect(none.cap).toMatchObject({ reason: "noHardSkills", limit: 60 });
    // what the rest of the report earns by itself is the most an unread posting can get, and it is held at 60 on top of that
    const rest = matchRate(none.categoryScores, ["hardSkills", "softSkills"]);
    expect(none.matchRate).toBe(Math.min(rest, 60));
    expect(none.matchRate).toBeLessThanOrEqual(60);
    // under the old rule the missing categories counted as full marks
    const old = Math.round(100 * (0.5 + 0.15 + 0.15 * none.categoryScores.searchability + 0.1 * none.categoryScores.recruiterTips + 0.1 * none.categoryScores.formatting));
    expect(none.matchRate).toBeLessThan(old);
    // and a resume that really has every skill still beats one judged on nothing
    const perfect = scan(FLAT, SKILLS, `${JUNIOR}, C++, Linux, SQL`);
    expect(perfect.cap).toBeNull();
    expect(perfect.matchRate).toBeGreaterThan(none.matchRate);
    expect(withSkills.unread).toEqual(["softSkills"]);
  });

  it("does not score a junior resume above 60 against a staff posting, even when every skill matches", () => {
    const STAFF = "Staff Software Engineer, Frontend\n\nWhat you will do\nLead the architecture of our React and TypeScript apps.\n\nRequirements\nDeep experience with React, TypeScript, Python and Git.";
    const staff = scan(STAFF);
    expect(staff.hardSkills.every((skill) => skill.match === "exact")).toBe(true);
    expect(staff.jd.levelYears).toBe(7);
    expect(staff.cap).toMatchObject({ reason: "levelGap", limit: 60, wanted: 7 });
    expect(staff.matchRate).toBeLessThanOrEqual(60);
    expect(staff.checks.find((check) => check.id === "job-level")).toMatchObject({ passed: false });

    // the same posting at the resume's own level is not held back
    const same = scan(STAFF.replace("Staff Software Engineer, Frontend", "Software Engineer, Frontend"));
    expect(same.cap).toBeNull();
    expect(same.matchRate).toBeGreaterThan(60);
    // nor is someone who has the years
    const veteran = scan(STAFF, SKILLS, JUNIOR.replace("Jun 2025 - Aug 2025", "Jun 2015 - Present"));
    expect(veteran.cap).toBeNull();
    // a number of years in the posting does the same job as a title
    const years = scan(STAFF.replace("Staff Software Engineer, Frontend", "Software Engineer").replace("Deep experience", "8+ years of experience"));
    expect(years.cap).toMatchObject({ reason: "levelGap", wanted: 8 });
  });
});
