import { detectSections, isBullet, stripBullet } from "@resumefit/scoring";

// a resume broken into the pieces a document is laid out from
export type ResumeDoc = {
  name: string;
  // the contact lines under the name
  contact: string[];
  sections: { heading: string; lines: { text: string; bullet: boolean }[] }[];
};

// splits plain resume text into a name, contact lines and sections
export function structureResume(text: string): ResumeDoc {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const sections = detectSections(text);
  // everything above the first heading is the name and contact block
  const firstHeading = sections[0] ? lines.findIndex((line) => line.replace(/:$/, "") === sections[0]?.heading) : -1;
  const top = firstHeading === -1 ? lines.slice(0, 1) : lines.slice(0, firstHeading);

  return {
    name: top[0] ?? "",
    contact: top.slice(1),
    sections:
      sections.length > 0
        ? sections.map((section) => ({ heading: section.heading, lines: section.lines.map((line) => ({ text: isBullet(line) ? stripBullet(line) : line.replace(/\t+/g, "  "), bullet: isBullet(line) })) }))
        : // no headings found, so everything after the first line goes in one block
          [{ heading: "", lines: lines.slice(1).map((line) => ({ text: isBullet(line) ? stripBullet(line) : line, bullet: isBullet(line) })) }],
  };
}

// a plain letter is just paragraphs
export function paragraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}
