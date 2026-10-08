import type { ScoreCategory, SkillMatch } from "@resumefit/shared";
import { SCORE_BANDS, SCORE_WEIGHTS, SKILL_CONFIG } from "./config";

export type CategoryScores = Record<ScoreCategory, number>;

// skills that show up more in the job description count more, required ones get a boost
export function skillWeight(skill: Pick<SkillMatch, "jdCount" | "importance">): number {
  const frequency = 1 + Math.log2(Math.max(1, skill.jdCount));
  return frequency * (skill.importance === "required" ? SKILL_CONFIG.requiredBoost : 1);
}

// full credit for exact, half for a similar term, nothing if missing
export function matchCredit(match: SkillMatch["match"]): number {
  if (match === "exact") return 1;
  if (match === "related") return SKILL_CONFIG.relatedCredit;
  return 0;
}

// weighted share of the job's skills that the resume covers, 0 to 1
export function skillScore(skills: SkillMatch[]): number {
  // no skills to check means nothing to lose points on
  if (skills.length === 0) return 1;
  let earned = 0;
  let possible = 0;
  for (const skill of skills) {
    const weight = skillWeight(skill);
    earned += weight * matchCredit(skill.match);
    possible += weight;
  }
  return possible === 0 ? 1 : earned / possible;
}

// share of checks that passed, 0 to 1
export function checkScore(checks: { passed: boolean }[]): number {
  if (checks.length === 0) return 1;
  return checks.filter((check) => check.passed).length / checks.length;
}

// rolls the five category scores into the final match rate, 0 to 100
export function matchRate(scores: CategoryScores): number {
  let total = 0;
  for (const category of Object.keys(SCORE_WEIGHTS) as ScoreCategory[]) {
    const clamped = Math.min(1, Math.max(0, scores[category]));
    total += SCORE_WEIGHTS[category] * clamped;
  }
  return Math.round(100 * total);
}

// picks the gauge color for a score
export function scoreBand(rate: number): "good" | "okay" | "low" {
  if (rate >= SCORE_BANDS.good) return "good";
  if (rate >= SCORE_BANDS.okay) return "okay";
  return "low";
}
