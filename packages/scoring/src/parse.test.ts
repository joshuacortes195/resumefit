import { describe, expect, it } from "vitest";
import {
  detectSections,
  extractContact,
  findDegreeLevels,
  highestDegree,
  isMeasurable,
  measurableResults,
  parseEducation,
  parseExperience,
  parseResume,
  wordCount,
} from "./parse";

// plain text resume used across the tests
const RESUME = `Jordan Lee
Austin, TX 78701 | jordan.lee@example.com | (512) 555-0142
linkedin.com/in/jordanlee | github.com/jordanlee | jordanlee.dev

SUMMARY
Software engineer who likes shipping small, fast web apps.

Where I've Worked
Software Engineer, Acme Corp
Jan 2023 - Present
• Cut page load time by 40% by splitting the bundle
• Mentored new hires on the team
- Shipped 12 features across 3 product areas

Education:
B.S. Computer Science, State University, 2022

Technical Skills
TypeScript, React, PostgreSQL
`;

describe("detectSections", () => {
  const sections = detectSections(RESUME);

  it("finds each section in order", () => {
    expect(sections.map((section) => section.kind)).toEqual(["summary", "experience", "education", "skills"]);
  });

  it("flags creative heading names", () => {
    const experience = sections.find((section) => section.kind === "experience");
    expect(experience).toMatchObject({ heading: "Where I've Worked", standard: false });
    expect(sections.find((section) => section.kind === "education")).toMatchObject({ heading: "Education", standard: true });
  });

  it("keeps the lines under the right heading", () => {
    expect(sections.find((section) => section.kind === "skills")?.lines).toEqual(["TypeScript, React, PostgreSQL"]);
  });

  it("does not treat a long sentence as a heading", () => {
    expect(detectSections("My experience includes many years of building software for banks")).toEqual([]);
  });
});

describe("extractContact", () => {
  const contact = extractContact(RESUME);

  it("finds the basics", () => {
    expect(contact.name).toBe("Jordan Lee");
    expect(contact.email).toBe("jordan.lee@example.com");
    expect(contact.phone).toBe("(512) 555-0142");
    expect(contact.location).toBe("Austin, TX 78701");
  });

  it("sorts links into linkedin, github and the rest", () => {
    expect(contact.linkedin).toBe("linkedin.com/in/jordanlee");
    expect(contact.github).toBe("github.com/jordanlee");
    expect(contact.links).toEqual(["jordanlee.dev"]);
  });

  it("returns nulls when nothing is there", () => {
    expect(extractContact("just some text\nwith no details")).toMatchObject({ email: null, phone: null, location: null, linkedin: null });
  });
});

describe("measurable results", () => {
  it("spots numbers, percents, dollars and quantity words", () => {
    expect(isMeasurable("Grew revenue by $2M")).toBe(true);
    expect(isMeasurable("Doubled signups in a quarter")).toBe(true);
    expect(isMeasurable("Worked closely with design")).toBe(false);
  });

  it("only counts bullets with a real result", () => {
    expect(measurableResults(detectSections(RESUME))).toEqual([
      "• Cut page load time by 40% by splitting the bundle",
      "- Shipped 12 features across 3 product areas",
    ]);
  });
});

describe("wordCount", () => {
  it("counts words across lines", () => {
    expect(wordCount("one two\nthree   four")).toBe(4);
  });
});

// a fixed "today" so Present always means the same month
const TODAY = new Date(2026, 5, 15);

describe("parseExperience", () => {
  it("reads title, company, dates and bullets", () => {
    const jobs = parseExperience(
      ["Software Engineer, Acme Corp", "Jan 2023 - Present", "• Cut page load time by 40%", "• Mentored new hires", "Junior Developer | Corner Studio | Austin, TX | Jun 2021 - Dec 2022", "- Built 12 client sites"],
      TODAY,
    );
    expect(jobs).toHaveLength(2);
    expect(jobs[0]).toMatchObject({ title: "Software Engineer", company: "Acme Corp", bullets: ["Cut page load time by 40%", "Mentored new hires"] });
    expect(jobs[0]?.dates?.end.present).toBe(true);
    expect(jobs[1]).toMatchObject({ title: "Junior Developer", company: "Corner Studio", location: "Austin, TX", bullets: ["Built 12 client sites"] });
  });

  it("works out which part is the title when the company comes first", () => {
    const [job] = parseExperience(["Brightside Labs — Product Manager", "03/2020 - 08/2022"], TODAY);
    expect(job).toMatchObject({ title: "Product Manager", company: "Brightside Labs" });
  });

  it("splits jobs that have no bullets", () => {
    const jobs = parseExperience(["Barista, Corner Cafe", "2019 - 2021", "Cashier, Fresh Mart", "2017 - 2019"], TODAY);
    expect(jobs.map((job) => job.title)).toEqual(["Barista", "Cashier"]);
  });

  it("keeps a job even when it has no dates", () => {
    const [job] = parseExperience(["Frontend Engineer, Acme Corp", "• Shipped things"], TODAY);
    expect(job).toMatchObject({ title: "Frontend Engineer", dates: null });
  });
});

describe("parseEducation", () => {
  it("reads the degree, field, school and year", () => {
    expect(parseEducation(["B.S. Computer Science, State University, 2021"])).toEqual([
      { level: "Bachelor's", field: "Computer Science", school: "State University", graduationYear: 2021 },
    ]);
  });

  it("handles a school on one line and the degree on the next", () => {
    const [entry] = parseEducation(["University of Texas at Austin", "Master of Science in Data Science, May 2023"]);
    expect(entry).toMatchObject({ level: "Master's", field: "Data Science", school: "University of Texas at Austin", graduationYear: 2023 });
  });

  it("splits two degrees and finds the highest", () => {
    const entries = parseEducation(["MBA, Stanford University, 2020", "BA Economics, Boston College, Boston, MA, 2014"]);
    expect(entries.map((entry) => entry.level)).toEqual(["MBA", "Bachelor's"]);
    expect(highestDegree(entries)).toBe("MBA");
  });

  it("does not mistake a state code for a degree", () => {
    expect(findDegreeLevels("Northeastern University, Boston, MA")).toEqual([]);
    expect(findDegreeLevels("Ph.D. in Physics")).toEqual(["PhD"]);
    expect(findDegreeLevels("Associate of Arts")).toEqual(["Associate"]);
  });
});

describe("parseResume", () => {
  it("pulls the whole resume together", () => {
    const parsed = parseResume(RESUME, TODAY);
    expect(parsed.experience[0]).toMatchObject({ title: "Software Engineer", company: "Acme Corp" });
    expect(parsed.education[0]?.level).toBe("Bachelor's");
    // jan 2023 to june 2026
    expect(parsed.yearsExperience).toBe(3.5);
    expect(parsed.measurableResults).toHaveLength(2);
  });

  it("leaves years empty when there are no dates", () => {
    expect(parseResume("Work Experience\nBarista, Corner Cafe\n• Made drinks", TODAY).yearsExperience).toBeNull();
  });
});
