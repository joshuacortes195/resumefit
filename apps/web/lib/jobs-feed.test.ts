import { describe, expect, it } from "vitest";
import { BOARDS } from "./job-boards";
import { fitLabel, fitScore, htmlToText, profileResume, searchJobs, yearsWanted, type FeedJob } from "./jobs-feed";

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
    // every skill and the same title, but only three skills to go on
    expect(fitScore(JOBS[0] as FeedJob, profile)).toBe(83);
    // half the skills and a close title
    expect(fitScore(JOBS[2] as FeedJob, profile)).toBe(65);
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

// a student with one internship behind them
const JUNIOR = `Alex Kim
Pomona, CA | alex@example.com

Education
B.S. Computer Science, State University, Expected 2027

Experience
Software Engineering Intern, Brightside Labs
Jun 2025 - Dec 2025
• Built internal tools in Python and TypeScript with React, used by 40 engineers
• Trained a machine learning model with PyTorch

Skills
Python, TypeScript, React, SQL, PyTorch, Machine Learning, Docker, Git
`;
const TECH = ["Python", "TypeScript", "React", "SQL", "PyTorch", "Machine Learning", "Docker", "Git", "Kubernetes", "Go", "Salesforce", "Contract Law"].map((name) => ({ name }));

describe("fitScore for someone early in their career", () => {
  const junior = profileResume(JUNIOR, TECH);
  // every one of these names skills the resume has, the way postings at an ai company all mention machine learning
  const intern = job({ title: "Software Engineer Intern", intern: true, skills: ["Python", "TypeScript", "React", "SQL", "Git", "Docker", "Kubernetes"] });
  const staff = job({ title: "Staff Software Engineer, Frontend", skills: ["Python", "TypeScript", "React", "SQL", "Git", "Docker", "Kubernetes"] });
  const sales = job({ title: "Senior Account Executive", skills: ["Machine Learning", "Python", "SQL", "Salesforce"] });
  const lawyer = job({ title: "Commercial Counsel", skills: ["Machine Learning", "Python", "SQL"] });
  const fit = (opening: FeedJob) => fitScore(opening, junior);

  it("reads the level and kind of work off the resume", () => {
    expect(junior.years).toBeLessThan(1);
    expect([...junior.kinds]).toEqual(["tech"]);
  });

  it("puts the internship first, the staff role well below it, and unrelated roles at the bottom", () => {
    expect(fit(intern)).toBeGreaterThan(fit(staff));
    expect(fit(staff)).toBeGreaterThan(fit(sales));
    expect(fit(staff)).toBeGreaterThan(fit(lawyer));
    const ranked = searchJobs([lawyer, sales, staff, intern].map((opening, index) => ({ ...opening, id: `j${index}`, company: `Co ${index}` })), ANY, junior);
    expect(ranked.map((result) => result.title).slice(0, 2)).toEqual([intern.title, staff.title]);
    expect([fit(intern), fit(staff), fit(sales), fit(lawyer)]).toEqual([90, 24, 8, 16]);
  });

  it("only calls the role that earns it a great fit, and spreads the rest out", () => {
    expect(fitLabel(fit(intern))).toBe("Great fit");
    expect(fitLabel(fit(staff))).not.toBe("Great fit");
    // matching every skill a sales or legal posting happens to name is not a fit
    expect(fitLabel(fit(sales))).toBeNull();
    expect(fitLabel(fit(lawyer))).toBeNull();
    expect(fit(intern) - fit(lawyer)).toBeGreaterThan(50);
  });

  it("takes more off the higher the title sits above the resume", () => {
    const skills = intern.skills;
    const scores = ["Software Engineer", "Senior Software Engineer", "Engineering Manager", "Staff Software Engineer", "Director of Engineering", "VP of Engineering"].map((title) => fitScore(job({ title, skills }), junior));
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
    expect(scores[0]).toBeGreaterThan((scores[2] ?? 0) * 2);
    expect([yearsWanted("Lead Data Analyst"), yearsWanted("Principal Engineer"), yearsWanted("RVP Forward Deployed Engineering"), yearsWanted("Data Analyst")]).toEqual([5, 9, 12, null]);
  });

  it("does not hold a senior title against someone who has the years", () => {
    const veteran = profileResume(JUNIOR.replace("Jun 2025 - Dec 2025", "Jun 2015 - Dec 2025").replace("Expected 2027", "2015"), TECH);
    expect(fitScore(staff, veteran)).toBeGreaterThanOrEqual(70);
    // and an internship is a step back for them
    expect(fitScore(intern, veteran)).toBeLessThan(fitScore(staff, veteran));
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
      ["a", 83],
      ["c", 65],
      // an internship is a step back for someone with years of work
      ["e", 32],
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
