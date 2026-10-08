import { describe, expect, it } from "vitest";
import { detectSections, extractContact, isMeasurable, measurableResults, wordCount } from "./parse";

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
