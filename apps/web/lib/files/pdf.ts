import type { LayoutMeta } from "@resumefit/scoring";
import { isBullet } from "@resumefit/scoring";
import { getDocumentProxy } from "unpdf";
import { FileError, isLightColor, MAX_PDF_PAGES, mostCommon, type ExtractedFile } from "./shared";

// one piece of text on the page with where it sits
type Chunk = { text: string; x0: number; x1: number; size: number };
// chunks that share a baseline
type Row = { y: number; size: number; chunks: Chunk[] };

// the bits of pdf.js we use, typed loosely because its own types are huge
type TextItem = { str: string; width: number; height: number; transform: number[]; fontName: string };
type PdfFont = { name?: string; bold?: boolean; black?: boolean };

// drawing commands we care about, looked up by name once the library is loaded
type Ops = Record<string, number>;

// groups the text items on a page into rows, top to bottom
function buildRows(items: TextItem[]): Row[] {
  const sorted = items
    .filter((item) => item.str.trim().length > 0)
    .map((item) => ({ text: item.str, x0: item.transform[4] ?? 0, y: item.transform[5] ?? 0, width: item.width, size: Math.abs(item.transform[3] ?? item.height) || item.height }))
    .sort((a, b) => b.y - a.y || a.x0 - b.x0);

  const rows: (Row & { items: typeof sorted })[] = [];
  for (const item of sorted) {
    const last = rows.at(-1);
    // items within a third of a line of each other are on the same row
    if (last && Math.abs(last.y - item.y) <= Math.max(2, item.size * 0.35)) last.items.push(item);
    else rows.push({ y: item.y, size: item.size, chunks: [], items: [item] });
  }

  for (const row of rows) {
    row.items.sort((a, b) => a.x0 - b.x0);
    row.size = mostCommon(row.items.map((item) => Math.round(item.size * 2) / 2)) ?? row.size;
    for (const item of row.items) {
      const previous = row.chunks.at(-1);
      const gap = previous ? item.x0 - previous.x1 : 0;
      // a lone bullet mark always sticks to the text after it
      const afterBullet = previous !== undefined && isBullet(`${previous.text.trim()} x`) && previous.text.trim().length <= 2;
      if (previous && (gap < Math.max(item.size * 1.6, 10) || afterBullet)) {
        // small gaps are just spaces between words
        previous.text += (gap > item.size * 0.2 && !previous.text.endsWith(" ") && !item.text.startsWith(" ") ? " " : "") + item.text;
        previous.x1 = Math.max(previous.x1, item.x0 + item.width);
      } else {
        row.chunks.push({ text: item.text, x0: item.x0, x1: item.x0 + item.width, size: item.size });
      }
    }
  }
  return rows;
}

// looks for a second column, returns the x where it starts or null
function findColumnStart(rows: Row[], pageLeft: number, pageWidth: number): number | null {
  // count how many rows have a chunk starting at each x in the middle of the page
  const starts = new Map<number, { rows: number; twoSided: number }>();
  for (const row of rows) {
    for (const [index, chunk] of row.chunks.entries()) {
      const position = (chunk.x0 - pageLeft) / pageWidth;
      if (position < 0.25 || position > 0.8) continue;
      const bin = Math.round(chunk.x0 / 4) * 4;
      const entry = starts.get(bin) ?? { rows: 0, twoSided: 0 };
      entry.rows += 1;
      // text on the left of it on the same row is what makes it a real second column
      if (index > 0) entry.twoSided += 1;
      starts.set(bin, entry);
    }
  }
  let best: { x: number; rows: number } | null = null;
  for (const [x, entry] of starts) {
    const enough = entry.rows >= Math.max(8, rows.length * 0.25) && entry.twoSided >= 5;
    if (enough && (!best || entry.rows > best.rows)) best = { x, rows: entry.rows };
  }
  return best ? best.x - 3 : null;
}

// true when three or more rows in a row line up like table cells
function looksLikeTable(rows: Row[]): boolean {
  let streak = 1;
  for (let i = 1; i < rows.length; i++) {
    const above = rows[i - 1]?.chunks ?? [];
    const here = rows[i]?.chunks ?? [];
    const aligned = here.length >= 3 && here.length === above.length && here.every((chunk, index) => Math.abs(chunk.x0 - (above[index]?.x0 ?? -99)) <= 3);
    streak = aligned ? streak + 1 : 1;
    if (streak >= 3) return true;
  }
  return false;
}

// joins rows into lines, gluing wrapped lines back onto the sentence they belong to
function rowsToLines(rows: Row[]): string[] {
  if (rows.length === 0) return [];
  const right = Math.max(...rows.map((row) => row.chunks.at(-1)?.x1 ?? 0));
  const left = Math.min(...rows.map((row) => row.chunks[0]?.x0 ?? 0));
  const lines: string[] = [];
  let previous: Row | null = null;

  for (const row of rows) {
    const text = row.chunks.map((chunk) => chunk.text.trim()).join("\t");
    const previousEnd = previous?.chunks.at(-1)?.x1 ?? 0;
    // the line above ran to the edge, so this row is probably the rest of it
    const wrapped =
      previous !== null &&
      lines.length > 0 &&
      row.chunks.length === 1 &&
      previous.chunks.length === 1 &&
      !isBullet(text) &&
      Math.abs(previous.size - row.size) <= 0.5 &&
      previous.y - row.y <= row.size * 1.7 &&
      previousEnd >= right - (right - left) * 0.14 &&
      !/[.!?:]$/.test(lines[lines.length - 1] ?? "");
    if (wrapped) lines[lines.length - 1] += ` ${text}`;
    else lines.push(text);
    previous = row;
  }
  return lines;
}

// splits rows around a column start so the left column reads before the right one
function splitColumns(rows: Row[], columnStart: number): Row[] {
  const top: Row[] = [];
  const leftRows: Row[] = [];
  const rightRows: Row[] = [];
  let inColumns = false;
  for (const row of rows) {
    const crosses = row.chunks.some((chunk) => chunk.x0 < columnStart - 6 && chunk.x1 > columnStart + 6);
    const leftSide = row.chunks.filter((chunk) => chunk.x0 < columnStart);
    const rightSide = row.chunks.filter((chunk) => chunk.x0 >= columnStart);
    // rows that run across the whole page, like a name at the top, stay where they are
    if (crosses) {
      (inColumns ? leftRows : top).push(row);
      continue;
    }
    if (rightSide.length > 0) inColumns = true;
    if (leftSide.length > 0) leftRows.push({ ...row, chunks: leftSide });
    if (rightSide.length > 0) rightRows.push({ ...row, chunks: rightSide });
  }
  return [...top, ...leftRows, ...rightRows];
}

// reads the text and layout details out of a pdf
export async function readPdf(bytes: Uint8Array, fileName: string | null): Promise<ExtractedFile> {
  let pdf: Awaited<ReturnType<typeof getDocumentProxy>>;
  try {
    pdf = await getDocumentProxy(new Uint8Array(bytes));
  } catch (error) {
    const locked = /password/i.test(String(error));
    throw new FileError(locked ? "This PDF is password protected. Remove the password and upload it again." : "We could not open this PDF. Try saving it again or upload a DOCX.");
  }
  if (pdf.numPages > MAX_PDF_PAGES) throw new FileError(`This PDF has ${pdf.numPages} pages. Resumes are one or two, so upload just the resume.`);
  const { OPS } = (await import("unpdf/pdfjs")) as unknown as { OPS: Ops };
  const imageOps = new Set([OPS.paintImageXObject, OPS.paintInlineImageXObject, OPS.paintImageXObjectRepeat, OPS.paintImageMaskXObject].filter((op) => op !== undefined));

  const lines: string[] = [];
  const fontChars = new Map<string, number>();
  const sizeChars = new Map<number, number>();
  const edgeTexts: { top: string[]; bottom: string[] }[] = [];
  let boldChars = 0;
  let totalChars = 0;
  let glyphs = 0;
  let lightGlyphs = 0;
  let imageCount = 0;
  let columns = 1;
  let hasTables = false;
  let offLeftRows = 0;
  let countedRows = 0;
  let pageSize: LayoutMeta["pageSize"] = null;
  const margins = { top: Infinity, right: Infinity, bottom: Infinity, left: Infinity };

  for (let number = 1; number <= pdf.numPages; number++) {
    const page = await pdf.getPage(number);
    const [boxLeft = 0, boxBottom = 0, boxRight = 612, boxTop = 792] = page.view;
    const width = boxRight - boxLeft;
    const height = boxTop - boxBottom;

    // page size, letter and a4 in points, either way up
    if (number === 1) {
      const [short, long] = [Math.min(width, height), Math.max(width, height)];
      if (Math.abs(short - 612) <= 5 && Math.abs(long - 792) <= 5) pageSize = "Letter";
      else if (Math.abs(short - 595) <= 5 && Math.abs(long - 842) <= 5) pageSize = "A4";
      else pageSize = "Other";
    }

    // walk the drawing commands for images and text colors, this also loads the fonts
    const operators = await page.getOperatorList();
    let fill = "#000000";
    for (const [index, op] of operators.fnArray.entries()) {
      const args = operators.argsArray[index] as unknown[] | null;
      if (imageOps.has(op)) imageCount += 1;
      else if (op === OPS.setFillRGBColor && args) fill = typeof args[0] === "string" ? args[0] : `rgb(${args.slice(0, 3).join(",")})`;
      else if (op === OPS.showText && Array.isArray(args?.[0])) {
        const count = args[0].filter((glyph) => typeof glyph === "object" && glyph !== null).length;
        glyphs += count;
        if (isLightColor(fill)) lightGlyphs += count;
      }
    }

    const content = await page.getTextContent();
    const items = content.items.filter((item): item is typeof item & TextItem => "str" in item && "transform" in item) as TextItem[];

    // font and size totals, weighted by how much text uses them
    for (const item of items) {
      const length = item.str.trim().length;
      if (length === 0) continue;
      let font: PdfFont = {};
      try {
        font = page.commonObjs.get(item.fontName) as PdfFont;
      } catch {
        // some fonts never finish loading, we just skip their names
      }
      const name = font.name ?? "Unknown";
      fontChars.set(name, (fontChars.get(name) ?? 0) + length);
      const size = Math.round((Math.abs(item.transform[3] ?? item.height) || item.height) * 2) / 2;
      sizeChars.set(size, (sizeChars.get(size) ?? 0) + length);
      if (font.bold || font.black || /bold|black|heavy|semibold|demi/i.test(name)) boldChars += length;
      totalChars += length;
    }

    let rows = buildRows(items);
    if (rows.length === 0) continue;

    // margins from the outermost text on any page
    const pageLeft = Math.min(...rows.map((row) => row.chunks[0]?.x0 ?? Infinity));
    const pageRight = Math.max(...rows.map((row) => row.chunks.at(-1)?.x1 ?? 0));
    margins.left = Math.min(margins.left, (pageLeft - boxLeft) / 72);
    margins.right = Math.min(margins.right, (boxRight - pageRight) / 72);
    margins.top = Math.min(margins.top, (boxTop - ((rows[0]?.y ?? boxTop) + (rows[0]?.size ?? 0) * 0.8)) / 72);
    margins.bottom = Math.min(margins.bottom, ((rows.at(-1)?.y ?? boxBottom) - boxBottom) / 72);

    // text in the top and bottom strips, compared across pages later
    const strip = height * 0.06;
    edgeTexts.push({
      top: rows.filter((row) => row.y > boxTop - strip).map((row) => row.chunks.map((chunk) => chunk.text.trim()).join(" ")),
      bottom: rows.filter((row) => row.y < boxBottom + strip).map((row) => row.chunks.map((chunk) => chunk.text.trim()).join(" ")),
    });

    if (looksLikeTable(rows)) hasTables = true;
    const columnStart = findColumnStart(rows, pageLeft, pageRight - pageLeft);
    if (columnStart !== null) {
      columns = 2;
      rows = splitColumns(rows, columnStart);
    } else {
      // rows that start well away from the left edge are centered or right aligned
      for (const row of rows) {
        countedRows += 1;
        if ((row.chunks[0]?.x0 ?? 0) > pageLeft + (pageRight - pageLeft) * 0.2) offLeftRows += 1;
      }
    }
    lines.push(...rowsToLines(rows));
  }

  const text = lines.join("\n").trim();
  if (text.replace(/\s/g, "").length < 40) {
    throw new FileError("We could not find any text in this PDF. It may be a scan or an image. Export it from Word or Google Docs so the text can be selected.");
  }

  // the same words at the top or bottom of two or more pages count as a header or footer
  const repeated = (side: "top" | "bottom") => {
    const counts = new Map<string, number>();
    for (const page of edgeTexts) for (const line of new Set(page[side])) counts.set(line.replace(/\d+/g, "#"), (counts.get(line.replace(/\d+/g, "#")) ?? 0) + 1);
    return edgeTexts[0]?.[side].filter((line) => (counts.get(line.replace(/\d+/g, "#")) ?? 0) >= 2).join(" ") ?? "";
  };

  const fonts = [...fontChars].map(([name, chars]) => ({ name, share: chars / Math.max(1, totalChars) })).sort((a, b) => b.share - a.share);
  const sizes = [...sizeChars].sort((a, b) => b[1] - a[1]);
  const round = (value: number) => Math.round(Math.max(0, value) * 100) / 100;

  return {
    text,
    layout: {
      fileType: "pdf",
      fileName,
      pageCount: pdf.numPages,
      pageSize,
      margins: Number.isFinite(margins.left) ? { top: round(margins.top), right: round(margins.right), bottom: round(margins.bottom), left: round(margins.left) } : null,
      columns,
      hasTables,
      imageCount,
      headerText: pdf.numPages > 1 ? repeated("top") : "",
      footerText: pdf.numPages > 1 ? repeated("bottom") : "",
      fonts,
      bodyFontSize: sizes[0]?.[0] ?? null,
      minFontSize: sizes.length > 0 ? Math.min(...sizes.map(([size]) => size)) : null,
      maxFontSize: sizes.length > 0 ? Math.max(...sizes.map(([size]) => size)) : null,
      boldShare: totalChars > 0 ? boldChars / totalChars : null,
      lightTextShare: glyphs > 0 ? lightGlyphs / glyphs : null,
      offLeftShare: columns === 1 && countedRows > 0 ? offLeftRows / countedRows : null,
    },
  };
}
