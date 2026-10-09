import { describe, expect, it } from "vitest";
import { parseLinkedinText, scoreLinkedin, type LinkedinProfile } from "./linkedin";
import type { SkillTerm } from "./match";

const HARD: SkillTerm[] = [{ name: "SQL" }, { name: "Tableau" }, { name: "Python" }, { name: "Data analysis", aliases: ["data analytics"] }, { name: "Excel" }];
const SOFT: SkillTerm[] = [{ name: "Communication" }];

const JD = `Senior Data Analyst
Requirements
5+ years of experience with SQL and Tableau
Strong SQL skills and data analysis
Python is a plus
Clear communication`;

const STRONG: LinkedinProfile = {
  headline: "Data Analyst | SQL, Tableau and Python | Turning healthcare data into clear answers",
  about: `I am a data analyst with six years in healthcare. ${"I use SQL, Tableau and Python for data analysis that helps care teams decide faster. ".repeat(14)} Cut report time by 60% for 200 staff.`,
  experience: `Data Analyst, Northwind Health\n• Built 14 Tableau dashboards used by 200 staff\n• Cut report time by 60% with SQL automation\n• Built a Python model that caught 30 errors a month\n${"• Ran data analysis for clinical and finance teams across the whole organization every single week\n".repeat(12)}`,
  skills: ["SQL", "Tableau", "Python", "Data analysis", "Excel", "Statistics", "Dashboards", "Forecasting", "ETL", "Reporting", "Healthcare", "Data cleaning", "A/B testing", "Stakeholder management", "Presentations"],
  url: "linkedin.com/in/jordanlee",
};

const WEAK: LinkedinProfile = { headline: "Looking for work", about: "Hard worker.", experience: "Analyst, Corner Studio", skills: ["Teamwork"], url: "linkedin.com/in/jordan-lee-8a1b2c3d" };

describe("scoreLinkedin", () => {
  const strong = scoreLinkedin(STRONG, [JD], HARD, SOFT);
  const weak = scoreLinkedin(WEAK, [JD], HARD, SOFT);
  const failed = (report: typeof strong) => Object.values(report.sections).flatMap((section) => section.tips.filter((tip) => !tip.passed).map((tip) => tip.id));

  it("scores a tailored profile high and an empty one low", () => {
    expect(strong.score).toBeGreaterThanOrEqual(85);
    expect(weak.score).toBeLessThan(25);
    expect(failed(strong)).toEqual([]);
  });

  it("says exactly what the weak profile is missing", () => {
    expect(failed(weak)).toEqual(["headline-length", "headline-title", "headline-keywords", "custom-url", "about-length", "about-keywords", "about-results", "experience-length", "experience-keywords", "experience-results", "skills-count", "skills-match"]);
    const title = weak.sections.headline.tips.find((tip) => tip.id === "headline-title");
    expect(title?.message).toContain("Senior Data Analyst");
  });

  it("lists the jobs' keywords with how often the profile uses them", () => {
    const byName = Object.fromEntries(strong.keywords.map((keyword) => [keyword.name, keyword]));
    expect(byName.SQL).toMatchObject({ match: "exact", jdCount: 2, importance: "required" });
    expect(byName.Python?.importance).toBe("preferred");
    expect(weak.keywords.every((keyword) => keyword.match === "missing")).toBe(true);
    // excel is in the skill list but no job asks for it, so it is not a keyword here
    expect(byName.Excel).toBeUndefined();
  });

  it("flags a headline that is too long", () => {
    const long = scoreLinkedin({ ...STRONG, headline: `${STRONG.headline} ${"and more ".repeat(30)}` }, [JD], HARD, SOFT);
    expect(long.sections.headline.tips.find((tip) => tip.id === "headline-length")).toMatchObject({ passed: false });
  });

  it("combines several target jobs", () => {
    const two = scoreLinkedin(STRONG, [JD, "Analytics Engineer\nRequirements\nExcel and SQL modeling"], HARD, SOFT);
    expect(two.jobTitles).toEqual(["Senior Data Analyst", "Analytics Engineer"]);
    expect(two.keywords.find((keyword) => keyword.name === "Excel")).toMatchObject({ match: "exact" });
    expect(two.keywords.find((keyword) => keyword.name === "SQL")?.jdCount).toBe(3);
  });
});

describe("parseLinkedinText", () => {
  it("reads the headline, about, experience and skills from a profile export", () => {
    const profile = parseLinkedinText(`Contact
jordan.lee@example.com
www.linkedin.com/in/jordanlee
Top Skills
SQL
Tableau
Python
Jordan Lee
Data Analyst at Northwind Health | SQL and Tableau
Denver, Colorado
Summary
I turn messy healthcare data into clear answers.
Experience
Northwind Health
Data Analyst
January 2022 - Present
Built 14 dashboards used by 200 staff
Education
State University`);
    expect(profile.headline).toBe("Data Analyst at Northwind Health | SQL and Tableau");
    expect(profile.about).toBe("I turn messy healthcare data into clear answers.");
    expect(profile.experience).toContain("Built 14 dashboards");
    // the name and headline that follow the side column are not skills
    expect(profile.skills).toEqual(["SQL", "Tableau", "Python"]);
    expect(profile.url).toBe("www.linkedin.com/in/jordanlee");
  });
});
