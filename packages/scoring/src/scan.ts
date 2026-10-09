import type { SkillMatch } from "@resumefit/shared";
import { formattingChecks, recruiterTipChecks, searchabilityChecks, type Check } from "./checks";
import { analyzeJd, stripIgnoredSections, type JdAnalysis } from "./jd";
import type { LayoutMeta } from "./layout";
import { countSkills, matchSkills, type SkillTerm } from "./match";
import { DEGREE_LEVELS, parseResume, type DegreeLevel, type ParsedResume } from "./parse";
import { checkScore, matchRate, skillScore, type CategoryScores } from "./score";

// what a scan needs to run
export type ScanInput = {
  resumeText: string;
  jdText: string;
  // typed by the user, otherwise we guess it from the posting
  jobTitle?: string;
  jobUrl?: string;
  // the skill lists to look for
  hardSkills: SkillTerm[];
  softSkills: SkillTerm[];
  // skills the user added to this scan by hand
  customSkills?: { name: string; category: "hard" | "soft" }[];
  // lets the user correct the degree we read from the posting
  educationOverride?: DegreeLevel | "none" | null;
  // extra facts about the posting from an optional smarter read, used to fill gaps in our own
  hints?: JdHints | null;
  // layout details from the uploaded file, missing for pasted text
  layout?: LayoutMeta | null;
  // the date "Present" stands for, so saved scans can be rerun and give the same answer
  today?: Date;
};

// what an optional smarter read of the job description can add
export type JdHints = {
  jobTitle?: string | null;
  company?: string | null;
  yearsRequired?: number | null;
  educationRequired?: string | null;
  educationPreferred?: string | null;
  hardSkills?: string[];
  softSkills?: string[];
};

// words that are never a skill on their own
const NOT_SKILLS = new Set(["experience", "skills", "ability", "knowledge", "team", "work", "strong", "excellent", "years", "degree", "role", "job", "etc", "and", "or", "the"]);

// keeps hinted skills that look real, are in the posting and are not already in our lists
function usableHints(names: string[] | undefined, known: SkillTerm[], jdText: string): SkillTerm[] {
  const taken = new Set(known.flatMap((skill) => [skill.name, ...(skill.aliases ?? [])]).map((name) => name.toLowerCase()));
  const kept: SkillTerm[] = [];
  for (const raw of names ?? []) {
    const name = raw.trim();
    const lower = name.toLowerCase();
    const words = name.split(/\s+/).length;
    if (name.length < 2 || name.length > 40 || words > 4 || NOT_SKILLS.has(lower) || taken.has(lower)) continue;
    // a hint only counts when the posting really says it
    if (countSkills(jdText, [{ name }]).size === 0) continue;
    taken.add(lower);
    kept.push({ name });
  }
  return kept;
}

// a degree name only counts when it is one of the levels we know
function asDegree(value: string | null | undefined): DegreeLevel | null {
  return (DEGREE_LEVELS as readonly string[]).includes(value ?? "") ? (value as DegreeLevel) : null;
}

// everything the report page shows
export type ScanResult = {
  matchRate: number;
  categoryScores: CategoryScores;
  hardSkills: SkillMatch[];
  softSkills: SkillMatch[];
  checks: Check[];
  // how many things to fix in each part, shown next to the bars
  issuesToFix: Record<keyof CategoryScores, number>;
  // the job title the report checked for
  jobTitle: string | null;
  resume: ParsedResume;
  jd: JdAnalysis;
};

// counts the skills the resume does not fully cover
function skillIssues(skills: SkillMatch[]): number {
  return skills.filter((skill) => skill.match !== "exact").length;
}

// counts the checks that failed
function failed(checks: Check[]): number {
  return checks.filter((check) => !check.passed).length;
}

// adds the user's own skills to a list, skipping ones that are already there
function withCustom(skills: SkillTerm[], custom: ScanInput["customSkills"], category: "hard" | "soft"): SkillTerm[] {
  const known = new Set(skills.flatMap((skill) => [skill.name, ...(skill.aliases ?? [])]).map((name) => name.toLowerCase()));
  const extra = (custom ?? []).filter((skill) => skill.category === category && !known.has(skill.name.toLowerCase()));
  return extra.length > 0 ? [...skills, ...extra.map((skill) => ({ name: skill.name }))] : skills;
}

// runs the whole scan on plain text, no network or file access needed
export function scanResume(input: ScanInput): ScanResult {
  const { resumeText, jdText, layout = null } = input;

  // read the resume and the job description
  const resume = parseResume(resumeText, input.today);
  const own = analyzeJd(jdText, input.jobUrl);
  const hints = input.hints ?? {};
  // our own read wins, the hints only fill in what we could not find
  const jd: JdAnalysis = {
    ...own,
    jobTitle: own.jobTitle ?? (hints.jobTitle?.trim() || null),
    company: own.company ?? (hints.company?.trim() || null),
    yearsRequired: own.yearsRequired ?? (typeof hints.yearsRequired === "number" && hints.yearsRequired > 0 && hints.yearsRequired <= 30 ? hints.yearsRequired : null),
    educationRequired: own.educationRequired ?? asDegree(hints.educationRequired),
    educationPreferred: own.educationPreferred ?? asDegree(hints.educationPreferred),
  };
  const jobTitle = input.jobTitle?.trim() || jd.jobTitle;

  // compare skills against the parts of the posting that are about the job
  const jobText = stripIgnoredSections(jdText);
  const forced = new Set((input.customSkills ?? []).map((skill) => skill.name));
  const hardList = withCustom(input.hardSkills, input.customSkills, "hard");
  const softList = withCustom(input.softSkills, input.customSkills, "soft");
  // hinted skills join the lists for this scan, a skill we already know as soft stays soft
  const hintedHard = usableHints(hints.hardSkills, [...hardList, ...softList], jobText);
  const hintedSoft = usableHints(hints.softSkills, [...hardList, ...softList, ...hintedHard], jobText);
  const hard = matchSkills(jobText, resumeText, [...hardList, ...hintedHard], "hard", forced);
  const soft = matchSkills(jobText, resumeText, [...softList, ...hintedSoft], "soft", forced);

  // run the pass or fail checks
  const checkInput = { text: resumeText, parsed: resume, jd, jobTitle, educationOverride: input.educationOverride, layout };
  const searchability = searchabilityChecks(checkInput);
  const recruiterTips = recruiterTipChecks(checkInput);
  const formatting = formattingChecks(checkInput);

  const categoryScores: CategoryScores = {
    hardSkills: skillScore(hard),
    softSkills: skillScore(soft),
    searchability: checkScore(searchability),
    recruiterTips: checkScore(recruiterTips),
    formatting: checkScore(formatting),
  };

  return {
    matchRate: matchRate(categoryScores),
    categoryScores,
    hardSkills: hard,
    softSkills: soft,
    checks: [...searchability, ...recruiterTips, ...formatting],
    issuesToFix: {
      hardSkills: skillIssues(hard),
      softSkills: skillIssues(soft),
      searchability: failed(searchability),
      recruiterTips: failed(recruiterTips),
      formatting: failed(formatting),
    },
    jobTitle,
    resume,
    jd,
  };
}
