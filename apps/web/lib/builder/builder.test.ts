import { parseResume, scanResume } from "@resumefit/scoring";
import { describe, expect, it } from "vitest";
import { builderFromParsed, builderLayoutMeta, builderToText, layOut } from "@/lib/builder/layout";
import { mendBuilder } from "@/lib/builder/mend";
import { TEMPLATES } from "@/lib/builder/templates";
import { builderDataSchema, defaultSettings, emptyBuilder, templateSettingsSchema, type BuilderData } from "@/lib/builder/types";

const TODAY = new Date(2026, 5, 15);

// a filled in builder used across the tests
function sample(): BuilderData {
  return builderDataSchema.parse({
    profile: { name: "Jordan Lee", title: "Frontend Engineer", email: "jordan.lee@example.com", phone: "(512) 555-0142", location: "Austin, TX", linkedin: "linkedin.com/in/jordanlee" },
    summary: "Frontend engineer who builds fast, accessible web apps.",
    experience: [
      { id: "a", title: "Frontend Engineer", company: "Acme Corp", location: "Austin, TX", start: "Jan 2023", end: "", current: true, bullets: ["Cut page load time by 40%", "Moved 30 screens to TypeScript", ""] },
      { id: "b", title: "Junior Developer", company: "Corner Studio", location: "", start: "Jun 2021", end: "Dec 2022", current: false, bullets: ["Built 12 client sites"] },
    ],
    skills: ["TypeScript", "React", " ", "CSS"],
    education: [{ id: "c", degree: "B.S.", field: "Computer Science", school: "State University", year: "2021" }],
    additional: { projects: [{ id: "d", name: "Trail Map", description: "Offline maps for hikers\nUsed by 2,000 people" }], certifications: ["AWS Cloud Practitioner"], languages: ["English", "Spanish"] },
  });
}

describe("builder data", () => {
  it("starts empty with a default look", () => {
    expect(emptyBuilder().experience).toEqual([]);
    expect(defaultSettings()).toEqual({ template: "classic", lineSpacing: 1.15, margins: 0.75, accent: "black" });
  });

  it("turns away settings that are not on offer", () => {
    expect(templateSettingsSchema.safeParse({ template: "fancy" }).success).toBe(false);
    expect(templateSettingsSchema.safeParse({ margins: 0.2 }).success).toBe(false);
  });
});

describe("builderToText", () => {
  const text = builderToText(sample(), "classic");

  it("writes a resume our own reader understands", () => {
    const parsed = parseResume(text, TODAY);
    expect(parsed.contact).toMatchObject({ name: "Jordan Lee", email: "jordan.lee@example.com", phone: "(512) 555-0142", location: "Austin, TX" });
    expect(parsed.sections.map((section) => section.kind)).toEqual(["summary", "experience", "skills", "education", "projects", "certifications", "languages"]);
    expect(parsed.experience.map((job) => [job.title, job.company])).toEqual([
      ["Frontend Engineer", "Acme Corp"],
      ["Junior Developer", "Corner Studio"],
    ]);
    expect(parsed.experience[0]?.dates?.end.present).toBe(true);
    expect(parsed.education[0]).toMatchObject({ level: "Bachelor's", school: "State University", graduationYear: 2021 });
  });

  it("leaves out empty bullets, empty skills and empty sections", () => {
    expect(text).toContain("TypeScript, React, CSS");
    expect(text).not.toContain("•\n");
    expect(text).not.toContain("Awards");
    expect(builderToText(emptyBuilder(), "classic")).toBe("");
  });

  it("follows the section order of the template", () => {
    const order = (template: string) => layOut(sample(), template).sections.map((section) => section.key);
    expect(order("student").slice(0, 3)).toEqual(["summary", "education", "projects"]);
    expect(order("technical").slice(0, 2)).toEqual(["summary", "skills"]);
  });

  it("passes every formatting and heading check in every template", () => {
    for (const template of TEMPLATES) {
      const settings = { ...defaultSettings(), template: template.id };
      const result = scanResume({
        resumeText: builderToText(sample(), template.id),
        jdText: "Frontend Engineer\nTypeScript and React",
        hardSkills: [],
        softSkills: [],
        layout: builderLayoutMeta(sample(), settings, 1),
        today: TODAY,
      });
      const failed = result.checks.filter((check) => !check.passed && (check.category === "formatting" || check.group === "headings" || check.group === "contact" || check.group === "dates")).map((check) => check.id);
      expect(failed, template.name).toEqual([]);
    }
  });
});

describe("builderFromParsed", () => {
  it("fills the builder from an existing resume and survives a round trip", () => {
    const original = builderToText(sample(), "classic");
    const rebuilt = builderFromParsed(parseResume(original, TODAY));
    expect(rebuilt.profile).toMatchObject({ name: "Jordan Lee", email: "jordan.lee@example.com", location: "Austin, TX", title: "Frontend Engineer" });
    expect(rebuilt.experience[0]).toMatchObject({ title: "Frontend Engineer", company: "Acme Corp", start: "Jan 2023", current: true, bullets: ["Cut page load time by 40%", "Moved 30 screens to TypeScript"] });
    expect(rebuilt.experience[1]).toMatchObject({ start: "Jun 2021", end: "Dec 2022", current: false });
    expect(rebuilt.skills).toEqual(["TypeScript", "React", "CSS"]);
    expect(rebuilt.education[0]).toMatchObject({ degree: "Bachelor's", field: "Computer Science", school: "State University", year: "2021" });
    expect(rebuilt.additional.certifications).toEqual(["AWS Cloud Practitioner"]);
    expect(rebuilt.additional.languages).toEqual(["English", "Spanish"]);
    expect(rebuilt.summary).toBe("Frontend engineer who builds fast, accessible web apps.");
  });

  it("keeps group labels out of the skills and a degree's focus out of its name", () => {
    const resume = [
      "Sam Rivera",
      "EDUCATION",
      "State University | Riverside, CA | Expected 2027",
      "B.S. Computer Science, Specialization in Machine Learning and Artificial Intelligence",
      "EXPERIENCE",
      "Software Engineering Intern\tDec 2025 - Present",
      "Ormond (Envira)\tPomona, CA",
      "• Built tools used on the line",
      "TECHNICAL SKILLS",
      "Languages: Python, C#, SQL",
      "Cloud, Data & Tools: AWS (S3, Lambda), Docker, Git",
      "Concepts:",
      "Machine Learning (ML), Data Structures & Algorithms",
    ].join("\n");
    const built = builderFromParsed(parseResume(resume, TODAY));
    // "Cloud" and "Data & Tools: AWS (S3" used to come out as skills
    expect(built.skills).toEqual(["Python", "C#", "SQL", "AWS (S3, Lambda)", "Docker", "Git", "Machine Learning (ML)", "Data Structures & Algorithms"]);
    expect(built.experience).toHaveLength(1);
    expect(built.experience[0]).toMatchObject({ title: "Software Engineering Intern", company: "Ormond (Envira)", location: "Pomona, CA" });
    expect(built.education[0]).toMatchObject({ degree: "Bachelor's", field: "Computer Science, Specialization in Machine Learning and Artificial Intelligence", school: "State University" });
    // and the preview shows the job once, with its company
    const laidOut = layOut(built, "classic");
    expect(laidOut.sections.find((section) => section.key === "experience")?.blocks.map((block) => (block.kind === "entry" ? block.title : ""))).toEqual(["Software Engineering Intern, Ormond (Envira)"]);
  });
});

// the files we hand out have to pass the same checks we run on everyone else's
describe("builder exports", async () => {
  const { builderPdf } = await import("@/lib/builder/export-pdf");
  const { builderDocx } = await import("@/lib/builder/export-docx");
  const { readResumeFile } = await import("@/lib/files");

  // a resume with as much body text as a real one, so headings are a small share of the page
  const full = (): BuilderData => {
    const data = sample();
    for (const job of data.experience) {
      job.bullets.push(
        "Worked with design and product every week to plan, build and ship features used by thousands of customers",
        "Wrote tests and reviewed code for a team of six, keeping the main branch green through two large migrations",
        "Tracked down slow database queries and trimmed report times from several seconds to well under one",
      );
    }
    return data;
  };

  for (const template of TEMPLATES) {
    it(`${template.name} exports a pdf and a word file that read back cleanly`, async () => {
      const settings = { ...defaultSettings(), template: template.id, accent: "navy" as const };
      for (const [format, bytes] of [
        ["pdf", await builderPdf(full(), settings)],
        ["docx", await builderDocx(full(), settings)],
      ] as const) {
        const { text, layout } = await readResumeFile(bytes, `Jordan-Lee-Resume.${format}`);
        const result = scanResume({ resumeText: text, jdText: "Frontend Engineer\nTypeScript and React", hardSkills: [], softSkills: [], layout, today: TODAY });
        // everything the person typed is in the file
        expect(result.resume.contact, `${template.name} ${format}`).toMatchObject({ name: "Jordan Lee", email: "jordan.lee@example.com" });
        expect(result.resume.experience.map((job) => job.title), `${template.name} ${format}`).toEqual(["Frontend Engineer", "Junior Developer"]);
        expect(text).toContain("Cut page load time by 40%");
        // and the layout is one a scanner can read
        const failed = result.checks.filter((check) => !check.passed && check.category === "formatting").map((check) => check.id);
        expect(failed, `${template.name} ${format}`).toEqual([]);
      }
    });
  }
});

describe("mending a builder resume the old reader filled in", () => {
  it("puts a split job back together, drops label leftovers and rejoins a skill cut at a comma", () => {
    const data = sample();
    data.experience = [
      { id: "a", title: "Software Engineering Intern", company: "", location: "", start: "Dec 2025", end: "", current: true, bullets: ["Built tools"] },
      // the company line, which had become a job of its own and lost its closing bracket
      { id: "b", title: "Ormond (Envira", company: "", location: "Pomona, CA", start: "", end: "", current: false, bullets: [] },
      { id: "c", title: "IT Technician", company: "Alta Business", location: "Riverside, CA", start: "May 2025", end: "Dec 2025", current: false, bullets: ["Supported 200 users"] },
    ];
    data.skills = ["Python", "Swing/AWT", "Cloud", "Data & Tools: AWS (S3", "Lambda)", "Docker"];
    const mended = mendBuilder(data);
    expect(mended.experience.map((job) => [job.title, job.company, job.location])).toEqual([
      ["Software Engineering Intern", "Ormond (Envira)", "Pomona, CA"],
      ["IT Technician", "Alta Business", "Riverside, CA"],
    ]);
    expect(mended.skills).toEqual(["Python", "Swing/AWT", "AWS (S3, Lambda)", "Docker"]);
  });

  it("leaves a healthy resume exactly as it is", () => {
    const data = sample();
    // a job with no company and no dates that really is its own job, because the one before it has a company
    data.experience.push({ id: "z", title: "Volunteer Tutor", company: "", location: "", start: "", end: "", current: false, bullets: [] });
    data.skills = ["TypeScript", "React", "AWS (S3, Lambda)", "CI/CD"];
    const mended = mendBuilder(data);
    expect(mended.experience.map((job) => job.title)).toEqual(data.experience.map((job) => job.title));
    expect(mended.skills).toEqual(data.skills);
  });
});
