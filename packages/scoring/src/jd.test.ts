import { describe, expect, it } from "vitest";
import { detectAts } from "./ats";
import { analyzeJd, findEducation, findJobTitle, findYearsRequired, stripIgnoredSections } from "./jd";

const JD = `Senior Data Analyst (Remote)
Northwind Health

About the role
We are hiring a Senior Data Analyst to help our care teams make better decisions.

Requirements
5+ years of experience in analytics
Bachelor's degree in Statistics, Economics or a related field
Strong SQL and Tableau skills

Preferred qualifications
Master's degree
2 years working with Python

Benefits
Health insurance, 401k match after 2 years and a learning budget for Python courses

Northwind Health is an equal opportunity employer.
Apply at https://boards.greenhouse.io/northwind/jobs/12345
`;

describe("findJobTitle", () => {
  it("takes the title from the first line and drops the extras", () => {
    expect(findJobTitle(JD).jobTitle).toBe("Senior Data Analyst");
  });

  it("reads a labelled title and company", () => {
    expect(findJobTitle("Company: Acme Corp\nJob Title: Staff Nurse - Night Shift\nWe care for patients.")).toEqual({ jobTitle: "Staff Nurse", company: "Acme Corp" });
  });

  it("splits title at company", () => {
    expect(findJobTitle("Frontend Engineer at Brightside Labs\nBuild things.")).toEqual({ jobTitle: "Frontend Engineer", company: "Brightside Labs" });
  });

  it("falls back to a looking for sentence", () => {
    expect(findJobTitle("About us\nWe make maps for everyone on the planet.\nWe are looking for a Product Designer to join us.").jobTitle).toBe("Product Designer");
  });

  it("gives up when nothing reads like a title", () => {
    expect(findJobTitle("Come work with us.\nWe have snacks.").jobTitle).toBeNull();
  });
});

describe("findYearsRequired", () => {
  it("uses the must have years, not the optional ones or the benefits", () => {
    expect(findYearsRequired(JD)).toBe(5);
  });

  it("reads ranges and number words", () => {
    expect(findYearsRequired("3-5 years of experience with React")).toBe(3);
    expect(findYearsRequired("At least three years of relevant experience")).toBe(3);
  });

  it("returns null when the posting does not say", () => {
    expect(findYearsRequired("Experience with React and TypeScript")).toBeNull();
  });
});

describe("findEducation", () => {
  it("splits required from preferred", () => {
    expect(findEducation(JD)).toEqual({ required: "Bachelor's", preferred: "Master's" });
  });

  it("takes the lower degree when either is fine", () => {
    expect(findEducation("Requirements\nBS or MS in Computer Science").required).toBe("Bachelor's");
  });

  it("does not read a state code as a degree", () => {
    expect(findEducation("This role is based in Boston, MA and needs a degree of care.").required).toBeNull();
  });
});

describe("stripIgnoredSections", () => {
  it("drops benefits and legal lines but keeps the job", () => {
    const kept = stripIgnoredSections(JD);
    expect(kept).toContain("Strong SQL and Tableau skills");
    expect(kept).not.toContain("learning budget");
    expect(kept).not.toContain("equal opportunity");
  });

  it("starts keeping lines again at the next job heading", () => {
    const kept = stripIgnoredSections("Perks\nFree lunch\nResponsibilities\nWrite Python");
    expect(kept).toContain("Write Python");
    expect(kept).not.toContain("Free lunch");
  });
});

describe("detectAts", () => {
  it("spots the system from a link in the text or the job url", () => {
    expect(analyzeJd(JD).ats?.name).toBe("Greenhouse");
    expect(detectAts("https://acme.wd5.myworkdayjobs.com/careers/job/123", "")?.id).toBe("workday");
    expect(detectAts("https://jobs.lever.co/acme/abc", "")?.tips.length).toBeGreaterThan(0);
  });

  it("returns null for an unknown site", () => {
    expect(detectAts("https://careers.example.com/jobs/1", "plain text")).toBeNull();
  });
});
