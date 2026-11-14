import { describe, expect, it } from "vitest";
import { checkEligibility } from "./eligibility";

const verdicts = (text: string, profile = {}) => Object.fromEntries(checkEligibility(text, profile).map((item) => [item.rule, item.verdict]));

describe("can you apply", () => {
  it("says nothing about a posting that sets no rules", () => {
    expect(checkEligibility("Build web apps with React. Work with a friendly team. We sponsor visas for the right person.")).toEqual([]);
  });

  it("compares a citizenship rule with the profile, and counts a permanent resident as a US person", () => {
    const jd = "Requirements\nMust be a U.S. citizen.\nBachelor's degree.";
    expect(verdicts(jd)).toEqual({ citizenship: "check" });
    expect(verdicts(jd, { workAuthorization: "US citizen" })).toEqual({ citizenship: "ok" });
    expect(verdicts(jd, { workAuthorization: "Permanent resident" })).toEqual({ citizenship: "problem" });
    const itar = "This position requires access to ITAR controlled data, so you must be a U.S. person.";
    expect(verdicts(itar, { workAuthorization: "Permanent resident" })).toEqual({ citizenship: "ok" });
    expect(verdicts(itar, { workAuthorization: "Work visa" })).toEqual({ citizenship: "problem" });
    expect(checkEligibility(jd)[0]?.quote).toBe("Must be a U.S. citizen.");
  });

  it("flags a clearance, and a sponsorship rule in the ways postings word it", () => {
    expect(verdicts("Active Secret clearance required.", { workAuthorization: "US citizen" })).toEqual({ clearance: "check" });
    expect(verdicts("Ability to obtain a security clearance.", { workAuthorization: "Work visa" })).toEqual({ clearance: "problem" });
    for (const line of ["We are unable to sponsor visas for this role.", "This role does not offer visa sponsorship.", "Must be authorized to work in the US without sponsorship.", "No sponsorship available."]) {
      expect(verdicts(line, { needsSponsorship: true }), line).toEqual({ sponsorship: "problem" });
      expect(verdicts(line, { needsSponsorship: false }), line).toEqual({ sponsorship: "ok" });
    }
    expect(verdicts("We are unable to sponsor visas for this role.")).toEqual({ sponsorship: "check" });
  });

  it("checks a graduation window against the graduation year", () => {
    const jd = "Currently pursuing a degree, graduating between December 2026 and June 2027.";
    expect(verdicts(jd, { graduationYear: "2027" })).toEqual({ graduation: "ok" });
    expect(verdicts(jd, { graduationYear: "2025" })).toEqual({ graduation: "problem" });
    expect(verdicts(jd)).toEqual({ graduation: "check" });
    expect(checkEligibility("Expected graduation date of May 2027.", { graduationYear: "2028" })[0]).toMatchObject({ verdict: "problem", text: "This role wants a graduation date in 2027, and yours is 2028." });
  });

  it("points out in person work and relocation", () => {
    expect(verdicts("This is an onsite role in Costa Mesa, CA.")).toEqual({ onsite: "check" });
    expect(verdicts("We work 3 days a week in the office.")).toEqual({ onsite: "check" });
    expect(verdicts("Must be willing to relocate to Seattle.", { willingToRelocate: false })).toEqual({ relocation: "problem" });
    expect(verdicts("Must be willing to relocate to Seattle.", { willingToRelocate: true })).toEqual({ relocation: "ok" });
  });
});
