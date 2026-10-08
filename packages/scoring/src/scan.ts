import type { SkillMatch } from "@resumefit/shared";
import { recruiterTipChecks, searchabilityChecks, type Check } from "./checks";
import { matchSkills, type SkillTerm } from "./match";
import { detectSections, extractContact, type ResumeContact, type ResumeSection } from "./parse";
import { checkScore, matchRate, skillScore, type CategoryScores } from "./score";

// what a scan needs to run
export type ScanInput = {
  resumeText: string;
  jdText: string;
  jobTitle?: string;
  // the skill lists to look for
  hardSkills: SkillTerm[];
  softSkills: SkillTerm[];
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
  sections: ResumeSection[];
  contact: ResumeContact;
};

// counts the skills the resume does not fully cover
function skillIssues(skills: SkillMatch[]): number {
  return skills.filter((skill) => skill.match !== "exact").length;
}

// runs the whole scan on plain text, no network or file access needed
export function scanResume({ resumeText, jdText, jobTitle, hardSkills, softSkills }: ScanInput): ScanResult {
  // read the resume
  const sections = detectSections(resumeText);
  const contact = extractContact(resumeText);

  // compare skills against the job description
  const hard = matchSkills(jdText, resumeText, hardSkills, "hard");
  const soft = matchSkills(jdText, resumeText, softSkills, "soft");

  // run the pass or fail checks
  const checkInput = { text: resumeText, sections, contact, jobTitle };
  const searchability = searchabilityChecks(checkInput);
  const recruiterTips = recruiterTipChecks(checkInput);

  // formatting needs the original file layout, so plain text gets full marks there for now
  const categoryScores: CategoryScores = {
    hardSkills: skillScore(hard),
    softSkills: skillScore(soft),
    searchability: checkScore(searchability),
    recruiterTips: checkScore(recruiterTips),
    formatting: 1,
  };

  return {
    matchRate: matchRate(categoryScores),
    categoryScores,
    hardSkills: hard,
    softSkills: soft,
    checks: [...searchability, ...recruiterTips],
    issuesToFix: {
      hardSkills: skillIssues(hard),
      softSkills: skillIssues(soft),
      searchability: searchability.filter((check) => !check.passed).length,
      recruiterTips: recruiterTips.filter((check) => !check.passed).length,
      formatting: 0,
    },
    sections,
    contact,
  };
}
