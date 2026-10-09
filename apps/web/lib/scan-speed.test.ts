import { scanResume } from "@resumefit/scoring";
import { HARD_SKILLS, SOFT_SKILLS } from "@resumefit/skills-data";
import { describe, expect, it } from "vitest";
import { SAMPLE_JD, SAMPLE_RESUME } from "./sample-scan";

describe("scanning with the full skill list", () => {
  it("stays fast with thousands of skills to look for", () => {
    // a long posting and a long resume, about what a senior person would paste
    const jd = `${SAMPLE_JD}\n`.repeat(6);
    const resume = `${SAMPLE_RESUME}\n`.repeat(4);
    scanResume({ resumeText: resume, jdText: jd, hardSkills: HARD_SKILLS, softSkills: SOFT_SKILLS });
    const started = performance.now();
    for (let run = 0; run < 5; run++) scanResume({ resumeText: resume, jdText: jd, hardSkills: HARD_SKILLS, softSkills: SOFT_SKILLS });
    const each = (performance.now() - started) / 5;
    // the target is a scan in well under a second, with room to spare on a slow machine
    expect(each).toBeLessThan(400);
  });

  it("finds skills that only the big list knows", () => {
    const result = scanResume({ resumeText: SAMPLE_RESUME, jdText: "Designer\nYou will work in Adobe InDesign and AutoCAD every day, and keep our Airtable up to date.", hardSkills: HARD_SKILLS, softSkills: SOFT_SKILLS });
    expect(result.hardSkills.map((skill) => skill.name).sort()).toEqual(["Adobe InDesign", "Airtable", "Autodesk AutoCAD"]);
  });

  it("does not turn everyday words into skills", () => {
    const result = scanResume({ resumeText: SAMPLE_RESUME, jdText: "Office manager\nYou will connect with our team, direct visitors, access the building early and analyze what we could do better. Word gets around.", hardSkills: HARD_SKILLS, softSkills: SOFT_SKILLS });
    expect(result.hardSkills.map((skill) => skill.name)).toEqual([]);
  });
});
