import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { Worker } from "node:worker_threads";
import type { LayoutMeta } from "@resumefit/scoring";
import { isBullet } from "@resumefit/scoring";
import { getDocumentProxy } from "unpdf";
import { safeErrorText } from "@/lib/log";
import { readPages, type PdfLibrary, type PdfPages, type PdfTextItem } from "./pdf-pages.mjs";
import { FileError, isLightColor, MAX_PDF_PAGES, mostCommon, type ExtractedFile } from "./shared";

// one piece of text on the page with where it sits
type Chunk = { text: string; x0: number; x1: number; size: number };
// chunks that share a baseline
type Row = { y: number; size: number; chunks: Chunk[] };

// one piece of text as the page reader hands it over
type TextItem = PdfTextItem;

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
    // each chunk's text is gathered in pieces and joined once at the end, so a row made of thousands of pieces
    // costs no more per piece than a row of ten
    const building: (Omit<Chunk, "text"> & { parts: string[] })[] = [];
    for (const item of row.items) {
      const previous = building.at(-1);
      const gap = previous ? item.x0 - previous.x1 : 0;
      // a lone bullet mark always sticks to the text after it. only a chunk of one or two pieces can still be that short
      const lone = previous && previous.parts.length <= 2 ? previous.parts.join("").trim() : null;
      const afterBullet = lone !== null && lone.length <= 2 && isBullet(`${lone} x`);
      if (previous && (gap < Math.max(item.size * 1.6, 10) || afterBullet)) {
        // small gaps are just spaces between words
        previous.parts.push((gap > item.size * 0.2 && !previous.parts.at(-1)?.endsWith(" ") && !item.text.startsWith(" ") ? " " : "") + item.text);
        previous.x1 = Math.max(previous.x1, item.x0 + item.width);
      } else {
        building.push({ parts: [item.text], x0: item.x0, x1: item.x0 + item.width, size: item.size });
      }
    }
    row.chunks = building.map(({ parts, ...chunk }) => ({ ...chunk, text: parts.join("") }));
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
  // the text of the row before, which is how the line being built ends
  let previousText = "";

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
      !/[.!?:]$/.test(previousText);
    if (wrapped) lines[lines.length - 1] += ` ${text}`;
    else lines.push(text);
    previous = row;
    previousText = text;
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

// how long a pdf gets to be read, and how much memory, before it is given up on. a real resume takes well under a second
const SIDE_THREAD_MS = 10_000;
const SIDE_THREAD_MB = 512;

const TOO_HEAVY = "This PDF takes far more work to read than a resume should. Export a fresh copy from Word or Google Docs and upload that.";

// the side thread could not be started or could not load what it needs, which is our problem and not the file's
class SideThreadDown extends Error {}

// where the page reader and the pdf library sit on disk, so a side thread can load them by itself. looked for once
let sideFiles: { reader: string; unpdf: string; pdfjs: string } | null | undefined;
function findSideFiles(): { reader: string; unpdf: string; pdfjs: string } | null {
  if (sideFiles !== undefined) return sideFiles;
  sideFiles = null;
  try {
    // the paths below are worked out while the app runs, so the build is told not to follow them
    const here = /* turbopackIgnore: true */ process.cwd();
    // the app can be started from its own folder or from the repo root
    const reader = [path.join(/* turbopackIgnore: true */ here, "lib", "files", "pdf-pages.mjs"), path.join(/* turbopackIgnore: true */ here, "apps", "web", "lib", "files", "pdf-pages.mjs")].find((file) => existsSync(file));
    // the library sits next to the app, or in the shared store one or two folders up
    const folders = [here, path.join(/* turbopackIgnore: true */ here, "apps", "web"), path.join(/* turbopackIgnore: true */ here, ".."), path.join(/* turbopackIgnore: true */ here, "..", "..")].flatMap((root) => {
      const modules = path.join(/* turbopackIgnore: true */ root, "node_modules");
      const store = path.join(/* turbopackIgnore: true */ modules, ".pnpm");
      const stored = existsSync(store) ? readdirSync(store).filter((name) => name.startsWith("unpdf@")).map((name) => path.join(/* turbopackIgnore: true */ store, name, "node_modules", "unpdf", "dist")) : [];
      return [path.join(/* turbopackIgnore: true */ modules, "unpdf", "dist"), ...stored];
    });
    const dist = folders.find((folder) => existsSync(path.join(/* turbopackIgnore: true */ folder, "index.mjs")) && existsSync(path.join(/* turbopackIgnore: true */ folder, "pdfjs.mjs")));
    if (reader && dist) sideFiles = { reader, unpdf: pathToFileURL(path.join(/* turbopackIgnore: true */ dist, "index.mjs")).href, pdfjs: pathToFileURL(path.join(/* turbopackIgnore: true */ dist, "pdfjs.mjs")).href };
  } catch {
    // not being able to look just means reading in the app itself
  }
  return sideFiles;
}

// reads the pages in a side thread. the pdf library does its work in one long go that nothing in the same thread can interrupt,
// so this is the only way to put a time limit and a memory limit on a file built to need hours and gigabytes
function inSideThread(bytes: Uint8Array, files: { reader: string; unpdf: string; pdfjs: string }): Promise<PdfPages> {
  return new Promise((resolve, reject) => {
    let worker: Worker;
    try {
      worker = new Worker(/* turbopackIgnore: true */ files.reader, {
        workerData: { task: "pdf-pages", bytes, unpdfUrl: files.unpdf, pdfjsUrl: files.pdfjs, maxPages: MAX_PDF_PAGES },
        resourceLimits: { maxOldGenerationSizeMb: SIDE_THREAD_MB },
      });
    } catch (error) {
      return reject(new SideThreadDown(safeErrorText(error, "could not start")));
    }
    let settled = false;
    // whatever happens first decides it, and the thread is always stopped afterwards
    const finish = (act: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      void worker.terminate();
      act();
    };
    const timer = setTimeout(() => finish(() => reject(new FileError(TOO_HEAVY))), SIDE_THREAD_MS);
    worker.on("message", (message: { result?: PdfPages; crashed?: string; unavailable?: string }) =>
      finish(() => {
        if (message.result) resolve(message.result);
        // the library gave up on the file, which is the file's problem
        else if (message.crashed !== undefined) reject(new Error(message.crashed));
        else reject(new SideThreadDown(message.unavailable ?? "could not load"));
      }),
    );
    // running out of its memory allowance is the file's doing, anything else is ours
    worker.on("error", (error: NodeJS.ErrnoException) => finish(() => reject(error.code === "ERR_WORKER_OUT_OF_MEMORY" ? new FileError(TOO_HEAVY) : new SideThreadDown(safeErrorText(error, "stopped")))));
    worker.on("exit", () => finish(() => reject(new SideThreadDown("stopped without an answer"))));
  });
}

// so the note about reading without a side thread is written once, not on every upload
let warned = false;

// the raw facts off every page, read in a side thread when one can be started and in the app itself when not
async function pagesOf(bytes: Uint8Array): Promise<PdfPages> {
  const files = findSideFiles();
  let why = "its files were not found";
  if (files) {
    try {
      return await inSideThread(bytes, files);
    } catch (error) {
      if (!(error instanceof SideThreadDown)) throw error;
      why = error.message;
    }
  }
  if (!warned) console.error(`pdfs are being read without a side thread, so without a time limit: ${why}`);
  warned = true;
  const { OPS } = (await import("unpdf/pdfjs")) as unknown as { OPS: PdfLibrary["OPS"] };
  return readPages(bytes, { getDocumentProxy, OPS }, MAX_PDF_PAGES);
}

// reads the text and layout details out of a pdf
export async function readPdf(bytes: Uint8Array, fileName: string | null): Promise<ExtractedFile> {
  const read = await pagesOf(bytes);
  if ("problem" in read) {
    if (read.problem === "locked") throw new FileError("This PDF is password protected. Remove the password and upload it again.");
    if (read.problem === "unreadable") throw new FileError("We could not open this PDF. Try saving it again or upload a DOCX.");
    if (read.problem === "long") throw new FileError(`This PDF has ${read.pageCount} pages. Resumes are one or two, so upload just the resume.`);
    throw new FileError(TOO_HEAVY);
  }

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

  for (const [index, page] of read.pages.entries()) {
    const [boxLeft = 0, boxBottom = 0, boxRight = 612, boxTop = 792] = page.view;
    const width = boxRight - boxLeft;
    const height = boxTop - boxBottom;

    // page size, letter and a4 in points, either way up
    if (index === 0) {
      const [short, long] = [Math.min(width, height), Math.max(width, height)];
      if (Math.abs(short - 612) <= 5 && Math.abs(long - 792) <= 5) pageSize = "Letter";
      else if (Math.abs(short - 595) <= 5 && Math.abs(long - 842) <= 5) pageSize = "A4";
      else pageSize = "Other";
    }

    // images, and how much of the text is drawn in a color too pale to read
    imageCount += page.imageCount;
    for (const [color, count] of Object.entries(page.glyphsByColor)) {
      glyphs += count;
      if (isLightColor(color)) lightGlyphs += count;
    }

    const items = page.items;

    // font and size totals, weighted by how much text uses them
    for (const item of items) {
      const length = item.str.trim().length;
      if (length === 0) continue;
      const font = page.fonts[item.fontName] ?? {};
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
      pageCount: read.pageCount,
      pageSize,
      margins: Number.isFinite(margins.left) ? { top: round(margins.top), right: round(margins.right), bottom: round(margins.bottom), left: round(margins.left) } : null,
      columns,
      hasTables,
      imageCount,
      headerText: read.pageCount > 1 ? repeated("top") : "",
      footerText: read.pageCount > 1 ? repeated("bottom") : "",
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
