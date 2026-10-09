import { describe, expect, it } from "vitest";
import { letterDocx, resumeDocx } from "@/lib/export/docx";
import { letterPdf, resumePdf } from "@/lib/export/pdf";
import { structureResume } from "@/lib/export/structure";
import { readResumeFile } from "@/lib/files";

const RESUME = `Jordan Lee
Austin, TX | jordan.lee@example.com | (512) 555-0142

Summary
Frontend engineer who builds fast web apps with React and TypeScript.

Work Experience
Frontend Engineer, Acme Corp
Jan 2023 - Present
• Cut page load time by 40% by splitting the bundle and lazy loading routes across the whole customer dashboard
• Moved 30 screens to TypeScript

Education
B.S. Computer Science, State University, 2021
`;

describe("structureResume", () => {
  it("splits the name, contact lines, sections and bullets", () => {
    const doc = structureResume(RESUME);
    expect(doc.name).toBe("Jordan Lee");
    expect(doc.contact).toEqual(["Austin, TX | jordan.lee@example.com | (512) 555-0142"]);
    expect(doc.sections.map((section) => section.heading)).toEqual(["Summary", "Work Experience", "Education"]);
    expect(doc.sections[1]?.lines[2]).toEqual({ text: "Cut page load time by 40% by splitting the bundle and lazy loading routes across the whole customer dashboard", bullet: true });
  });
});

// an exported file should survive the trip back through our own reader, and pass our own formatting checks
describe("exported resumes", () => {
  for (const [format, build] of [
    ["pdf", resumePdf],
    ["docx", resumeDocx],
  ] as const) {
    it(`${format} reads back with the same content and a clean layout`, async () => {
      const { text, layout } = await readResumeFile(await build(RESUME), `Jordan-Lee-Resume.${format}`);
      expect(text).toContain("jordan.lee@example.com");
      expect(text).toContain("Work Experience");
      expect(text).toContain("• Cut page load time by 40% by splitting the bundle and lazy loading routes across the whole customer dashboard");
      expect(layout).toMatchObject({ fileType: format, columns: 1, hasTables: false, imageCount: 0, pageSize: "Letter" });
      expect(layout.margins?.left).toBeCloseTo(0.75, 1);
    });
  }
});

describe("exported letters", () => {
  const letter = "Dear Hiring Manager,\n\nI built the checkout flow at Acme.\n\nSincerely,\nJordan Lee";

  it("makes a pdf and a word file with the letter's text", async () => {
    const pdf = await letterPdf(letter);
    expect(new TextDecoder().decode(pdf.slice(0, 5))).toBe("%PDF-");
    const docx = await letterDocx(letter);
    // word files are zip archives
    expect([docx[0], docx[1]]).toEqual([0x50, 0x4b]);
  });
});
