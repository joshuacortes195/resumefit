import { describe, expect, it } from "vitest";
import { parseResume } from "@resumefit/scoring";
import { atsView } from "./ats-view";

const GOOD = `Riley Chen
Portland, OR | riley.chen@example.com | (503) 555-0177 | linkedin.com/in/rileychen

Work Experience
Frontend Engineer, Lakeside Outfitters
Mar 2022 - Present
• Rebuilt the checkout in React and TypeScript, cutting drop off by 18%

Education
B.S. Computer Science, State University, 2021
`;

describe("what the applicant system sees", () => {
  it("lays a clean resume out as a form with nothing flagged", () => {
    const view = atsView(parseResume(GOOD, new Date(2026, 10, 14)));
    expect(view.problems).toBe(0);
    expect(view.groups.map((group) => group.title)).toEqual(["Contact", "Job 1", "School 1"]);
    const value = (group: number, label: string) => view.groups[group]?.fields.find((entry) => entry.label === label)?.value;
    expect([value(0, "Name"), value(0, "Email"), value(0, "Location")]).toEqual(["Riley Chen", "riley.chen@example.com", "Portland, OR"]);
    expect([value(1, "Job title"), value(1, "Company"), value(1, "Dates"), value(1, "Bullet points")]).toEqual(["Frontend Engineer", "Lakeside Outfitters", "Mar 2022 - Present", "1"]);
    expect([value(2, "School"), value(2, "Degree"), value(2, "Graduation year")]).toEqual(["State University", "Bachelor's", "2021"]);
  });

  it("flags what could not be read, and says how to fix it", () => {
    const view = atsView(parseResume("Some Person\n\nSkills\nReact, TypeScript\n", new Date(2026, 10, 14)));
    const problems = view.groups.flatMap((group) => group.fields.filter((entry) => entry.problem).map((entry) => `${group.title}: ${entry.label}`));
    expect(problems).toEqual(expect.arrayContaining(["Contact: Email", "Contact: Phone", "Work experience: Jobs", "Education: Schools"]));
    expect(view.problems).toBe(problems.length);
    // a missing linkedin link is not a problem, plenty of people have none
    expect(problems).not.toContain("Contact: LinkedIn");
  });

  it("flags a job with no dates", () => {
    const view = atsView(parseResume(GOOD.replace("Mar 2022 - Present\n", ""), new Date(2026, 10, 14)));
    expect(view.groups[1]?.fields.find((entry) => entry.label === "Dates")?.problem).toMatch(/Mar 2022 - Present/);
  });
});
