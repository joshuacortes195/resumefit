import { describe, expect, it } from "vitest";
import { HARD_SKILLS, SOFT_SKILLS } from "./index";

// every name and alias across both lists, lowercased
const spellings = [...HARD_SKILLS, ...SOFT_SKILLS].flatMap((skill) => [skill.name, ...(skill.aliases ?? [])]).map((term) => term.toLowerCase());

describe("skill lists", () => {
  it("never uses the same spelling for two skills", () => {
    // a repeated spelling would make one mention count twice
    const repeats = spellings.filter((term, index) => spellings.indexOf(term) !== index);
    expect(repeats).toEqual([]);
  });

  it("points related terms at something readable", () => {
    for (const skill of [...HARD_SKILLS, ...SOFT_SKILLS]) {
      for (const term of skill.related ?? []) expect(term.trim().length).toBeGreaterThan(1);
    }
  });

  it("has a useful number of skills", () => {
    expect(HARD_SKILLS.length).toBeGreaterThan(5000);
    expect(SOFT_SKILLS.length).toBeGreaterThan(30);
  });
});
