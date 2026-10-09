import { describe, expect, it } from "vitest";
import { htmlToText, quickMatch, searchJobs, type FeedJob } from "./jobs-feed";

const SKILLS = [{ name: "SQL" }, { name: "Tableau" }, { name: "React" }, { name: "TypeScript", aliases: ["TS"] }];

// a made up opening
const job = (extra: Partial<FeedJob>): FeedJob => ({ id: "ashby:acme:1", title: "Data Analyst", company: "Acme", location: "Denver, CO", remote: false, url: "https://jobs.example.com/1", postedAt: "2026-10-01T00:00:00Z", description: "", ...extra });

const JOBS = [
  job({ id: "a", title: "Data Analyst", description: "You will use SQL and Tableau every day.", postedAt: "2026-09-01T00:00:00Z" }),
  job({ id: "b", title: "Frontend Engineer", description: "React and TypeScript.", remote: true, location: "Remote, US", postedAt: "2026-10-05T00:00:00Z" }),
  job({ id: "c", title: "Senior Data Analyst", company: "Northwind", description: "SQL, Tableau and React dashboards.", location: "Austin, TX", postedAt: "2026-10-07T00:00:00Z" }),
  job({ id: "d", title: "Office Manager", description: "", postedAt: null }),
];
const ANY = { query: "", location: "", remoteOnly: false, days: null, sort: "relevance" as const };

describe("htmlToText", () => {
  it("keeps paragraphs and bullets and drops the tags", () => {
    expect(htmlToText("<h3>Requirements</h3><ul><li>5+ years of SQL</li><li>Tableau &amp; Excel</li></ul><p>Apply&nbsp;today.</p>")).toBe("Requirements\n\n• 5+ years of SQL\n\n• Tableau & Excel\n\nApply today.");
  });

  it("handles html that arrives with its tags escaped", () => {
    expect(htmlToText("&lt;p&gt;We&#39;re hiring a &lt;strong&gt;Data Analyst&lt;/strong&gt;.&lt;/p&gt;")).toBe("We're hiring a Data Analyst.");
  });

  it("never lets a script through", () => {
    const cleaned = htmlToText('<p>Hello</p><script>alert("x")</script><img src=x onerror="alert(1)">');
    expect(cleaned).toBe("Hello");
  });
});

describe("searchJobs", () => {
  it("filters by keyword, place, remote and age", () => {
    expect(searchJobs(JOBS, { ...ANY, query: "data analyst" }, null).map((result) => result.id)).toEqual(["c", "a"]);
    expect(searchJobs(JOBS, { ...ANY, location: "austin" }, null).map((result) => result.id)).toEqual(["c"]);
    expect(searchJobs(JOBS, { ...ANY, remoteOnly: true }, null).map((result) => result.id)).toEqual(["b"]);
    // jobs with no date are left out when an age is asked for
    const recent = searchJobs(JOBS, { ...ANY, days: 100_000 }, null).map((result) => result.id);
    expect(recent).not.toContain("d");
    expect(searchJobs(JOBS, { ...ANY, query: "northwind" }, null)).toHaveLength(1);
  });

  it("ranks by fit when a resume is given, and by date otherwise", () => {
    const resume = { text: "Analyst who works in SQL and Tableau.", skills: SKILLS };
    const ranked = searchJobs(JOBS, ANY, resume);
    expect(ranked.map((result) => [result.id, result.match])).toEqual([
      ["a", 100],
      ["c", 67],
      ["b", 0],
      ["d", null],
    ]);
    expect(searchJobs(JOBS, { ...ANY, sort: "date" }, resume).map((result) => result.id)).toEqual(["c", "b", "a", "d"]);
    // results carry a short preview, not the whole description
    expect(ranked[0]?.snippet).toBe("You will use SQL and Tableau every day.");
    expect(ranked[0]).not.toHaveProperty("description");
  });
});

describe("quickMatch", () => {
  it("has nothing to say when the opening names no skills we know", () => {
    expect(quickMatch(job({ title: "Office Manager" }), "SQL", SKILLS)).toBeNull();
    // a bare title is not enough to go on, even when it names a skill
    expect(quickMatch(job({ title: "React Developer" }), "React", SKILLS)).toBeNull();
    expect(quickMatch(job({ title: "React Developer", description: "You will build things in React." }), "React", SKILLS)).toBe(100);
  });
});
