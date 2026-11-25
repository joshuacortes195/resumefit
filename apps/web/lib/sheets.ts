import type { SectionKey } from "@/lib/sections";

// which little line drawing a page gets in its title strip
export type DrawingKey =
  | "dashboard"
  | "scan"
  | "newscan"
  | "profile"
  | "optimize"
  | "letter"
  | "linkedin"
  | "tracker"
  | "apply"
  | "stats"
  | "jobs"
  | "builder"
  | "resumes"
  | "extension"
  | "interview"
  | "settings"
  | "help"
  | "admin";

// one page drawn as a sheet in the set: its number, the small print under it, the tip floating beside it and its drawing
export type Sheet = {
  prefix: string;
  no: string;
  spec: string;
  tip: string;
  drawing: DrawingKey;
  // the clay bubble takes the page's soft color, plain pages get the pale blue one
  section?: SectionKey;
};

// every page in the app as a numbered sheet, numbered in the order the sidebar lists them. the longer addresses come first so they win over the ones they start with
export const SHEETS: Sheet[] = [
  { prefix: "/scans/new", no: "10.1", spec: "New scan / resume against job", tip: "paste the whole posting", drawing: "newscan", section: "scans" },
  { prefix: "/scans/sample", no: "10.S", spec: "Sample scan / made up data", tip: "no account needed", drawing: "scan", section: "scans" },
  { prefix: "/settings/application", no: "14.1", spec: "Application profile / filled once", tip: "used by Auto Apply", drawing: "profile" },
  { prefix: "/dashboard", no: "01", spec: "Overview / scans and board", tip: "scan, then save the job", drawing: "dashboard", section: "dashboard" },
  { prefix: "/scans", no: "10", spec: "Scan history / every inspection", tip: "same input, same score", drawing: "scan", section: "scans" },
  { prefix: "/optimize", no: "02", spec: "Rewrites / rev A to rev B", tip: "accept edits one by one", drawing: "optimize", section: "optimize" },
  { prefix: "/cover-letter", no: "03", spec: "Cover letter / drafted from resume", tip: "read it before you send it", drawing: "letter", section: "letter" },
  { prefix: "/linkedin", no: "04", spec: "LinkedIn / profile against jobs", tip: "use the job's own words", drawing: "linkedin", section: "linkedin" },
  { prefix: "/tracker", no: "05", spec: "Tracker / saved to offer", tip: "drag cards between columns", drawing: "tracker", section: "tracker" },
  { prefix: "/applications", no: "07", spec: "Auto Apply / filled for review", tip: "a few need your answer", drawing: "apply", section: "tracker" },
  { prefix: "/stats", no: "05.1", spec: "Results / what the board adds up to", tip: "follow up after a week", drawing: "stats", section: "tracker" },
  { prefix: "/jobs", no: "06", spec: "Find Jobs / open roles ranked", tip: "ranked against your resume", drawing: "jobs", section: "jobs" },
  { prefix: "/builder", no: "08", spec: "Builder / single column layouts", tip: "one column reads cleanest", drawing: "builder", section: "builder" },
  { prefix: "/resumes", no: "09", spec: "Resume manager / every version", tip: "mark one as your base", drawing: "resumes", section: "resumes" },
  { prefix: "/extension", no: "11", spec: "Extension / scan from the posting", tip: "works on the page you are on", drawing: "extension", section: "extension" },
  { prefix: "/interview", no: "12", spec: "Interview / questions for the job", tip: "put a number in each answer", drawing: "interview", section: "interview" },
  { prefix: "/settings", no: "14", spec: "Settings / account and data", tip: "export or delete any time", drawing: "settings" },
  { prefix: "/help", no: "13", spec: "Help / common questions", tip: "try the sample scan first", drawing: "help" },
  { prefix: "/admin", no: "15", spec: "Admin / invites and sign ins", tip: "handle with care", drawing: "admin" },
];

// the sheet for an address, null for anything that is not in the set
export function sheetOf(pathname: string): Sheet | null {
  return SHEETS.find((sheet) => pathname === sheet.prefix || pathname.startsWith(`${sheet.prefix}/`)) ?? null;
}
