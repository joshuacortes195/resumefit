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
