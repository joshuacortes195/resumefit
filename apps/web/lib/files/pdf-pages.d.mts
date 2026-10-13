// the types for pdf-pages.mjs, which is kept as plain javascript so a side thread can run it as it is

// one piece of text on a page with where it sits
export type PdfTextItem = { str: string; width: number; height: number; transform: number[]; fontName: string };

// what we know about a font
export type PdfFont = { name?: string; bold?: boolean; black?: boolean };

// the raw facts read off one page
export type PdfPage = {
  // left, bottom, right and top of the page, in points
  view: number[];
  items: PdfTextItem[];
  fonts: Record<string, PdfFont>;
  imageCount: number;
  // how many characters were drawn in each color
  glyphsByColor: Record<string, number>;
};

// every page, or the reason the file was not read: password protected, damaged, too many pages or far too much on a page
export type PdfPages = { pageCount: number; pages: PdfPage[] } | { problem: "locked" | "unreadable" | "heavy" } | { problem: "long"; pageCount: number };

// the parts of the pdf library the reader needs, handed in so the same code runs in the app and in a side thread
export type PdfLibrary = { getDocumentProxy: (data: Uint8Array) => Promise<unknown>; OPS: Record<string, number> };

export function readPages(bytes: Uint8Array, library: PdfLibrary, maxPages: number): Promise<PdfPages>;
