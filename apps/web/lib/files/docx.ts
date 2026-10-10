import type { LayoutMeta } from "@resumefit/scoring";
import { XMLParser } from "fast-xml-parser";
import JSZip from "jszip";
import { FileError, isLightColor, MAX_UNPACKED_BYTES, type ExtractedFile } from "./shared";

// one xml element the way the parser hands it to us, children stay in document order
type XmlNode = Record<string, unknown>;

// the look of a run of text
type RunProps = { font?: string; size?: number; bold?: boolean; color?: string };
// a named style from the styles file
type Style = { basedOn?: string; run: RunProps; align?: string };

const parser = new XMLParser({ preserveOrder: true, ignoreAttributes: false, attributeNamePrefix: "", trimValues: false, parseTagValue: false });

// the tag name of an element
function tagOf(node: XmlNode): string {
  return Object.keys(node).find((key) => key !== ":@") ?? "";
}

// the elements inside an element
function kids(node: XmlNode): XmlNode[] {
  const inner = node[tagOf(node)];
  return Array.isArray(inner) ? (inner as XmlNode[]) : [];
}

// one attribute of an element
function attr(node: XmlNode | undefined, name: string): string | undefined {
  return (node?.[":@"] as Record<string, string> | undefined)?.[name];
}

// the first child with a given tag
function child(node: XmlNode | undefined, tag: string): XmlNode | undefined {
  return node ? kids(node).find((kid) => tagOf(kid) === tag) : undefined;
}

// every element with a given tag, however deep
function findAll(nodes: XmlNode[], tag: string, found: XmlNode[] = []): XmlNode[] {
  for (const node of nodes) {
    if (tagOf(node) === tag) found.push(node);
    findAll(kids(node), tag, found);
  }
  return found;
}

// all the text inside some elements
function textOf(nodes: XmlNode[]): string {
  return findAll(nodes, "w:t")
    .map((node) => kids(node).map((kid) => String(kid["#text"] ?? "")).join(""))
    .join(" ");
}

// on unless it says off, word writes <w:b/> for bold and <w:b w:val="0"/> for not bold
function isOn(node: XmlNode | undefined): boolean | undefined {
  if (!node) return undefined;
  const value = attr(node, "w:val");
  return value !== "0" && value !== "false";
}

// reads font, size, bold and color from a run properties element
function readRunProps(rPr: XmlNode | undefined, theme: { minor?: string; major?: string }): RunProps {
  if (!rPr) return {};
  const props: RunProps = {};
  const fonts = child(rPr, "w:rFonts");
  const themeFont = attr(fonts, "w:asciiTheme");
  const font = attr(fonts, "w:ascii") ?? attr(fonts, "w:hAnsi") ?? (themeFont ? (themeFont.startsWith("major") ? theme.major : theme.minor) : undefined);
  if (font) props.font = font;
  // sizes are stored in half points
  const size = Number(attr(child(rPr, "w:sz"), "w:val"));
  if (size > 0) props.size = size / 2;
  const bold = isOn(child(rPr, "w:b"));
  if (bold !== undefined) props.bold = bold;
  const color = attr(child(rPr, "w:color"), "w:val");
  if (color && color !== "auto") props.color = color;
  return props;
}

// reads the text and layout details out of a word document
export async function readDocx(bytes: Uint8Array, fileName: string | null): Promise<ExtractedFile> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(bytes);
  } catch {
    throw new FileError("We could not open this file. Make sure it is a .docx saved from Word or Google Docs.");
  }
  // add up what the archive says it unpacks to before unpacking any of it
  const unpacked = Object.values(zip.files).reduce((total, entry) => total + ((entry as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize ?? 0), 0);
  if (unpacked > MAX_UNPACKED_BYTES) throw new FileError("This document is far bigger inside than a resume should be. Save a fresh copy from Word or Google Docs and try again.");
  const read = async (path: string) => (await zip.file(path)?.async("string")) ?? null;
  const documentXml = await read("word/document.xml");
  if (!documentXml) throw new FileError("This does not look like a Word document. Save it as .docx and try again.");

  // fonts the theme stands in for when a style just says "body font"
  const themeXml = (await read("word/theme/theme1.xml")) ?? "";
  const theme = {
    minor: themeXml.match(/<a:minorFont>[\s\S]*?<a:latin typeface="([^"]+)"/)?.[1],
    major: themeXml.match(/<a:majorFont>[\s\S]*?<a:latin typeface="([^"]+)"/)?.[1],
  };

  // named styles, plus the defaults everything starts from
  const styles = new Map<string, Style>();
  let defaults: RunProps = { size: 10 };
  let defaultParagraphStyle: string | undefined;
  const stylesXml = await read("word/styles.xml");
  if (stylesXml) {
    const tree = parser.parse(stylesXml) as XmlNode[];
    const defaultRun = findAll(findAll(tree, "w:rPrDefault"), "w:rPr")[0];
    defaults = { ...defaults, ...readRunProps(defaultRun, theme) };
    for (const style of findAll(tree, "w:style")) {
      const id = attr(style, "w:styleId");
      if (!id) continue;
      styles.set(id, {
        basedOn: attr(child(style, "w:basedOn"), "w:val"),
        run: readRunProps(child(style, "w:rPr"), theme),
        align: attr(child(child(style, "w:pPr"), "w:jc"), "w:val"),
      });
      if (attr(style, "w:type") === "paragraph" && attr(style, "w:default") === "1") defaultParagraphStyle = id;
    }
  }

  // a style's own settings on top of whatever it is based on
  const resolveStyle = (id: string | undefined, depth = 0): { run: RunProps; align?: string } => {
    const style = id ? styles.get(id) : undefined;
    if (!style || depth > 10) return { run: {} };
    const parent = resolveStyle(style.basedOn, depth + 1);
    return { run: { ...parent.run, ...style.run }, align: style.align ?? parent.align };
  };

  const lines: string[] = [];
  const fontChars = new Map<string, number>();
  const sizeChars = new Map<number, number>();
  let totalChars = 0;
  let boldChars = 0;
  let lightChars = 0;
  let imageCount = 0;
  let hasTables = false;
  let columns = 1;
  let paragraphs = 0;
  let offLeft = 0;
  let pageSize: LayoutMeta["pageSize"] = null;
  let margins: LayoutMeta["margins"] = null;

  // what we know while we are inside a paragraph
  type ParagraphState = { text: string; run: RunProps };

  // page size, margins and columns for a section of the document
  const readSection = (section: XmlNode) => {
    const size = child(section, "w:pgSz");
    const [short, long] = [Number(attr(size, "w:w")), Number(attr(size, "w:h"))].sort((a, b) => a - b);
    // sizes are in twentieths of a point
    if (short && long) {
      if (Math.abs(short - 12240) <= 100 && Math.abs(long - 15840) <= 100) pageSize = "Letter";
      else if (Math.abs(short - 11906) <= 100 && Math.abs(long - 16838) <= 100) pageSize = "A4";
      else pageSize = "Other";
    }
    const margin = child(section, "w:pgMar");
    if (margin) {
      const inches = (side: string) => Math.round((Number(attr(margin, `w:${side}`)) / 1440) * 100) / 100;
      margins = { top: inches("top"), right: inches("right"), bottom: inches("bottom"), left: inches("left") };
    }
    columns = Math.max(columns, Number(attr(child(section, "w:cols"), "w:num")) || 1);
  };

  // walks the document in order, collecting lines of text and layout facts on the way
  const visit = (nodes: XmlNode[], paragraph: ParagraphState | null, run: RunProps | null) => {
    for (const node of nodes) {
      const tag = tagOf(node);
      if (tag === "mc:Fallback") {
        // an older copy of a drawing that is already covered by the main one
        continue;
      } else if (tag === "w:p") {
        const pPr = child(node, "w:pPr");
        const style = resolveStyle(attr(child(pPr, "w:pStyle"), "w:val") ?? defaultParagraphStyle);
        const state: ParagraphState = { text: "", run: { ...defaults, ...style.run } };
        const section = child(pPr, "w:sectPr");
        if (section) readSection(section);
        visit(kids(node), state, null);

        const text = state.text.replace(/[ \t]+$/g, "");
        if (text.trim()) {
          // list items lose their bullet in the file, so we put one back
          const isListItem = child(pPr, "w:numPr") !== undefined;
          for (const [index, line] of text.split("\n").entries()) {
            if (line.trim()) lines.push(isListItem && index === 0 ? `• ${line.trim()}` : line.trim());
          }
          paragraphs += 1;
          const align = attr(child(pPr, "w:jc"), "w:val") ?? style.align;
          if (align === "center" || align === "right" || align === "end") offLeft += 1;
        }
      } else if (tag === "w:pPr") {
        // already read above
        continue;
      } else if (tag === "w:r" && paragraph) {
        const rPr = child(node, "w:rPr");
        const characterStyle = resolveStyle(attr(child(rPr, "w:rStyle"), "w:val"));
        visit(kids(node), paragraph, { ...paragraph.run, ...characterStyle.run, ...readRunProps(rPr, theme) });
      } else if (tag === "w:t" && paragraph && run) {
        const text = kids(node)
          .map((kid) => String(kid["#text"] ?? ""))
          .join("");
        paragraph.text += text;
        // tally how much text uses each font, size, bold and pale colors
        const length = text.trim().length;
        if (length > 0) {
          const font = run.font ?? "Unknown";
          fontChars.set(font, (fontChars.get(font) ?? 0) + length);
          if (run.size) sizeChars.set(run.size, (sizeChars.get(run.size) ?? 0) + length);
          if (run.bold) boldChars += length;
          if (run.color && isLightColor(run.color)) lightChars += length;
          totalChars += length;
        }
      } else if (tag === "w:tab" && paragraph && run) {
        paragraph.text += "\t";
      } else if ((tag === "w:br" || tag === "w:cr") && paragraph && run) {
        paragraph.text += "\n";
      } else if (tag === "w:tbl") {
        hasTables = true;
        visit(kids(node), null, null);
      } else if (tag === "a:blip" || tag === "v:imagedata") {
        imageCount += 1;
      } else if (tag === "w:sectPr") {
        readSection(node);
      } else {
        // text boxes start their own paragraphs, everything else just passes through
        visit(kids(node), tag === "w:txbxContent" ? null : paragraph, tag === "w:txbxContent" ? null : run);
      }
    }
  };
  visit(parser.parse(documentXml) as XmlNode[], null, null);

  const text = lines.join("\n").trim();
  if (text.replace(/\s/g, "").length < 40) throw new FileError("We could not find any text in this document. Is the resume inside an image?");

  // whatever was typed into the page headers and footers
  const edgeText = async (kind: "header" | "footer") => {
    const parts: string[] = [];
    for (const path of Object.keys(zip.files).filter((name) => new RegExp(`^word/${kind}\\d*\\.xml$`).test(name))) {
      const xml = await read(path);
      if (xml) parts.push(textOf(parser.parse(xml) as XmlNode[]).trim());
    }
    return parts.filter(Boolean).join(" ");
  };

  // word saves a page count in the file details, other tools often leave it out
  const pages = Number((await read("docProps/app.xml"))?.match(/<Pages>(\d+)<\/Pages>/)?.[1]);
  const fonts = [...fontChars].map(([name, chars]) => ({ name, share: chars / Math.max(1, totalChars) })).sort((a, b) => b.share - a.share);
  const sizes = [...sizeChars].sort((a, b) => b[1] - a[1]);

  return {
    text,
    layout: {
      fileType: "docx",
      fileName,
      pageCount: pages > 0 ? pages : null,
      pageSize,
      margins,
      columns,
      hasTables,
      imageCount,
      headerText: await edgeText("header"),
      footerText: await edgeText("footer"),
      fonts,
      bodyFontSize: sizes[0]?.[0] ?? null,
      minFontSize: sizes.length > 0 ? Math.min(...sizes.map(([size]) => size)) : null,
      maxFontSize: sizes.length > 0 ? Math.max(...sizes.map(([size]) => size)) : null,
      boldShare: totalChars > 0 ? boldChars / totalChars : null,
      lightTextShare: totalChars > 0 ? lightChars / totalChars : null,
      offLeftShare: paragraphs > 0 ? offLeft / paragraphs : null,
    },
  };
}
