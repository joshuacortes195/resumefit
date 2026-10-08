import { describe, expect, it } from "vitest";
import type { SkillMatch } from "@resumefit/shared";
import { checkScore, matchRate, scoreBand, skillScore, skillWeight } from "./score";

// quick helper to build a skill row
function skill(name: string, match: SkillMatch["match"], jdCount = 1, importance: SkillMatch["importance"] = "required"): SkillMatch {
  return { name, category: "hard", importance, jdCount, resumeCount: match === "missing" ? 0 : 1, match };
}

describe("skillWeight", () => {
  it("counts frequent and required skills more", () => {
    expect(skillWeight({ jdCount: 1, importance: "preferred" })).toBe(1);
    expect(skillWeight({ jdCount: 4, importance: "preferred" })).toBe(3);
    expect(skillWeight({ jdCount: 1, importance: "required" })).toBe(1.5);
  });
});

describe("skillScore", () => {
  it("is 1 when every skill is found", () => {
    expect(skillScore([skill("React", "exact"), skill("SQL", "exact")])).toBe(1);
  });

  it("is 0 when every skill is missing", () => {
    expect(skillScore([skill("React", "missing"), skill("SQL", "missing")])).toBe(0);
  });

  it("gives half credit for a similar term", () => {
    expect(skillScore([skill("OOD", "related")])).toBe(0.5);
  });

  it("hurts more to miss a skill the job repeats a lot", () => {
    const missRare = skillScore([skill("React", "exact", 8), skill("Jira", "missing", 1)]);
    const missCommon = skillScore([skill("React", "missing", 8), skill("Jira", "exact", 1)]);
    expect(missRare).toBeGreaterThan(missCommon);
  });
});

describe("checkScore", () => {
  it("is the share of passed checks", () => {
    expect(checkScore([{ passed: true }, { passed: false }, { passed: true }, { passed: true }])).toBe(0.75);
  });
});

describe("matchRate", () => {
  it("is 100 for a perfect resume and 0 for an empty one", () => {
    expect(matchRate({ hardSkills: 1, softSkills: 1, searchability: 1, recruiterTips: 1, formatting: 1 })).toBe(100);
    expect(matchRate({ hardSkills: 0, softSkills: 0, searchability: 0, recruiterTips: 0, formatting: 0 })).toBe(0);
  });

  it("lands a tailored resume around 75 to 85", () => {
    const rate = matchRate({ hardSkills: 0.75, softSkills: 0.7, searchability: 0.9, recruiterTips: 0.85, formatting: 0.95 });
    expect(rate).toBeGreaterThanOrEqual(75);
    expect(rate).toBeLessThanOrEqual(85);
  });

  it("lands a generic resume around 30 to 50", () => {
    const rate = matchRate({ hardSkills: 0.2, softSkills: 0.3, searchability: 0.6, recruiterTips: 0.6, formatting: 0.9 });
    expect(rate).toBeGreaterThanOrEqual(30);
    expect(rate).toBeLessThanOrEqual(50);
  });
});

describe("scoreBand", () => {
  it("maps scores to gauge colors", () => {
    expect(scoreBand(80)).toBe("good");
    expect(scoreBand(55)).toBe("okay");
    expect(scoreBand(20)).toBe("low");
  });
});
