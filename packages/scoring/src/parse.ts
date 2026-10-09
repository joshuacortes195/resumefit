import { findDateRange, findYear, yearsOfExperience, type DateRange } from "./dates";

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

// the marks people start a bullet with
const BULLET = /^\s*(?:[•▪◦●○■·‣➢►✓*]|[-–—](?=\s))\s*/;

// true when a line is a bullet point
export function isBullet(line: string): boolean {
  return BULLET.test(line);
}

// the bullet text without its mark
export function stripBullet(line: string): string {
  return line.replace(BULLET, "").trim();
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
    .filter((line) => isBullet(line) && isMeasurable(line.replace(/\b(19|20)\d{2}\b/g, "")));
}

// number of words in the resume
export function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

// one job in the work history
export type ExperienceEntry = {
  title: string | null;
  company: string | null;
  location: string | null;
  // null when we could not read a start and end date
  dates: DateRange | null;
  bullets: string[];
};

// degree levels from lowest to highest, the order is used to compare them
export const DEGREE_LEVELS = ["High School", "Associate", "Bachelor's", "Master's", "MBA", "JD", "MD", "PhD"] as const;
export type DegreeLevel = (typeof DEGREE_LEVELS)[number];

// one school in the education section
export type EducationEntry = {
  level: DegreeLevel | null;
  field: string | null;
  school: string | null;
  graduationYear: number | null;
};

// words that show up in job titles, used to tell the title apart from the company
const TITLE_WORDS =
  /\b(engineer|developer|manager|analyst|designer|intern|nurse|associate|specialist|lead|director|consultant|coordinator|assistant|technician|representative|administrator|architect|scientist|officer|supervisor|executive|president|founder|teacher|tutor|clerk|cashier|barista|server|driver|accountant|recruiter|strategist|writer|editor|researcher|programmer|head|vp|chief|owner|agent|advisor|planner|operator|mechanic|electrician|therapist|pharmacist|physician|instructor|professor|fellow|apprentice|trainee|attorney|paralegal|buyer|producer|marketer|tester|contractor|freelancer|volunteer|principal|bookkeeper|receptionist|estimator|foreman|welder|plumber|carpenter)\b/i;

// true when the text reads like a job title
export function looksLikeTitle(text: string): boolean {
  return TITLE_WORDS.test(text);
}

// what separates the title, company and place on a job heading line
const HEADER_SPLIT = /\s+[|·•—–@]\s+|\s+-\s+|,\s+|\s+at\s+|\t+|\s{3,}/;
const PLACE = /^(?:remote|hybrid|on-?site|[A-Z][A-Za-z.]+(?: [A-Z][A-Za-z.]+){0,2},? [A-Z]{2}|[A-Z][A-Za-z.]+(?: [A-Z][A-Za-z.]+){0,2}, [A-Z][a-z]+)$/;

// turns the heading lines of one job into a title, company, place and dates
function readJobHeader(header: string[], today: Date): ExperienceEntry {
  let dates: DateRange | null = null;
  const parts: string[] = [];
  for (const line of header) {
    const range = findDateRange(line, today);
    if (range && !dates) dates = range;
    // take the dates out, then split what is left into pieces
    const rest = range ? line.replace(range.text, " ") : line;
    for (const part of rest.split(HEADER_SPLIT)) {
      const cleaned = part.replace(/^[\s(,|-]+|[\s),|-]+$/g, "");
      if (cleaned) parts.push(cleaned);
    }
  }

  // "Austin, TX" was split on its comma, so glue a state code back onto its city
  const pieces: string[] = [];
  for (const part of parts) {
    const last = pieces.at(-1);
    if (/^[A-Z]{2}$/.test(part) && last && !looksLikeTitle(last)) pieces[pieces.length - 1] = `${last}, ${part}`;
    else pieces.push(part);
  }

  const location = pieces.find((piece) => PLACE.test(piece)) ?? null;
  const names = pieces.filter((piece) => piece !== location);
  // the piece with a job word in it is the title, the other one is the company
  const title = names.find(looksLikeTitle) ?? names[0] ?? null;
  const company = names.find((piece) => piece !== title) ?? null;
  return { title, company, location, dates, bullets: [] };
}

// short lines without a full stop read as job headings, longer ones as description text
function isHeaderLine(line: string, today: Date): boolean {
  if (findDateRange(line, today)) return true;
  return line.length <= 90 && !/[.!?:;]$/.test(line);
}

// splits the lines of the experience section into separate jobs
export function parseExperience(lines: string[], today: Date = new Date()): ExperienceEntry[] {
  const entries: ExperienceEntry[] = [];
  let header: string[] = [];
  let current: ExperienceEntry | null = null;

  // closes the heading we were collecting and starts a job from it
  const startEntry = () => {
    current = readJobHeader(header, today);
    entries.push(current);
    header = [];
  };

  for (const line of lines) {
    if (!isBullet(line) && isHeaderLine(line, today)) {
      // a second heading that already has its dates means the next job has started
      const hasDates = header.some((entry) => findDateRange(entry, today));
      const hasName = header.some((entry) => entry.replace(findDateRange(entry, today)?.text ?? "", "").trim().length > 2);
      if (hasDates && hasName) startEntry();
      header.push(line);
      continue;
    }
    // anything else is a bullet or a sentence that belongs to the job above
    if (header.length > 0) startEntry();
    (current as ExperienceEntry | null)?.bullets.push(stripBullet(line));
  }
  if (header.length > 0) startEntry();
  return entries;
}

// characters that cannot sit next to a degree abbreviation
const NOT_LETTER_BEFORE = "(?<![A-Za-z.])";
const NOT_LETTER_AFTER = "(?![A-Za-z])";
// two letter forms like MA and MS are also state codes, so "Boston, MA" must not count
const NOT_STATE = "(?<!, )";

// how each degree level gets written, highest first so a PhD wins over the bachelor's listed next to it
const DEGREE_PATTERNS: [DegreeLevel, RegExp][] = [
  ["PhD", /(?<![A-Za-z])(?:ph\.?\s?d\.?|doctorate|doctoral|doctor of philosophy)(?![A-Za-z])/i],
  ["MD", new RegExp(`${NOT_LETTER_BEFORE}${NOT_STATE}(?:M\\.D\\.|MD)${NOT_LETTER_AFTER}|doctor of medicine`)],
  ["JD", new RegExp(`${NOT_LETTER_BEFORE}(?:J\\.D\\.|JD)${NOT_LETTER_AFTER}|[Jj]uris [Dd]octor`)],
  ["MBA", new RegExp(`${NOT_LETTER_BEFORE}(?:MBA|M\\.B\\.A\\.)${NOT_LETTER_AFTER}|[Mm]aster of [Bb]usiness [Aa]dministration`)],
  [
    "Master's",
    new RegExp(
      `[Mm]aster(?:'s|’s|s)?${NOT_LETTER_AFTER}|${NOT_LETTER_BEFORE}${NOT_STATE}(?:M\\.S\\.|MS|M\\.A\\.|MA)${NOT_LETTER_AFTER}|${NOT_LETTER_BEFORE}(?:MSc|M\\.Sc\\.|M\\.Eng\\.?|MEng|MFA|MPH|MSW|M\\.Ed\\.?)${NOT_LETTER_AFTER}`,
    ),
  ],
  [
    "Bachelor's",
    new RegExp(
      `[Bb]achelor(?:'s|’s|s)?${NOT_LETTER_AFTER}|[Uu]ndergraduate degree|${NOT_LETTER_BEFORE}(?:B\\.S\\.|BS|B\\.A\\.|BA|BSc|B\\.Sc\\.|B\\.Eng\\.?|BEng|B\\.Tech\\.?|BTech|BBA|BFA|BSN)${NOT_LETTER_AFTER}`,
    ),
  ],
  ["Associate", new RegExp(`[Aa]ssociate(?:'s|’s)?(?: degree| of| in)|${NOT_LETTER_BEFORE}(?:A\\.A\\.S\\.|AAS|A\\.A\\.|A\\.S\\.)${NOT_LETTER_AFTER}`)],
  ["High School", /high school|secondary school|(?<![A-Za-z])GED(?![A-Za-z])/i],
];

// every degree level mentioned in a piece of text
export function findDegreeLevels(text: string): DegreeLevel[] {
  return DEGREE_PATTERNS.filter(([, pattern]) => pattern.test(text)).map(([level]) => level);
}

// true when the first degree is at least as high as the second
export function degreeAtLeast(have: DegreeLevel, need: DegreeLevel): boolean {
  return DEGREE_LEVELS.indexOf(have) >= DEGREE_LEVELS.indexOf(need);
}

const SCHOOL = /\b(university|college|institute|school|academy|polytechnic)\b/i;

// reads the schools and degrees out of the education section
export function parseEducation(lines: string[]): EducationEntry[] {
  const entries: EducationEntry[] = [];
  let current: EducationEntry | null = null;

  for (const line of lines) {
    const level = findDegreeLevels(line)[0] ?? null;
    const pieces = line.split(/,\s+|\s+[|·•—–]\s+|\s+-\s+/).map((piece) => piece.trim());
    const school = pieces.find((piece) => SCHOOL.test(piece) && !/high school diploma/i.test(piece)) ?? null;
    const year = findYear(line);

    // a second degree or a second school means a new entry
    if (!current || (level && current.level) || (school && current.school)) {
      current = { level: null, field: null, school: null, graduationYear: null };
      entries.push(current);
    }
    current.level ??= level;
    current.school ??= school;
    current.graduationYear ??= year;

    // the field is what comes after "in", or the words right after a short degree name
    if (level && !current.field) {
      const afterIn = line.match(/\b(?:in|of Science in|of Arts in)\s+([A-Z][A-Za-z&/ ]+?)(?:,|\s+[|·•—–-]\s+|\s+\d{4}|$)/);
      const afterShort = line.match(/^(?:[A-Z]\.?){2,4}\.?\s+([A-Z][A-Za-z&/ ]+?)(?:,|\s+[|·•—–-]\s+|\s+\d{4}|$)/);
      current.field = (afterIn?.[1] ?? afterShort?.[1])?.trim() ?? null;
    }
  }
  // lines that gave us nothing are dropped
  return entries.filter((entry) => entry.level || entry.school);
}

// the highest degree across the education entries
export function highestDegree(education: EducationEntry[]): DegreeLevel | null {
  let best: DegreeLevel | null = null;
  for (const entry of education) {
    if (entry.level && (!best || degreeAtLeast(entry.level, best))) best = entry.level;
  }
  return best;
}

// everything we read out of a resume
export type ParsedResume = {
  sections: ResumeSection[];
  contact: ResumeContact;
  experience: ExperienceEntry[];
  education: EducationEntry[];
  // null when no dates could be read
  yearsExperience: number | null;
  measurableResults: string[];
  wordCount: number;
};

// reads a whole resume from its plain text
export function parseResume(text: string, today: Date = new Date()): ParsedResume {
  const sections = detectSections(text);
  const linesOf = (kind: SectionKind) => sections.filter((section) => section.kind === kind).flatMap((section) => section.lines);

  const experience = parseExperience(linesOf("experience"), today);
  const ranges = experience.flatMap((entry) => (entry.dates ? [entry.dates] : []));

  return {
    sections,
    contact: extractContact(text),
    experience,
    education: parseEducation(linesOf("education")),
    yearsExperience: ranges.length > 0 ? yearsOfExperience(ranges) : null,
    measurableResults: measurableResults(sections),
    wordCount: wordCount(text),
  };
}
