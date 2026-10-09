import { AlignmentType, Document, Packer, Paragraph, TabStopType, TextRun } from "docx";
import { layOut } from "@/lib/builder/layout";
import { getTemplate } from "@/lib/builder/templates";
import { ACCENTS, type BuilderData, type TemplateSettings } from "@/lib/builder/types";

// builds the word file of a resume from the builder, no tables or text boxes, so scanners read it top to bottom
export async function builderDocx(data: BuilderData, settings: TemplateSettings): Promise<Uint8Array> {
  const laid = layOut(data, settings.template);
  const template = getTemplate(settings.template);
  const accent = ACCENTS[settings.accent].slice(1);
  const font = template.font === "serif" ? "Times New Roman" : "Calibri";
  const margin = Math.round(settings.margins * 1440);
  // line spacing is measured in 240ths of a line
  const spacing = { line: Math.round(settings.lineSpacing * 240) };
  const alignment = template.header === "center" ? AlignmentType.CENTER : AlignmentType.LEFT;
  // where the dates sit, pushed to the right edge with a tab stop
  const rightEdge = 12240 - margin * 2;

  const children: Paragraph[] = [
    new Paragraph({ alignment, spacing, children: [new TextRun({ text: laid.name, bold: true, size: 40, color: accent })] }),
    ...(laid.headline ? [new Paragraph({ alignment, spacing, children: [new TextRun({ text: laid.headline, size: 24 })] })] : []),
    ...(laid.contact.length > 0 ? [new Paragraph({ alignment, spacing, text: laid.contact.join("  |  ") })] : []),
  ];

  for (const section of laid.sections) {
    const caps = template.heading === "caps";
    children.push(
      new Paragraph({
        spacing: { ...spacing, before: 240, after: 80 },
        border: template.heading === "rule" ? { bottom: { style: "single", size: 6, color: accent } } : template.heading === "bar" ? { left: { style: "single", size: 24, color: accent, space: 6 } } : undefined,
        children: [new TextRun({ text: caps ? section.title.toUpperCase() : section.title, bold: true, size: 24, color: accent })],
      }),
    );
    for (const [index, block] of section.blocks.entries()) {
      if (block.kind === "text") children.push(new Paragraph({ spacing, text: block.text }));
      else if (block.kind === "skills") children.push(new Paragraph({ spacing, text: block.items.join(", ") }));
      else if (block.kind === "list") children.push(...block.items.map((item) => new Paragraph({ spacing, text: item, bullet: { level: 0 } })));
      else {
        children.push(
          new Paragraph({
            spacing: { ...spacing, before: index === 0 ? 0 : 140 },
            tabStops: [{ type: TabStopType.RIGHT, position: rightEdge }],
            children: [new TextRun({ text: block.title, bold: true }), ...(block.right ? [new TextRun({ text: `\t${block.right}` })] : [])],
          }),
        );
        if (block.subtitle) children.push(new Paragraph({ spacing, children: [new TextRun({ text: block.subtitle, italics: true })] }));
        children.push(...block.bullets.map((text) => new Paragraph({ spacing, text, bullet: { level: 0 } })));
      }
    }
  }

  const doc = new Document({
    styles: { default: { document: { run: { font, size: template.font === "serif" ? 22 : 21 } } } },
    sections: [{ properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: margin, right: margin, bottom: margin, left: margin } } }, children }],
  });
  return new Uint8Array(await Packer.toBuffer(doc));
}
