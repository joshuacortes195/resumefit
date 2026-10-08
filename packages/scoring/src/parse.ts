// the kinds of sections a resume can have
export type SectionKind =
  | "summary"
  | "experience"
  | "education"
  | "skills"
  | "projects"
  | "certifications"
  | "awards"
  | "publications"
  | "volunteer"
  | "leadership";

// one section of the resume with the lines under its heading
export type ResumeSection = {
  kind: SectionKind;
  // the heading exactly as it was written
  heading: string;
  // false when the heading is a creative name that resume scanners may not recognize
  standard: boolean;
  lines: string[];
};

// contact details pulled from the resume
export type ResumeContact = {
  name: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  linkedin: string | null;
  github: string | null;
  // any other links like a portfolio
  links: string[];
};

// heading names scanners know, grouped by section
const STANDARD_HEADINGS: Record<SectionKind, string[]> = {
  summary: ["summary", "professional summary", "profile", "objective", "career objective", "about"],
  experience: ["experience", "work experience", "work history", "professional experience", "employment", "employment history"],
  education: ["education", "academic background", "education and training"],
  skills: ["skills", "technical skills", "core competencies", "core skills", "skills and tools"],
  projects: ["projects", "personal projects", "selected projects"],
  certifications: ["certifications", "licenses and certifications", "certificates"],
  awards: ["awards", "honors", "honors and awards", "achievements"],
  publications: ["publications"],
  volunteer: ["volunteer", "volunteering", "volunteer experience", "community involvement"],
  leadership: ["leadership", "leadership experience", "activities", "extracurricular activities"],
};

// creative heading names we still understand but flag in the report
const CREATIVE_HEADINGS: Record<string, SectionKind> = {
  "where i've worked": "experience",
  "where ive worked": "experience",
  "my journey": "experience",
  "career highlights": "experience",
  "what i've done": "experience",
  "about me": "summary",
  "who i am": "summary",
  "what i know": "skills",
  "my toolbox": "skills",
  "tech stack": "skills",
  "things i've built": "projects",
  "where i studied": "education",
};

// lookup from a cleaned heading to its section
const HEADING_LOOKUP = new Map<string, { kind: SectionKind; standard: boolean }>();
for (const [kind, names] of Object.entries(STANDARD_HEADINGS) as [SectionKind, string[]][]) {
  for (const name of names) HEADING_LOOKUP.set(name, { kind, standard: true });
}
for (const [name, kind] of Object.entries(CREATIVE_HEADINGS)) {
  HEADING_LOOKUP.set(name, { kind, standard: false });
}

// lowercases a line and strips punctuation so "EDUCATION:" and "Skills & Tools" can be looked up
function cleanHeading(line: string): string {
  return line
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[’]/g, "'")
    .replace(/[^a-z' ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// splits resume text into sections by spotting heading lines
export function detectSections(text: string): ResumeSection[] {
  const sections: ResumeSection[] = [];
  let current: ResumeSection | null = null;

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;

    // headings are short lines that match a name we know
    const match = line.length <= 40 ? HEADING_LOOKUP.get(cleanHeading(line)) : undefined;
    if (match) {
      current = { kind: match.kind, heading: line.replace(/:$/, ""), standard: match.standard, lines: [] };
      sections.push(current);
    } else if (current) {
      // everything else belongs to the section above it
      current.lines.push(line);
    }
  }
  return sections;
}

// patterns for the contact details
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const PHONE = /(?:\+?\d{1,2}[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}(?!\d)/;
const LOCATION = /\b([A-Z][A-Za-z.]+(?: [A-Z][A-Za-z.]+){0,2}, [A-Z]{2})\b(?: \d{5})?/;
const URL = /(?:https?:\/\/)?(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}(?:\/[^\s,;|)]*)?/gi;

// finds name, email, phone, location and links, mostly from the top of the resume
export function extractContact(text: string): ResumeContact {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  // contact details sit in the first few lines, so only look there for the name and location
  const top = lines.slice(0, 8).join("\n");

  // the name is the first line that looks like two to four plain words
  const name = lines.slice(0, 3).find((line) => /^[A-Za-z][A-Za-z.'-]*(?: [A-Za-z][A-Za-z.'-]*){1,3}$/.test(line)) ?? null;

  const email = text.match(EMAIL)?.[0] ?? null;

  // every link except the email's own domain
  const withoutEmails = text.replace(new RegExp(EMAIL.source, "g"), " ");
  const urls = [...new Set(withoutEmails.match(URL) ?? [])].map((url) => url.replace(/[.,]+$/, ""));
  const linkedin = urls.find((url) => /linkedin\.com\/in\//i.test(url)) ?? null;
  const github = urls.find((url) => /github\.com\/[\w-]+/i.test(url)) ?? null;

  return {
    name,
    email,
    phone: top.match(PHONE)?.[0].trim() ?? null,
    location: top.match(LOCATION)?.[0] ?? null,
    linkedin,
    github,
    links: urls.filter((url) => url !== linkedin && url !== github),
  };
}

// words that mean a result was measured even without a digit
const QUANTITY_WORDS = /\b(doubled|tripled|quadrupled|halved)\b/i;

// true when a bullet has a number, percent, dollar amount or a word like doubled
export function isMeasurable(line: string): boolean {
  return /\d/.test(line) || /[%$]/.test(line) || QUANTITY_WORDS.test(line);
}

// the experience and project bullets that show a measured result
export function measurableResults(sections: ResumeSection[]): string[] {
  return sections
    .filter((section) => section.kind === "experience" || section.kind === "projects")
    .flatMap((section) => section.lines)
    // lines that are only dates like "Jan 2024 - Present" do not count
    .filter((line) => /^[•\-*▪◦]/.test(line) && isMeasurable(line.replace(/\b(19|20)\d{2}\b/g, "")));
}

// number of words in the resume
export function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}
