import { describe, expect, it } from "vitest";
import { countSkills, matchSkills, type SkillTerm } from "./match";

// small skill list for the tests
const SKILLS: SkillTerm[] = [
  { name: "C" },
  { name: "C++" },
  { name: "C#" },
  { name: "Go", aliases: ["Golang"] },
  { name: "Excel", aliases: ["Microsoft Excel"] },
  { name: "Node.js", aliases: ["NodeJS", "Node"] },
  { name: "Kubernetes", aliases: ["k8s"] },
  { name: "SQL" },
  { name: "PostgreSQL", aliases: ["Postgres"], related: ["SQL"] },
  { name: "Object-oriented design", aliases: ["OOD"], related: ["object oriented programming", "OOP"] },
];

describe("countSkills", () => {
  it("keeps C, C++ and C# apart", () => {
    const counts = countSkills("We use C++ and C# daily, plus some C.", SKILLS);
    expect(counts.get("C++")).toBe(1);
    expect(counts.get("C#")).toBe(1);
    expect(counts.get("C")).toBe(1);
  });

  it("does not find Excel inside excellent", () => {
    expect(countSkills("Excellent communicator with excellent results", SKILLS).has("Excel")).toBe(false);
    expect(countSkills("Advanced Excel and Microsoft Excel macros", SKILLS).get("Excel")).toBe(2);
  });

  it("only counts Go when it is written like the language", () => {
    expect(countSkills("We go above and beyond to go fast", SKILLS).has("Go")).toBe(false);
    expect(countSkills("Services written in Go (Golang)", SKILLS).get("Go")).toBe(2);
  });

  it("counts an alias toward the main skill without double counting", () => {
    const counts = countSkills("Node.js APIs, a Node worker and k8s deploys", SKILLS);
    expect(counts.get("Node.js")).toBe(2);
    expect(counts.get("Kubernetes")).toBe(1);
  });

  it("does not find SQL inside PostgreSQL", () => {
    const counts = countSkills("PostgreSQL tuning", SKILLS);
    expect(counts.get("PostgreSQL")).toBe(1);
    expect(counts.has("SQL")).toBe(false);
  });

  it("treats spaces and hyphens the same", () => {
    expect(countSkills("Strong object oriented design background", SKILLS).get("Object-oriented design")).toBe(1);
  });
});

describe("matchSkills", () => {
  const jd = "Looking for Go and Kubernetes experience. Go is our main language. PostgreSQL and object-oriented design are needed.";
  const resume = "Built Golang services. Wrote SQL reports. Studied OOP in school.";
  const rows = matchSkills(jd, resume, SKILLS, "hard");

  it("only lists skills the job description mentions", () => {
    expect(rows.map((row) => row.name).sort()).toEqual(["Go", "Kubernetes", "Object-oriented design", "PostgreSQL"]);
  });

  it("marks exact, related and missing skills", () => {
    const byName = Object.fromEntries(rows.map((row) => [row.name, row]));
    expect(byName["Go"]).toMatchObject({ match: "exact", jdCount: 2, resumeCount: 1 });
    expect(byName["PostgreSQL"]).toMatchObject({ match: "related", resumeCount: 0 });
    expect(byName["Object-oriented design"]).toMatchObject({ match: "related" });
    expect(byName["Kubernetes"]).toMatchObject({ match: "missing", resumeCount: 0 });
  });

  it("puts missing skills first and matched ones last", () => {
    expect(rows[0]?.name).toBe("Kubernetes");
    expect(rows.at(-1)?.name).toBe("Go");
  });
});
