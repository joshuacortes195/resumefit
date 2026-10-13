import { isMainThread, parentPort, workerData } from "node:worker_threads";

// the most drawing commands and pieces of text one page may have. a real resume page has a few thousand at the very most
const MAX_PAGE_COMMANDS = 200_000;
const MAX_PAGE_ITEMS = 12_000;
// the most text the whole file may hold. a long resume is around ten thousand characters
const MAX_TEXT_CHARS = 300_000;

// reads the raw facts off every page of a pdf: where each piece of text sits, which fonts it uses,
// how many pictures there are and what color the text is drawn in.
// this file is plain javascript that uses nothing from the rest of the app, so the very same file can be started
// by itself in a side thread, where a pdf built to take forever can be stopped without stopping anything else
export async function readPages(bytes, { getDocumentProxy, OPS }, maxPages) {
  let pdf;
  try {
    pdf = await getDocumentProxy(new Uint8Array(bytes));
  } catch (error) {
    return { problem: /password/i.test(String(error)) ? "locked" : "unreadable" };
  }
  if (pdf.numPages > maxPages) return { problem: "long", pageCount: pdf.numPages };
  const imageOps = new Set([OPS.paintImageXObject, OPS.paintInlineImageXObject, OPS.paintImageXObjectRepeat, OPS.paintImageMaskXObject].filter((op) => op !== undefined));

  const pages = [];
  let characters = 0;
  for (let number = 1; number <= pdf.numPages; number++) {
    const page = await pdf.getPage(number);

    // walk the drawing commands for images and text colors, this also loads the fonts
    const operators = await page.getOperatorList();
    if (operators.fnArray.length > MAX_PAGE_COMMANDS) return { problem: "heavy" };
    let fill = "#000000";
    let imageCount = 0;
    // how many characters were drawn in each color
    const glyphsByColor = {};
    for (const [index, op] of operators.fnArray.entries()) {
      const args = operators.argsArray[index];
      if (imageOps.has(op)) imageCount += 1;
      else if (op === OPS.setFillRGBColor && args) fill = typeof args[0] === "string" ? args[0] : `rgb(${args.slice(0, 3).join(",")})`;
      else if (op === OPS.showText && Array.isArray(args?.[0])) {
        const count = args[0].filter((glyph) => typeof glyph === "object" && glyph !== null).length;
        glyphsByColor[fill] = (glyphsByColor[fill] ?? 0) + count;
      }
    }

    const content = await page.getTextContent();
    const items = content.items.filter((item) => "str" in item && "transform" in item).map((item) => ({ str: item.str, width: item.width, height: item.height, transform: Array.from(item.transform), fontName: item.fontName }));
    if (items.length > MAX_PAGE_ITEMS) return { problem: "heavy" };
    for (const item of items) characters += item.str.length;
    if (characters > MAX_TEXT_CHARS) return { problem: "heavy" };

    // what we know about each font the page uses
    const fonts = {};
    for (const item of items) {
      if (item.fontName in fonts) continue;
      try {
        const font = page.commonObjs.get(item.fontName);
        fonts[item.fontName] = { name: font?.name, bold: Boolean(font?.bold), black: Boolean(font?.black) };
      } catch {
        // some fonts never finish loading, we just skip their names
        fonts[item.fontName] = {};
      }
    }
    pages.push({ view: Array.from(page.view), items, fonts, imageCount, glyphsByColor });
  }
  return { pageCount: pdf.numPages, pages };
}

// started as a side thread, this reads the one pdf it was handed and reports back what it found
if (!isMainThread && workerData?.task === "pdf-pages") {
  const say = (message) => parentPort?.postMessage(message);
  const reason = (error) => String(error?.message ?? error).slice(0, 300);
  // the pdf library is loaded from where the main thread found it on disk
  Promise.all([import(/* webpackIgnore: true */ /* turbopackIgnore: true */ workerData.unpdfUrl), import(/* webpackIgnore: true */ /* turbopackIgnore: true */ workerData.pdfjsUrl)]).then(
    ([unpdf, pdfjs]) =>
      readPages(workerData.bytes, { getDocumentProxy: unpdf.getDocumentProxy, OPS: pdfjs.OPS }, workerData.maxPages).then(
        (result) => say({ result }),
        (error) => say({ crashed: reason(error) }),
      ),
    (error) => say({ unavailable: reason(error) }),
  );
}
