import { describe, expect, it } from "vitest";
import { BOARDS } from "./job-boards";
import { fitLabel, fitScore, htmlToText, profileResume, searchJobs, type FeedJob } from "./jobs-feed";

const SKILLS = [{ name: "SQL" }, { name: "Tableau" }, { name: "Python" }, { name: "React" }, { name: "TypeScript" }, { name: "Excel" }];

// a made up opening
const job = (extra: Partial<FeedJob>): FeedJob => ({ id: "ashby:acme:1", title: "Data Analyst", company: "Acme", domain: "acme.com", location: "Denver, CO", remote: false, url: "https://jobs.example.com/1", postedAt: "2026-10-01T00:00:00Z", skills: [], intern: false, ...extra });

const RESUME = `Sam Rivera
Denver, CO | sam@example.com

Work Experience
Data Analyst, Northwind Health
Jan 2022 - Present
• Built 14 Tableau dashboards with SQL

Skills
SQL, Tableau, Excel
`;

const JOBS = [
  job({ id: "a", title: "Data Analyst", skills: ["SQL", "Tableau", "Excel"], postedAt: "2026-09-01T00:00:00Z" }),
  job({ id: "b", title: "Frontend Engineer", skills: ["React", "TypeScript", "Python"], remote: true, location: "Remote, US", postedAt: "2026-10-05T00:00:00Z" }),
  job({ id: "c", title: "Senior Data Analyst", company: "Northwind", skills: ["SQL", "Tableau", "Python", "React"], location: "Austin, TX", postedAt: "2026-10-07T00:00:00Z" }),
  job({ id: "d", title: "Office Manager", postedAt: null }),
  job({ id: "e", title: "Data Analyst Intern", company: "Globex", skills: ["SQL", "Excel", "Python"], intern: true, postedAt: "2026-10-02T00:00:00Z" }),
];
const ANY = { query: "", location: "", remoteOnly: false, internOnly: false, days: null, sort: "relevance" as const };

describe("htmlToText", () => {
  it("keeps paragraphs and bullets and drops the tags", () => {
    expect(htmlToText("<h3>Requirements</h3><ul><li>5+ years of SQL</li><li>Tableau &amp; Excel</li></ul><p>Apply&nbsp;today.</p>")).toBe("Requirements\n\n• 5+ years of SQL\n\n• Tableau & Excel\n\nApply today.");
  });

  it("handles html that arrives with its tags escaped", () => {
    expect(htmlToText("&lt;p&gt;We&#39;re hiring a &lt;strong&gt;Data Analyst&lt;/strong&gt;.&lt;/p&gt;")).toBe("We're hiring a Data Analyst.");
  });

  it("never lets a script through", () => {
    expect(htmlToText('<p>Hello</p><script>alert("x")</script><img src=x onerror="alert(1)">')).toBe("Hello");
  });
});

describe("profileResume", () => {
  const profile = profileResume(RESUME, SKILLS);

  it("reads the skills, job titles and field off a resume", () => {
    expect([...profile.skills].sort()).toEqual(["Excel", "SQL", "Tableau"]);
    expect([...profile.titleWords].sort()).toEqual(["analyst", "data"]);
    expect(profile.fields).toContain("Data and Analytics");
    expect(profile.earlyCareer).toBe(false);
  });

  it("points other kinds of resume at their own fields", () => {
    expect(profileResume("Work Experience\nRegistered Nurse, Lakeside Clinic\n2020 - Present\n• Cared for 12 patients a shift", SKILLS).fields).toContain("Healthcare");
    expect(profileResume("Work Experience\nSupply Chain Analyst, Ironworks\n2021 - Present\n• Cut warehouse inventory by 12%", SKILLS).fields).toContain("Transportation and Logistics");
    expect(profileResume("Education\nB.S. Mechanical Engineering, State University\nExpected graduation 2027\nGPA 3.7", SKILLS).earlyCareer).toBe(true);
  });
});

describe("fitScore", () => {
  const profile = profileResume(RESUME, SKILLS);

  it("is highest when the skills and the title both line up", () => {
    expect(fitScore(JOBS[0] as FeedJob, profile)).toBe(100);
    // half the skills and a close title
    expect(fitScore(JOBS[2] as FeedJob, profile)).toBe(63);
    expect(fitScore(JOBS[1] as FeedJob, profile)).toBe(0);
  });

  it("goes easy on openings that say little about skills", () => {
    // a matching title alone is a hint, not proof
    expect(fitScore(job({ title: "Data Analyst", skills: ["SQL"] }), profile)).toBe(55);
    expect(fitScore(job({ title: "Office Manager" }), profile)).toBe(0);
  });

  it("turns a score into words", () => {
    expect([fitLabel(82), fitLabel(55), fitLabel(35), fitLabel(10), fitLabel(null)]).toEqual(["Great fit", "Good fit", "Possible fit", null, null]);
  });
});

describe("searchJobs", () => {
  const profile = profileResume(RESUME, SKILLS);

  it("filters by keyword, place, remote, internships and age", () => {
    expect(searchJobs(JOBS, { ...ANY, query: "data analyst" }, null).map((result) => result.id)).toEqual(["c", "e", "a"]);
    expect(searchJobs(JOBS, { ...ANY, location: "austin" }, null).map((result) => result.id)).toEqual(["c"]);
    expect(searchJobs(JOBS, { ...ANY, remoteOnly: true }, null).map((result) => result.id)).toEqual(["b"]);
    expect(searchJobs(JOBS, { ...ANY, internOnly: true }, null).map((result) => result.id)).toEqual(["e"]);
    expect(searchJobs(JOBS, { ...ANY, days: 100_000 }, null).map((result) => result.id)).not.toContain("d");
  });

  it("puts the best fits first when there is a resume, and the newest first otherwise", () => {
    expect(searchJobs(JOBS, ANY, profile).map((result) => [result.id, result.fit])).toEqual([
      ["a", 100],
      ["e", 75],
      ["c", 63],
      ["b", 0],
      ["d", 0],
    ]);
    expect(searchJobs(JOBS, ANY, null).map((result) => result.id)).toEqual(["c", "b", "e", "a", "d"]);
    expect(searchJobs(JOBS, ANY, null)[0]?.fit).toBeNull();
  });

  it("shows a role once even when it is posted in several cities, and does not let one company fill the page", () => {
    const repeats = ["Austin", "Denver", "Boston"].map((city, index) => job({ id: `r${index}`, title: "Data Analyst", location: city }));
    expect(searchJobs(repeats, ANY, null)).toHaveLength(1);
    const many = Array.from({ length: 20 }, (_, index) => job({ id: `m${index}`, title: `Analyst ${index}` }));
    expect(searchJobs(many, ANY, null)).toHaveLength(6);
  });
});

describe("the company list", () => {
  it("is wide, has no repeats and gives every company a website for its logo", () => {
    expect(BOARDS.length).toBeGreaterThan(140);
    const keys = BOARDS.map((board) => `${board.source}:${board.token}`);
    expect(new Set(keys).size).toBe(keys.length);
    for (const board of BOARDS) expect(board.domain).toMatch(/^[a-z0-9-]+(\.[a-z0-9-]+)+$/);
  });
});
