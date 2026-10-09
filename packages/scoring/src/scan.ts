import type { SkillMatch } from "@resumefit/shared";
import { formattingChecks, recruiterTipChecks, searchabilityChecks, type Check } from "./checks";
import { analyzeJd, stripIgnoredSections, type JdAnalysis } from "./jd";
import type { LayoutMeta } from "./layout";
import { matchSkills, type SkillTerm } from "./match";
import { parseResume, type DegreeLevel, type ParsedResume } from "./parse";
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
  // layout details from the uploaded file, missing for pasted text
  layout?: LayoutMeta | null;
  // the date "Present" stands for, so saved scans can be rerun and give the same answer
  today?: Date;
};

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
  const jd = analyzeJd(jdText, input.jobUrl);
  const jobTitle = input.jobTitle?.trim() || jd.jobTitle;

  // compare skills against the parts of the posting that are about the job
  const jobText = stripIgnoredSections(jdText);
  const forced = new Set((input.customSkills ?? []).map((skill) => skill.name));
  const hard = matchSkills(jobText, resumeText, withCustom(input.hardSkills, input.customSkills, "hard"), "hard", forced);
  const soft = matchSkills(jobText, resumeText, withCustom(input.softSkills, input.customSkills, "soft"), "soft", forced);

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
