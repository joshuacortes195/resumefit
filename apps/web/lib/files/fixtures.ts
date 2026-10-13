// builds small resume files in memory for the tests, so no binary files live in the repo
import { deflateSync } from "node:zlib";
import { AlignmentType, Document, Footer, Header, ImageRun, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from "docx";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

// a one pixel png, used wherever a fixture needs an image
const PIXEL = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="), (char) => char.charCodeAt(0));

// the resume most fixtures are built from
export const JOBS = [
  {
    heading: "Software Engineer, Acme Corp",
    dates: "Jan 2023 - Present",
    bullets: [
      "Cut page load time by 40% by splitting the bundle and lazy loading routes across the whole customer dashboard",
      "Moved 30 screens to TypeScript with zero regressions",
      "Set up CI/CD that ships 15 releases a week",
    ],
  },
  {
    heading: "Junior Developer, Corner Studio",
    dates: "Jun 2021 - Dec 2022",
    bullets: ["Built responsive layouts for 12 client sites", "Fixed bugs and improved page speed on older projects"],
  },
];
export const CONTACT = "Austin, TX | jordan.lee@example.com | (512) 555-0142";

// draws lines of text down a pdf page, wrapping long ones the way a word processor would
function drawLines(page: PDFPage, font: PDFFont, lines: { text: string; size?: number; font?: PDFFont; indent?: number }[], x: number, top: number, width: number): number {
  let y = top;
  for (const line of lines) {
    const size = line.size ?? 11;
    const face = line.font ?? font;
    const left = x + (line.indent ?? 0);
    // break the text into rows that fit the width
    const words = line.text.split(" ");
    let row = "";
    for (const word of words) {
      const next = row ? `${row} ${word}` : word;
      if (face.widthOfTextAtSize(next, size) > width - (line.indent ?? 0) && row) {
        page.drawText(row, { x: left, y, size, font: face });
        y -= size * 1.3;
        row = word;
      } else row = next;
    }
    page.drawText(row, { x: left, y, size, font: face });
    y -= size * 1.5;
  }
  return y;
}

// a clean single column pdf, letter size with normal margins
export async function singleColumnPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const lines = [
    { text: "Jordan Lee", size: 18, font: bold },
    { text: CONTACT },
    { text: "Summary", font: bold },
    { text: "Software engineer who likes shipping small, fast web apps with React and TypeScript." },
    { text: "Work Experience", font: bold },
    ...JOBS.flatMap((job) => [{ text: job.heading, font: bold }, { text: job.dates }, ...job.bullets.map((bullet) => ({ text: `• ${bullet}`, indent: 12 }))]),
    { text: "Education", font: bold },
    { text: "B.S. Computer Science, State University, 2021" },
    { text: "Skills", font: bold },
    { text: "TypeScript, React, PostgreSQL, CI/CD" },
  ];
  drawLines(page, font, lines, 54, 730, 504);
  return doc.save();
}

// a sidebar on the left and the work history on the right, on an a4 page
export async function twoColumnPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const font = await doc.embedFont(StandardFonts.TimesRoman);
  const bold = await doc.embedFont(StandardFonts.TimesRomanBold);
  page.drawText("Jordan Lee", { x: 40, y: 790, size: 20, font: bold });
  const left = [
    { text: "Skills", font: bold },
    { text: "TypeScript" },
    { text: "React" },
    { text: "PostgreSQL" },
    { text: "CI/CD" },
    { text: "Education", font: bold },
    { text: "B.S. Computer Science" },
    { text: "State University, 2021" },
    { text: "Contact", font: bold },
    { text: "jordan.lee@example.com" },
    { text: "(512) 555-0142" },
    { text: "Austin, TX" },
  ];
  const right = [
    { text: "Work Experience", font: bold },
    ...JOBS.flatMap((job) => [{ text: job.heading, font: bold }, { text: job.dates }, ...job.bullets.map((bullet) => ({ text: `• ${bullet}` }))]),
  ];
  drawLines(page, font, left, 40, 750, 150);
  drawLines(page, font, right, 220, 750, 335);
  return doc.save();
}

// two pages with a logo, the same header and footer on each, tight margins and pale text
export async function messyPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Courier);
  const image = await doc.embedPng(PIXEL);
  for (let number = 1; number <= 2; number++) {
    const page = doc.addPage([612, 792]);
    page.drawImage(image, { x: 500, y: 700, width: 40, height: 40 });
    page.drawImage(image, { x: 550, y: 700, width: 40, height: 40 });
    page.drawText("Jordan Lee | jordan.lee@example.com", { x: 18, y: 770, size: 9, font });
    page.drawText(`Page ${number} of 2`, { x: 18, y: 20, size: 9, font });
    page.drawText("References available on request", { x: 200, y: 20, size: 9, font });
    const lines = [
      { text: number === 1 ? "Work Experience" : "More Experience" },
      ...JOBS.flatMap((job) => [{ text: job.heading }, { text: job.dates }, ...job.bullets.map((bullet) => ({ text: `• ${bullet}` }))]),
    ];
    const y = drawLines(page, font, lines, 18, 700, 470);
    page.drawText("hidden keywords kubernetes docker terraform", { x: 18, y: y - 20, size: 9, font, color: rgb(0.95, 0.95, 0.95) });
  }
  return doc.save();
}

// a pdf that is only a picture, like a scan
export async function scannedPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  page.drawImage(await doc.embedPng(PIXEL), { x: 0, y: 0, width: 612, height: 792 });
  return doc.save();
}

// paragraphs for the work history, with real word bullets
function jobParagraphs(): Paragraph[] {
  return JOBS.flatMap((job) => [
    new Paragraph({ children: [new TextRun({ text: job.heading, bold: true })] }),
    new Paragraph(job.dates),
    ...job.bullets.map((bullet) => new Paragraph({ text: bullet, bullet: { level: 0 } })),
  ]);
}

// turns a docx document into bytes
async function pack(doc: Document): Promise<Uint8Array> {
  return new Uint8Array(await Packer.toBuffer(doc));
}

// a plain word resume with contact details in the body
export async function plainDocx(): Promise<Uint8Array> {
  return pack(
    new Document({
      styles: { default: { document: { run: { font: "Calibri", size: 22 } } } },
      sections: [
        {
          properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 } } },
          children: [
            new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Jordan Lee", bold: true, size: 36 })] }),
            new Paragraph({ alignment: AlignmentType.CENTER, text: CONTACT }),
            new Paragraph({ children: [new TextRun({ text: "Summary", bold: true })] }),
            new Paragraph("Software engineer who likes shipping small, fast web apps with React and TypeScript."),
            new Paragraph({ children: [new TextRun({ text: "Work Experience", bold: true })] }),
            ...jobParagraphs(),
            new Paragraph({ children: [new TextRun({ text: "Education", bold: true })] }),
            new Paragraph("B.S. Computer Science, State University, 2021"),
          ],
        },
      ],
    }),
  );
}

// contact details tucked into the page header, which some scanners never read
export async function headerContactDocx(): Promise<Uint8Array> {
  return pack(
    new Document({
      styles: { default: { document: { run: { font: "Georgia", size: 22 } } } },
      sections: [
        {
          headers: { default: new Header({ children: [new Paragraph("Jordan Lee"), new Paragraph(CONTACT)] }) },
          footers: { default: new Footer({ children: [new Paragraph("References available on request")] }) },
          children: [new Paragraph({ children: [new TextRun({ text: "Work Experience", bold: true })] }), ...jobParagraphs(), new Paragraph("Education"), new Paragraph("B.S. Computer Science, State University, 2021")],
        },
      ],
    }),
  );
}

// the whole resume laid out in a table, with a couple of pictures and odd fonts
export async function tableDocx(): Promise<Uint8Array> {
  const cell = (children: Paragraph[]) => new TableCell({ children, width: { size: 50, type: WidthType.PERCENTAGE } });
  const picture = () => new ImageRun({ type: "png", data: PIXEL, transformation: { width: 40, height: 40 } });
  return pack(
    new Document({
      sections: [
        {
          properties: { page: { size: { width: 10000, height: 10000 }, margin: { top: 360, right: 360, bottom: 360, left: 360 } } },
          children: [
            new Paragraph({ children: [picture(), picture(), new TextRun({ text: "Jordan Lee", font: "Papyrus", size: 16, color: "DDDDDD" })] }),
            new Table({
              rows: [
                new TableRow({ children: [cell([new Paragraph({ children: [new TextRun({ text: "Work Experience", font: "Papyrus", size: 16, bold: true })] })]), cell([new Paragraph(CONTACT)])] }),
                ...JOBS.map(
                  (job) =>
                    new TableRow({
                      children: [
                        cell([new Paragraph({ children: [new TextRun({ text: job.heading, font: "Papyrus", size: 16, bold: true })] }), new Paragraph({ children: [new TextRun({ text: job.dates, font: "Papyrus", size: 16, bold: true })] })]),
                        cell(job.bullets.map((bullet) => new Paragraph({ children: [new TextRun({ text: bullet, font: "Papyrus", size: 16, bold: true })], bullet: { level: 0 } }))),
                      ],
                    }),
                ),
              ],
            }),
          ],
        },
      ],
    }),
  );
}

// a one page pdf whose page squeezes down to a few KB and unpacks to megabytes of drawing commands, the way a file built to tie a server up does
export function heavyPdf(megabytes: number): Uint8Array {
  const line = "BT /F1 9 Tf 1 0 0 1 20 700 Tm (Experience with many skills) Tj ET\n";
  const packed = deflateSync(Buffer.from(line.repeat(Math.floor((megabytes * 1024 * 1024) / line.length))), { level: 9 });
  const objects = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>", "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>", null, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"];
  const parts = [Buffer.from("%PDF-1.4\n")];
  const offsets: number[] = [];
  let at = parts[0]?.length ?? 0;
  objects.forEach((body, index) => {
    offsets.push(at);
    // the fourth object is the page's content, the rest are plain
    const part = body === null ? Buffer.concat([Buffer.from(`${index + 1} 0 obj\n<< /Length ${packed.length} /Filter /FlateDecode >>\nstream\n`), packed, Buffer.from("\nendstream\nendobj\n")]) : Buffer.from(`${index + 1} 0 obj\n${body}\nendobj\n`);
    parts.push(part);
    at += part.length;
  });
  const xref = `xref\n0 6\n0000000000 65535 f \n${offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${at}\n%%EOF\n`;
  return new Uint8Array(Buffer.concat([...parts, Buffer.from(xref)]));
}
