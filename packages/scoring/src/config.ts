import type { ScoreCategory } from "@resumefit/shared";

// how much each part of the report counts toward the match rate, tweak here
export const SCORE_WEIGHTS: Record<ScoreCategory, number> = {
  hardSkills: 0.5,
  softSkills: 0.15,
  searchability: 0.15,
  recruiterTips: 0.1,
  formatting: 0.1,
};

// knobs for the skill math
export const SKILL_CONFIG = {
  requiredBoost: 1.5,
  relatedCredit: 0.5,
};

// score cutoffs for the gauge colors
export const SCORE_BANDS = {
  good: 75,
  okay: 40,
};

// limits for the recruiter tip and formatting checks
export const CHECK_CONFIG = {
  minMeasurableResults: 5,
  minWords: 300,
  maxWords: 1000,
  // people with ten or more years get a little more room
  maxWordsSenior: 1200,
  // more bullets than this starting with the same verb gets flagged
  maxSameVerb: 3,
  maxParagraphWords: 50,
  maxSpecialChars: 5,
  maxBoldShare: 0.3,
  maxLightTextShare: 0.02,
  maxOffLeftShare: 0.3,
  maxFonts: 3,
  // body text size in points
  minFontSize: 9.5,
  maxFontSize: 12.5,
  // margins in inches
  minMargin: 0.4,
  maxMargin: 1.3,
  // under this many years counts as early career, where one page is enough
  newGradYears: 3,
};
