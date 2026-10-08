import { describe, expect, it } from "vitest";
import { scanResume } from "@resumefit/scoring";
import { HARD_SKILLS, SOFT_SKILLS } from "@resumefit/skills-data";
import { SAMPLE_JD, SAMPLE_JOB_TITLE, SAMPLE_RESUME } from "./sample-scan";

describe("sample scan", () => {
  const result = scanResume({ resumeText: SAMPLE_RESUME, jdText: SAMPLE_JD, jobTitle: SAMPLE_JOB_TITLE, hardSkills: HARD_SKILLS, softSkills: SOFT_SKILLS });

  it("lands in the middle so there is something to fix", () => {
    expect(result.matchRate).toBeGreaterThanOrEqual(40);
    expect(result.matchRate).toBeLessThan(85);
  });

  it("shows a mix of found, missing and nice to have skills", () => {
    const byName = Object.fromEntries(result.hardSkills.map((skill) => [skill.name, skill]));
    expect(byName["React"]).toMatchObject({ match: "exact", importance: "required" });
    expect(byName["TypeScript"]).toMatchObject({ match: "missing", importance: "required" });
    expect(byName["GraphQL"]).toMatchObject({ match: "missing", importance: "preferred" });
  });

  it("flags the creative heading and the missing job title", () => {
    const failed = result.checks.filter((check) => !check.passed).map((check) => check.id);
    expect(failed).toContain("experience-heading");
    expect(failed).toContain("job-title");
  });
});
