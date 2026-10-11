import { detectAts, type AtsInfo } from "./ats";
import { requiredText, unflatten } from "./match";
import { DEGREE_LEVELS, findDegreeLevels, looksLikeTitle, type DegreeLevel } from "./parse";

// what we can read from a job description without any ai
export type JdAnalysis = {
  jobTitle: string | null;
  company: string | null;
  // lowest number of years the job asks for, null when it does not say
  yearsRequired: number | null;
  // the years a title like Senior or Staff usually stands for, null when the title names no level. missing on scans saved before this was read
  levelYears?: number | null;
  educationRequired: DegreeLevel | null;
  educationPreferred: DegreeLevel | null;
  ats: AtsInfo | null;
};

// headings for parts of a posting that say nothing about the work
const IGNORED_HEADING =
  /^(?:our )?(?:benefits|perks|perks (?:and|&) benefits|benefits (?:and|&) perks|what we offer|what you.ll get|compensation|compensation (?:and|&) benefits|salary|pay range|equal opportunity|eeo statement|diversity|privacy notice|legal|disclaimer|how to apply|about the benefits)\b/i;
// headings that bring us back to the job itself
const JOB_HEADING =
  /^(?:requirements?|qualifications?|basic qualifications|minimum qualifications|preferred qualifications|responsibilities|what you.ll do|what you will do|what you.ll bring|what we.re looking for|who you are|about the role|about you|the role|skills|nice to have|must have|duties|your impact|key responsibilities)\b/i;
// single lines of legal text that show up anywhere
const LEGAL_LINE = /equal opportunity employer|without regard to race|reasonable accommodation|e-verify|background check|protected veteran/i;

// drops benefits, perks and legal text so their words are not counted as skills
export function stripIgnoredSections(jdText: string): string {
  const kept: string[] = [];
  let ignoring = false;
  for (const line of unflatten(jdText).split(/\r?\n/)) {
    const trimmed = line.trim().replace(/[:*#]+$/g, "").replace(/^[#*\s]+/, "");
    // only short lines can be headings
    if (trimmed.length > 0 && trimmed.length <= 60) {
      if (IGNORED_HEADING.test(trimmed)) {
        ignoring = true;
        continue;
      }
      if (JOB_HEADING.test(trimmed)) ignoring = false;
    }
    if (ignoring) continue;
    // legal wording is dropped a sentence at a time. dropping the whole line used to throw away a whole paragraph, skills and all, for one sentence at its end
    kept.push(
      line
        .split(/(?<=[.!?])\s+/)
        .filter((sentence) => !LEGAL_LINE.test(sentence))
        .join(" "),
    );
  }
  return kept.join("\n");
}

// the years of work a title usually asks for, going by the level named in it. null when it names none
const LEVELS: [years: number, signs: RegExp][] = [
  [12, /\b(vp|rvp|svp|evp|avp|vice president|chief|c[efot]o)\b/i],
  [9, /\b(director|head of|principal|distinguished|fellow)\b/i],
  [7, /\bstaff\b/i],
  [5, /\b(lead|manager|architect)\b/i],
  [4, /\b(senior|sr)\b\.?/i],
];
export function yearsWanted(title: string): number | null {
  return LEVELS.find(([, signs]) => signs.test(title))?.[0] ?? null;
}

// number words people use for years of experience
const NUMBER_WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
const YEARS = /(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten)\s*(?:\+|plus|or more)?\s*(?:(?:-|–|to)\s*\d{1,2}\s*\+?\s*)?(?:years?|yrs?)/gi;

// the most years of experience the must have parts ask for, like "5+ years"
export function findYearsRequired(jdText: string): number | null {
  let most: number | null = null;
  // only sentences about experience count, not "401k after 2 years"
  for (const sentence of requiredText(jdText).split(/(?<=[.!?])\s+|\n/)) {
    if (!/experience|exp\b|background|work(?:ing)? (?:with|in)/i.test(sentence)) continue;
    for (const hit of sentence.matchAll(YEARS)) {
      const raw = (hit[1] ?? "").toLowerCase();
      const years = NUMBER_WORDS[raw] ?? Number(raw);
      if (Number.isFinite(years) && years > 0 && years <= 30 && (most === null || years > most)) most = years;
    }
  }
  return most;
}

// the lowest degree in a list, since "bachelor's or master's" means a bachelor's is enough
function lowest(levels: DegreeLevel[]): DegreeLevel | null {
  if (levels.length === 0) return null;
  return levels.reduce((low, level) => (DEGREE_LEVELS.indexOf(level) < DEGREE_LEVELS.indexOf(low) ? level : low));
}

// only lines that talk about schooling are checked for degrees
const EDUCATION_LINE = /degree|diploma|bachelor|master|doctorate|ph\.?d|\bB\.?[SA]\b|\bM\.?[SA]\b|MBA|GED|education/i;

// the degree a job asks for and the one it would like to see
export function findEducation(jdText: string): { required: DegreeLevel | null; preferred: DegreeLevel | null } {
  const educationLines = (text: string) =>
    text
      .split(/\r?\n/)
      .filter((line) => EDUCATION_LINE.test(line))
      .join("\n");
  const must = requiredText(jdText);
  const required = lowest(findDegreeLevels(educationLines(must)));
  // whatever only shows up in the optional parts is a nice to have
  const everywhere = findDegreeLevels(educationLines(jdText));
  const mustLevels = findDegreeLevels(educationLines(must));
  const preferred = lowest(everywhere.filter((level) => !mustLevels.includes(level)));
  return { required, preferred };
}

// tidies a title like "Senior Engineer (Remote) - Austin" down to the title itself
function cleanTitle(raw: string): string {
  return raw
    .replace(/\([^)]*\)/g, " ")
    .replace(/\s+[-–—|]\s+.*$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

// guesses the job title and company from the top of the posting
export function findJobTitle(jdText: string): { jobTitle: string | null; company: string | null } {
  const lines = jdText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  // company from a labelled line, or "at Acme" after the title
  let company = jdText.match(/^\s*(?:company|employer|organization)\s*[:\-]\s*(.{2,60})$/im)?.[1]?.trim() ?? null;

  // a labelled line like "Job title: Data Analyst" is the surest sign
  const labelled = jdText.match(/^\s*(?:job title|position|role|title)\s*[:\-]\s*(.{3,80})$/im)?.[1];
  if (labelled) return { jobTitle: cleanTitle(labelled), company };

  // otherwise the first short line near the top that reads like a title
  for (const line of lines.slice(0, 5)) {
    if (line.length > 80 || /[.!?]$/.test(line) || !looksLikeTitle(line)) continue;
    const at = line.match(/^(.+?)\s+(?:at|@)\s+(.+)$/i);
    if (at?.[1] && at[2]) {
      company ??= cleanTitle(at[2]);
      return { jobTitle: cleanTitle(at[1]), company };
    }
    return { jobTitle: cleanTitle(line), company };
  }

  // last try, a sentence like "we are looking for a Frontend Engineer to ..."
  const sentence = jdText.match(/(?:looking for|seeking|hiring)\s+an?\s+((?:[A-Z][A-Za-z/&+.-]*\s?){1,5})/);
  const guess = sentence?.[1]?.trim();
  return { jobTitle: guess && looksLikeTitle(guess) ? guess : null, company };
}

// reads everything we can from the job description text
export function analyzeJd(jdText: string, jobUrl?: string): JdAnalysis {
  const education = findEducation(jdText);
  return {
    ...findJobTitle(jdText),
    yearsRequired: findYearsRequired(jdText),
    educationRequired: education.required,
    educationPreferred: education.preferred,
    ats: detectAts(jobUrl, jdText),
  };
}
