// what we know about how the original file looks, filled in when a pdf or docx is uploaded
export type LayoutMeta = {
  fileType: "pdf" | "docx";
  fileName: string | null;
  pageCount: number | null;
  pageSize: "Letter" | "A4" | "Other" | null;
  // in inches
  margins: { top: number; right: number; bottom: number; left: number } | null;
  columns: number;
  hasTables: boolean;
  imageCount: number;
  // text that sits in the page header and footer areas
  headerText: string;
  footerText: string;
  // fonts by how much of the text uses them, biggest first
  fonts: { name: string; share: number }[];
  // sizes in points
  bodyFontSize: number | null;
  minFontSize: number | null;
  maxFontSize: number | null;
  // share of the text that is bold, 0 to 1
  boldShare: number | null;
  // share of the text in a color too light to read comfortably
  lightTextShare: number | null;
  // share of lines that are centered or pushed to the right
  offLeftShare: number | null;
};

// fonts that every scanner and every computer can read
export const STANDARD_FONTS = [
  "arial",
  "calibri",
  "helvetica",
  "garamond",
  "georgia",
  "times new roman",
  "times",
  "cambria",
  "verdana",
  "tahoma",
  "trebuchet",
  "book antiqua",
  "palatino",
  "century gothic",
  "lato",
  "roboto",
  "open sans",
  "source sans",
  "inter",
  "carlito",
  "liberation sans",
  "liberation serif",
  "aptos",
  "segoe ui",
  "noto sans",
  "noto serif",
];

// turns "ABCDEF+Calibri-Bold" or "TimesNewRomanPSMT" into a plain family name
export function fontFamily(raw: string): string {
  return raw
    .replace(/^[A-Z]{6}\+/, "")
    .replace(/(PS)?MT$/, "")
    .replace(/[-,_ ]?(bold|italic|oblique|regular|medium|light|semibold|black)+$/gi, "")
    .replace(/[-,_ ]?PS$/, "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// true when the font is one of the safe ones
export function isStandardFont(name: string): boolean {
  const family = fontFamily(name).toLowerCase();
  return STANDARD_FONTS.some((font) => family.startsWith(font) || family.replace(/\s/g, "").startsWith(font.replace(/\s/g, "")));
}
