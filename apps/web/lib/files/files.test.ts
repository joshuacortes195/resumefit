import { formattingChecks, parseResume, scanResume } from "@resumefit/scoring";
import { describe, expect, it } from "vitest";
import { headerContactDocx, heavyPdf, messyPdf, plainDocx, scannedPdf, singleColumnPdf, tableDocx, twoColumnPdf } from "./fixtures";
import { FileError, readResumeFile, sniffFileType, uploadBytes } from "./index";

// a fixed "today" so Present always means the same month
const TODAY = new Date(2026, 5, 15);

// the ids of the formatting checks a file fails
async function failedFormatting(bytes: Uint8Array, fileName: string): Promise<string[]> {
  const { text, layout } = await readResumeFile(bytes, fileName);
  const result = scanResume({ resumeText: text, jdText: "Software Engineer\nTypeScript and React", hardSkills: [], softSkills: [], layout, today: TODAY });
  return result.checks.filter((check) => check.category === "formatting" && !check.passed).map((check) => check.id);
}

describe("single column pdf", async () => {
  const { text, layout } = await readResumeFile(await singleColumnPdf(), "Jordan-Lee-Resume.pdf");
  const parsed = parseResume(text, TODAY);

  it("reads the text in order and finds every section", () => {
    expect(text.startsWith("Jordan Lee\nAustin, TX | jordan.lee@example.com")).toBe(true);
    expect(parsed.sections.map((section) => section.kind)).toEqual(["summary", "experience", "education", "skills"]);
    expect(parsed.contact).toMatchObject({ name: "Jordan Lee", email: "jordan.lee@example.com", phone: "(512) 555-0142", location: "Austin, TX" });
  });

  it("glues wrapped bullets back together", () => {
    expect(parsed.experience).toHaveLength(2);
    expect(parsed.experience[0]).toMatchObject({ title: "Software Engineer", company: "Acme Corp" });
    expect(parsed.experience[0]?.bullets[0]).toBe("Cut page load time by 40% by splitting the bundle and lazy loading routes across the whole customer dashboard");
    expect(parsed.experience[0]?.bullets).toHaveLength(3);
  });

  it("reads the page and font details", () => {
    expect(layout).toMatchObject({ fileType: "pdf", pageCount: 1, pageSize: "Letter", columns: 1, hasTables: false, imageCount: 0, bodyFontSize: 11, headerText: "", footerText: "" });
    expect(layout.margins?.left).toBeCloseTo(0.75, 1);
    expect(layout.fonts[0]?.name).toContain("Helvetica");
    expect(layout.boldShare).toBeLessThan(0.3);
    expect(layout.lightTextShare).toBe(0);
  });

  it("passes every formatting check", async () => {
    expect(await failedFormatting(await singleColumnPdf(), "Jordan-Lee-Resume.pdf")).toEqual([]);
  });
});

describe("two column pdf", async () => {
  const { text, layout } = await readResumeFile(await twoColumnPdf(), "resume.pdf");

  it("spots the columns and the a4 page", () => {
    expect(layout).toMatchObject({ columns: 2, pageSize: "A4" });
  });

  it("reads the left column before the right one instead of straight across", () => {
    const lines = text.split("\n");
    expect(lines[0]).toBe("Jordan Lee");
    expect(lines.indexOf("Skills")).toBeLessThan(lines.indexOf("Work Experience"));
    expect(lines.indexOf("Austin, TX")).toBeLessThan(lines.indexOf("Work Experience"));
    // nothing from the right column is stuck onto a line from the left one
    expect(lines).toContain("TypeScript");
    expect(parseResume(text, TODAY).experience.map((job) => job.title)).toEqual(["Software Engineer", "Junior Developer"]);
  });

  it("fails the columns check", async () => {
    expect(await failedFormatting(await twoColumnPdf(), "resume.pdf")).toContain("columns");
  });
});

describe("messy pdf", async () => {
  const { layout } = await readResumeFile(await messyPdf(), "resume final v3.pdf");

  it("finds the images, the repeated header and footer and the pale text", () => {
    expect(layout.imageCount).toBe(4);
    expect(layout.pageCount).toBe(2);
    expect(layout.headerText).toContain("jordan.lee@example.com");
    expect(layout.footerText).toContain("References available on request");
    expect(layout.lightTextShare).toBeGreaterThan(0.02);
    expect(layout.margins?.left).toBeLessThan(0.4);
  });

  it("fails the checks that go with them", async () => {
    const failed = await failedFormatting(await messyPdf(), "resume final v3.pdf");
    for (const id of ["images", "font-color", "font-standard", "footer", "header", "margins"]) expect(failed).toContain(id);
  });
});

describe("plain docx", async () => {
  const { text, layout } = await readResumeFile(await plainDocx(), "Jordan-Lee-Resume.docx");
  const parsed = parseResume(text, TODAY);

  it("keeps the bullets that word stores as list items", () => {
    expect(text).toContain("• Moved 30 screens to TypeScript with zero regressions");
    expect(parsed.experience[0]).toMatchObject({ title: "Software Engineer", company: "Acme Corp" });
    expect(parsed.experience[0]?.bullets).toHaveLength(3);
    expect(parsed.measurableResults.length).toBeGreaterThanOrEqual(4);
  });

  it("reads fonts, sizes and page setup from the file", () => {
    expect(layout).toMatchObject({ fileType: "docx", pageSize: "Letter", columns: 1, hasTables: false, imageCount: 0, bodyFontSize: 11, headerText: "", footerText: "" });
    expect(layout.margins).toEqual({ top: 0.75, right: 0.75, bottom: 0.75, left: 0.75 });
    expect(layout.fonts[0]?.name).toBe("Calibri");
    expect(layout.maxFontSize).toBe(18);
    expect(layout.boldShare).toBeGreaterThan(0);
    expect(layout.boldShare).toBeLessThan(0.3);
  });

  it("passes every formatting check", async () => {
    expect(await failedFormatting(await plainDocx(), "Jordan-Lee-Resume.docx")).toEqual([]);
  });
});

describe("docx with contact details in the header", async () => {
  const { text, layout } = await readResumeFile(await headerContactDocx(), "resume.docx");

  it("keeps header text out of the body and reports it", () => {
    expect(text).not.toContain("jordan.lee@example.com");
    expect(layout.headerText).toContain("jordan.lee@example.com");
    expect(layout.footerText).toBe("References available on request");
  });

  it("fails the header and footer checks, and the email check with them", async () => {
    const result = scanResume({ resumeText: text, jdText: "Software Engineer\nTypeScript", hardSkills: [], softSkills: [], layout, today: TODAY });
    const failed = result.checks.filter((check) => !check.passed).map((check) => check.id);
    for (const id of ["header", "footer", "email"]) expect(failed).toContain(id);
  });
});

describe("table based docx with images", async () => {
  const { text, layout } = await readResumeFile(await tableDocx(), "resume.docx");

  it("still gets the text out of the table cells", () => {
    expect(text).toContain("Software Engineer, Acme Corp");
    expect(text).toContain("• Set up CI/CD that ships 15 releases a week");
  });

  it("reports the table, images, fonts and odd page", () => {
    expect(layout).toMatchObject({ hasTables: true, imageCount: 2, pageSize: "Other", bodyFontSize: 8 });
    expect(layout.fonts[0]?.name).toBe("Papyrus");
    expect(layout.boldShare).toBeGreaterThan(0.5);
    expect(layout.lightTextShare).toBeGreaterThan(0);
  });

  it("fails the matching checks", () => {
    const failed = formattingChecks({ text, parsed: parseResume(text, TODAY), jd: { jobTitle: null, company: null, yearsRequired: null, educationRequired: null, educationPreferred: null, ats: null }, layout })
      .filter((check) => !check.passed)
      .map((check) => check.id);
    for (const id of ["tables", "images", "bold", "font-standard", "font-size", "margins", "page-size"]) expect(failed).toContain(id);
  });
});

describe("files we cannot read", () => {
  it("tells a scan apart from a real pdf", async () => {
    await expect(readResumeFile(await scannedPdf(), "scan.pdf")).rejects.toThrow(/could not find any text/);
  });

  it("goes by the bytes, not the file name", async () => {
    expect(sniffFileType(await singleColumnPdf())).toBe("pdf");
    expect(sniffFileType(await plainDocx())).toBe("docx");
    const fake = new TextEncoder().encode("just some text pretending to be a resume");
    await expect(readResumeFile(fake, "resume.pdf")).rejects.toThrow(FileError);
  });

  it("turns away empty and oversized files", async () => {
    await expect(readResumeFile(new Uint8Array(0), "a.pdf")).rejects.toThrow(/empty/);
    await expect(readResumeFile(new Uint8Array(6 * 1024 * 1024), "a.pdf")).rejects.toThrow(/4 MB/);
  });
});

describe("limits on what a file can hold", () => {
  it("turns away a pdf with far more pages than a resume", async () => {
    const { PDFDocument, StandardFonts } = await import("pdf-lib");
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    for (let page = 0; page < 16; page++) doc.addPage([612, 792]).drawText("Work Experience and lots of other text on every page", { x: 54, y: 700, size: 11, font });
    await expect(readResumeFile(await doc.save(), "book.pdf")).rejects.toThrow(/16 pages/);
  });

  it("gives up on a pdf whose one page hides far more work than a resume, without holding up anything else", async () => {
    // the clock keeps ticking in this thread only if the reading happens somewhere else
    let ticks = 0;
    const clock = setInterval(() => ticks++, 50);
    const started = Date.now();
    await expect(readResumeFile(heavyPdf(20), "resume.pdf")).rejects.toThrow(/far more work to read/);
    clearInterval(clock);
    const took = Date.now() - started;
    expect(took).toBeLessThan(11_000);
    expect(ticks).toBeGreaterThan(took / 50 / 2);
    // a smaller one that still has thousands of pieces of text on a page is turned away quickly too
    const again = Date.now();
    await expect(readResumeFile(heavyPdf(1), "resume.pdf")).rejects.toThrow(/far more work to read/);
    expect(Date.now() - again).toBeLessThan(3000);
  }, 30_000);

  it("turns away a word file that unpacks to something huge", async () => {
    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();
    // thirty megabytes of the same letter squeezes down to almost nothing
    zip.file("word/document.xml", "a".repeat(30 * 1024 * 1024));
    const bomb = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
    expect(bomb.byteLength).toBeLessThan(1024 * 1024);
    await expect(readResumeFile(bomb, "resume.docx")).rejects.toThrow(/far bigger inside/);
  });

  it("is not fooled by an archive that lies about how big it is inside", async () => {
    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();
    zip.file("word/document.xml", "a".repeat(30 * 1024 * 1024));
    const bomb = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
    // rewrite the unpacked size in both places a zip keeps it, so the archive claims to hold a single kilobyte
    const view = new DataView(bomb.buffer, bomb.byteOffset, bomb.byteLength);
    for (let at = 0; at < bomb.byteLength - 30; at++) {
      const mark = view.getUint32(at, true);
      if (mark === 0x04034b50) view.setUint32(at + 22, 1024, true);
      if (mark === 0x02014b50) view.setUint32(at + 24, 1024, true);
    }
    const loaded = await JSZip.loadAsync(bomb);
    const claimed = Object.values(loaded.files).reduce((total, entry) => total + ((entry as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize ?? 0), 0);
    expect(claimed).toBe(1024);
    // the count taken while unpacking still catches it, well before thirty megabytes are in memory
    await expect(readResumeFile(bomb, "resume.docx")).rejects.toThrow(/far bigger inside/);
  });

  it("turns away a word file made of far more tags than a resume has", async () => {
    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();
    // four megabytes of empty tags fit under the size limit, but take hundreds of megabytes to read
    zip.file("word/document.xml", `<w:document>${"<a/>".repeat(1_000_000)}</w:document>`);
    const crowded = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
    const started = Date.now();
    await expect(readResumeFile(crowded, "resume.docx")).rejects.toThrow(/far bigger inside/);
    expect(Date.now() - started).toBeLessThan(1500);
  });

  it("turns away an archive with thousands of parts, and one that defines its own entities", async () => {
    const JSZip = (await import("jszip")).default;
    const crowded = new JSZip();
    crowded.file("word/document.xml", "<w:document/>");
    for (let part = 0; part < 1200; part++) crowded.file(`junk/${part}.xml`, "x");
    await expect(readResumeFile(await crowded.generateAsync({ type: "uint8array" }), "resume.docx")).rejects.toThrow(/far bigger inside/);

    const laughs = new JSZip();
    laughs.file("word/document.xml", '<?xml version="1.0"?><!DOCTYPE lolz [<!ENTITY lol "lol"><!ENTITY lol2 "&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;">]><w:document>&lol2;</w:document>');
    await expect(readResumeFile(await laughs.generateAsync({ type: "uint8array" }), "resume.docx")).rejects.toThrow(/does not look like a Word document/);
  });

  it("answers a damaged file with a plain message, never the error itself", async () => {
    // a real word file cut off halfway, and a pdf that is only a header
    const whole = await plainDocx();
    for (const [bytes, name] of [
      [whole.slice(0, Math.floor(whole.byteLength / 2)), "cut.docx"],
      [new TextEncoder().encode("%PDF-1.7\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>"), "broken.pdf"],
    ] as const) {
      const error = await readResumeFile(bytes, name).catch((caught: unknown) => caught);
      expect(error).toBeInstanceOf(FileError);
      // nothing from inside the readers leaks into what the person is shown
      expect((error as Error).message).not.toMatch(/at |Error:|\.ts|\.js|undefined|null|stack/);
    }
  });

  it("checks the size of an upload before reading any of it", async () => {
    let read = false;
    const huge = { size: 6 * 1024 * 1024, arrayBuffer: async () => ((read = true), new ArrayBuffer(0)) } as unknown as File;
    await expect(uploadBytes(huge)).rejects.toThrow(/4 MB/);
    expect(read).toBe(false);
  });
});
