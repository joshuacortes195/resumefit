// the parts of the app that have their own color, and the address each one lives under
export const SECTIONS = [
  { key: "dashboard", prefix: "/dashboard" },
  { key: "scans", prefix: "/scans" },
  { key: "optimize", prefix: "/optimize" },
  { key: "letter", prefix: "/cover-letter" },
  { key: "linkedin", prefix: "/linkedin" },
  { key: "apply", prefix: "/auto-apply" },
  { key: "tracker", prefix: "/tracker" },
  { key: "jobs", prefix: "/jobs" },
  { key: "builder", prefix: "/builder" },
  { key: "resumes", prefix: "/resumes" },
  { key: "extension", prefix: "/extension" },
  { key: "interview", prefix: "/interview" },
] as const;
export type SectionKey = (typeof SECTIONS)[number]["key"];

// which part of the app an address belongs to, null for plain pages like settings and help
export function sectionOf(pathname: string): SectionKey | null {
  return SECTIONS.find((section) => pathname === section.prefix || pathname.startsWith(`${section.prefix}/`))?.key ?? null;
}

// the same lookup as a tiny script, run before the page is drawn so the right color is there from the first frame
export const SECTION_SCRIPT = `(function(){var s=${JSON.stringify(SECTIONS)};var p=location.pathname;for(var i=0;i<s.length;i++){if(p===s[i].prefix||p.indexOf(s[i].prefix+"/")===0){document.documentElement.dataset.section=s[i].key;return}}})()`;
