import { describe, expect, it } from "vitest";
import { applyAlternatives, findAlternativeGroups } from "./groups";
import { matchSkills, type SkillTerm } from "./match";
import { scanResume } from "./scan";
import { lightScale, skillScore } from "./score";
import { categoryTools, companyProducts, isNoise, stem, stemCount, stemWords } from "./wording";

// the cases where the report used to call something missing that a person reading the posting would not

const LANGUAGES: SkillTerm[] = ["Java", "Python", "C++", "C#", "Go", "Rust", "TypeScript"].map((name) => ({ name }));
const DEGREES: SkillTerm[] = ["Computer science", "Computer engineering", "Data science", "Information systems"].map((name) => ({ name }));

// matches the rows and then applies the "any one of" lists, like a scan does
function rowsFor(jd: string, resume: string, skills: SkillTerm[], category: "hard" | "soft" = "hard") {
  return applyAlternatives(matchSkills(jd, resume, skills, category), findAlternativeGroups(jd, skills), resume);
}

describe("any one of lists", () => {
  it("treats a list joined by or as a choice, so one match covers it", () => {
    const rows = rowsFor("Demonstrated experience with at least one general-purpose programming language such as Java, Python, C++, C#, Go, Rust, or TypeScript", "Python and Java", LANGUAGES);
    expect(rows.filter((row) => row.match === "missing")).toEqual([]);
    expect(rows.map((row) => row.name).sort()).toEqual(["Java", "Python"]);
  });

  it("picks up the choice words people use", () => {
    for (const lead of ["one of", "one or more of", "such as", "any of"]) {
      const rows = rowsFor(`Experience with ${lead} Java, Rust and Go`, "Java", LANGUAGES);
      expect(rows.map((row) => row.name)).toEqual(["Java"]);
    }
  });

  it("reads a block of choices on the lines under one or more of the following", () => {
    const jd = "Preferred\n- Experience with one or more of the following:\n- o Rust\n- o Go\n- o Java\n- Strong C++ skills";
    const rows = rowsFor(jd, "Java", LANGUAGES);
    expect(rows.map((row) => [row.name, row.match])).toEqual([
      ["C++", "missing"],
      ["Java", "exact"],
    ]);
  });

  it("keeps a list where every skill is needed when it is joined by and", () => {
    const rows = rowsFor("You will write Java, Rust and Go every day", "Java", LANGUAGES);
    expect(rows.filter((row) => row.match === "missing").map((row) => row.name).sort()).toEqual(["Go", "Rust"]);
  });

  it("splits one skill's weight across a list nobody on the resume covers", () => {
    const rows = rowsFor("Experience with Rust, Go, or C++", "Python", LANGUAGES);
    expect(rows).toHaveLength(3);
    expect(rows.find((row) => row.name === "Go")?.options).toEqual(["Rust", "C++"]);
    // one list of three missing skills weighs the same as one missing skill
    const lone = matchSkills("Experience with Rust", "Python", LANGUAGES, "hard");
    expect(skillScore([...rows, { name: "Python", category: "hard", importance: "required", jdCount: 1, resumeCount: 1, match: "exact" }])).toBeCloseTo(
      skillScore([...lone, { name: "Python", category: "hard", importance: "required", jdCount: 1, resumeCount: 1, match: "exact" }]),
    );
  });

  it("still asks for a skill the posting also names on its own", () => {
    const rows = rowsFor("Must know Go.\nNice: Java, Go, or Rust", "Java", LANGUAGES);
    expect(rows.find((row) => row.name === "Go")?.match).toBe("missing");
  });

  it("carries a list past items that are not skills, like Bare-Metal", () => {
    const rows = rowsFor("Experience with C++, Embedded Development, Firmware, Rust, ARM, Bare-Metal, or Kernel", "Rust", LANGUAGES);
    expect(rows.map((row) => row.name)).toEqual(["Rust"]);
  });
});

describe("lists with choices we do not know as skills", () => {
  it("treats one known skill inside an or list as one choice of many", () => {
    const rows = rowsFor("Experience with Networking: C, Rust, Hardware, Memory Management, Computer Architecture, or Operating Systems", "Python", LANGUAGES);
    const rust = rows.find((row) => row.name === "Rust");
    expect(rust?.options).toEqual(["C", "Hardware", "Memory Management", "Computer Architecture", "Operating Systems"]);
  });

  it("keeps a skill with a slash in it as one choice", () => {
    const rows = rowsFor("Experience with Rust, CI/CD, or Go", "Python", [...LANGUAGES, { name: "CI/CD" }]);
    expect(rows.find((row) => row.name === "Rust")?.options).toEqual(["CI/CD", "Go"]);
  });

  it("counts a list as met when the resume covers a choice through the tools under it", () => {
    const jd = "Preferred\n- Experience with one or more of the following:\n- o Rust\n- o Version control systems\n- o Cloud platforms (preferably AWS)";
    expect(rowsFor(jd, "Git and GitHub every day", LANGUAGES)).toEqual([]);
    expect(rowsFor(jd, "Python", LANGUAGES).map((row) => row.name)).toEqual(["Rust"]);
  });
});

describe("accepted degree fields", () => {
  it("passes when the resume matches one of the fields", () => {
    const jd = "Currently enrolled in Bachelor's degree or above in Computer Science, Computer Engineering, Data Science, Information Systems, or related STEM fields";
    const rows = rowsFor(jd, "B.S. Computer Science", DEGREES);
    expect(rows.map((row) => row.name)).toEqual(["Computer science"]);
  });

  it("reads a comma list in a degree line as a choice even without or", () => {
    const rows = rowsFor("Degree in Computer Science, Computer Engineering, Data Science", "Data Science major", DEGREES);
    expect(rows.map((row) => row.name)).toEqual(["Data science"]);
  });
});

describe("soft skill weighting", () => {
  const SOFT: SkillTerm[] = [{ name: "Problem solving", aliases: ["problem-solving"] }, { name: "Analytical skills", aliases: ["analytical"] }, { name: "Troubleshooting" }];

  it("marks soft skills in filler or in the nice to haves as light", () => {
    const jd = "Responsibilities\n• Troubleshooting and resolving production issues\nPreferred Qualifications\n• Strong problem-solving and analytical skills";
    const rows = matchSkills(jd, "", SOFT, "soft");
    expect(Object.fromEntries(rows.map((row) => [row.name, row.light ?? false]))).toEqual({ "Problem solving": true, "Analytical skills": true, Troubleshooting: false });
  });

  it("marks a soft skill light when it only shows up in a long paragraph of company pitch", () => {
    const pitch = `About us\nWe love problem solving here. Our teams ship every week. We work on hard things together. ${"We grow fast and care a lot about customers. ".repeat(4)}`;
    expect(matchSkills(pitch, "", SOFT, "soft")[0]?.light).toBe(true);
  });

  it("shrinks how much a soft skills part made of filler moves the match rate", () => {
    const rows = matchSkills("Preferred\n• Strong problem-solving and analytical skills", "", SOFT, "soft");
    expect(lightScale(rows)).toBeCloseTo(0.25);
  });

  it("counts fewer soft skill gaps in a scan", () => {
    const jd = "Software Engineer\nResponsibilities\n• Troubleshooting production issues\nPreferred Qualifications\n• Strong problem-solving and analytical skills";
    const result = scanResume({ resumeText: "Sam Rivera\nExperience\nEngineer, Acme\n2024 - 2025\n• Built things", jdText: jd, hardSkills: [], softSkills: SOFT });
    expect(result.softSkills).toHaveLength(3);
    expect(result.issuesToFix.softSkills).toBe(1);
  });
});

describe("word endings", () => {
  it("cuts words to the same root", () => {
    expect(["owned", "owns", "ownership", "own"].map(stem)).toEqual(["own", "own", "own", "own"]);
    expect(stem("structures")).toBe(stem("structure"));
    expect(stem("algorithms")).toBe(stem("algorithm"));
    expect(stem("debugging")).toBe(stem("debugged"));
  });

  it("matches Owned to Ownership and plurals to singulars", () => {
    const resume = stemWords("Owned the release. Data Structures and Algorithms.");
    expect(stemCount({ name: "Ownership" }, resume)).toBe(1);
    expect(stemCount({ name: "data structure implementation" }, resume)).toBe(1);
    expect(stemCount({ name: "Basic algorithm development" }, resume)).toBe(1);
  });

  it("does not let a broad phrase shrink down to one broad word", () => {
    expect(stemCount({ name: "Software development" }, stemWords("I wrote software"))).toBe(0);
    expect(stemCount({ name: "Go" }, stemWords("go to market"))).toBe(0);
  });

  it("gives the row an exact match through a different ending", () => {
    const [row] = matchSkills("Strong ownership of your work", "Owned the launch end to end", [{ name: "Ownership" }], "soft");
    expect(row).toMatchObject({ match: "exact", resumeCount: 1 });
  });
});

describe("phrase noise", () => {
  it("never lists generic posting phrases as hard skills", () => {
    expect(isNoise("general-purpose programming language")).toBe(true);
    expect(isNoise("Design and development")).toBe(true);
    expect(isNoise("Python")).toBe(false);
    const rows = matchSkills("A general-purpose programming language and design and development work", "", [{ name: "general-purpose programming language" }, { name: "Design and development" }], "hard");
    expect(rows).toEqual([]);
  });
});

describe("category phrases", () => {
  it("knows the tools under a broad phrase", () => {
    expect(categoryTools("Front-end frameworks")?.map((tool) => tool.name)).toContain("React");
    expect(categoryTools("Python")).toBeNull();
  });

  it("passes a broad phrase when the resume lists a tool under it", () => {
    const skills: SkillTerm[] = [{ name: "Frontend frameworks" }, { name: "Cloud infrastructure" }, { name: "Storage systems" }, { name: "Databases" }];
    const rows = matchSkills("Experience with frontend frameworks, cloud infrastructure, storage systems and databases", "React, Next.js, AWS S3, AWS Lambda, PostgreSQL", skills, "hard");
    expect(rows.map((row) => row.match)).toEqual(["exact", "exact", "exact", "exact"]);
  });
});

describe("company products and culture lines", () => {
  it("reads the company's own product names", () => {
    expect(companyProducts("You will build on Anduril's Lattice OS every day.", "Anduril Industries")).toEqual(["lattice os"]);
  });

  it("leaves the company's products and culture lines out of the missing skills", () => {
    const jd = "2027 Software Engineer Intern, Anduril Industries\nRequirements\n• Python and C++\n• Build features on Anduril's Lattice OS\n• A bias for action, high ownership and a low-ego, mission oriented attitude";
    const result = scanResume({
      resumeText: "Sam Rivera\nExperience\nEngineer, Acme\n2024 - 2025\n• Built things in Python",
      jdText: jd,
      hardSkills: [{ name: "Python" }, { name: "C++" }],
      softSkills: [{ name: "Ownership" }],
      hints: { hardSkills: ["Lattice OS"], softSkills: ["bias for action", "low-ego", "mission oriented"] },
    });
    expect(result.jobTitle).toBe("Software Engineer Intern");
    expect(result.hardSkills.map((row) => row.name).sort()).toEqual(["C++", "Python"]);
    expect(result.softSkills).toEqual([]);
  });
});
