import { AlignmentType, Document, Packer, Paragraph, TextRun } from "docx";
import { paragraphs, structureResume } from "@/lib/export/structure";

// page setup that scanners read well: letter size, one inch margins, one common font
const PAGE = { size: { width: 12240, height: 15840 }, margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 } };
const STYLES = { default: { document: { run: { font: "Calibri", size: 22 } } } };

// turns a document into file bytes
async function pack(children: Paragraph[]): Promise<Uint8Array> {
  const doc = new Document({ styles: STYLES, sections: [{ properties: { page: PAGE }, children }] });
  return new Uint8Array(await Packer.toBuffer(doc));
}

// a single column word file of a resume, with real headings and real bullets
export async function resumeDocx(text: string): Promise<Uint8Array> {
  const resume = structureResume(text);
  const children: Paragraph[] = [
    new Paragraph({ children: [new TextRun({ text: resume.name, bold: true, size: 32 })], spacing: { after: 60 } }),
    ...resume.contact.map((line) => new Paragraph({ text: line })),
  ];
  for (const section of resume.sections) {
    if (section.heading) {
      children.push(new Paragraph({ children: [new TextRun({ text: section.heading, bold: true, size: 24 })], spacing: { before: 240, after: 80 }, border: { bottom: { style: "single", size: 6, color: "999999" } } }));
    }
    for (const line of section.lines) {
      children.push(line.bullet ? new Paragraph({ text: line.text, bullet: { level: 0 } }) : new Paragraph({ text: line.text, spacing: { before: 60 } }));
    }
  }
  return pack(children);
}

// a word file of a letter, one paragraph per block of text
export async function letterDocx(text: string): Promise<Uint8Array> {
  return pack(paragraphs(text).map((block) => new Paragraph({ alignment: AlignmentType.LEFT, spacing: { after: 200 }, children: block.split("\n").flatMap((line, index) => [new TextRun({ text: line, break: index > 0 ? 1 : 0 })]) })));
}
