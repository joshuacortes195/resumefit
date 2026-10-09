import { findSkillSpans, type ScanResult, type SkillSpan } from "@resumefit/scoring";
import { HARD_SKILLS, SOFT_SKILLS } from "@resumefit/skills-data";
import type { CustomSkill, SavedScan } from "@/lib/data/scans";
import { runScan } from "@/lib/data/scans";
import { SAMPLE_COMPANY, SAMPLE_JD, SAMPLE_JOB_TITLE, SAMPLE_RESUME } from "@/lib/sample-scan";

// everything the report page needs, in a shape that can be handed to the browser
export type ReportData = {
  id: string;
  // the sample report cannot be edited
  readOnly: boolean;
  jobTitle: string | null;
  company: string | null;
  jdText: string;
  resumeText: string;
  report: ScanResult;
  customSkills: CustomSkill[];
  educationOverride: string | null;
  // the job title the report looks for, when it differs from the one in the heading
  targetTitle: string | null;
  jobId: string | null;
  // the scan of the same posting before this one, for the score change
  previous: { id: string; matchRate: number } | null;
  createdAt: string;
  // where each skill sits in the two texts, for the highlights
  spans: { jd: SkillSpan[]; resume: SkillSpan[] };
  // false for pasted text, where layout and fonts cannot be checked
  hasLayout: boolean;
};

// finds where the report's skills sit in the resume and the job description
function buildSpans(report: ScanResult, jdText: string, resumeText: string): ReportData["spans"] {
  const names = new Set([...report.hardSkills, ...report.softSkills].map((skill) => skill.name));
  // use the full entries so other spellings get highlighted too
  const known = [...HARD_SKILLS, ...SOFT_SKILLS].filter((skill) => names.has(skill.name));
  const knownNames = new Set(known.map((skill) => skill.name));
  const terms = [...known, ...[...names].filter((name) => !knownNames.has(name)).map((name) => ({ name }))];
  return { jd: findSkillSpans(jdText, terms), resume: findSkillSpans(resumeText, terms) };
}

// packs a saved scan up for the report page
export function toReportData(scan: SavedScan, previous: ReportData["previous"]): ReportData {
  return {
    id: scan.id,
    readOnly: false,
    jobTitle: scan.jobTitle,
    company: scan.company,
    jdText: scan.jdText,
    resumeText: scan.resumeTextSnapshot,
    report: scan.report,
    customSkills: scan.customSkills,
    educationOverride: scan.educationOverride,
    targetTitle: scan.jobTitleOverride,
    jobId: scan.jobId,
    previous,
    createdAt: scan.createdAt.toISOString(),
    spans: buildSpans(scan.report, scan.jdText, scan.resumeTextSnapshot),
    hasLayout: scan.layoutMeta !== null,
  };
}

// the read only example report, built from made up data
export function sampleReportData(): ReportData {
  // a fixed date so the example never changes
  const today = new Date(2026, 0, 15);
  const report = runScan({ resumeText: SAMPLE_RESUME, jdText: SAMPLE_JD, jobTitle: SAMPLE_JOB_TITLE, layout: null, today });
  return {
    id: "sample",
    readOnly: true,
    jobTitle: SAMPLE_JOB_TITLE,
    company: SAMPLE_COMPANY,
    jdText: SAMPLE_JD,
    resumeText: SAMPLE_RESUME,
    report,
    customSkills: [],
    educationOverride: null,
    targetTitle: null,
    jobId: null,
    previous: null,
    createdAt: today.toISOString(),
    spans: buildSpans(report, SAMPLE_JD, SAMPLE_RESUME),
    hasLayout: false,
  };
}
