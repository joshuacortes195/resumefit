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
  // no skills were read from the posting. that is not a perfect match, it is no evidence at all, so it earns nothing
  // and the match rate leaves the category out. see matchRate
  if (skills.length === 0) return 0;
  let earned = 0;
  let possible = 0;
  for (const skill of skills) {
    const weight = skillWeight(skill);
    earned += weight * matchCredit(skill.match);
    possible += weight;
  }
  return possible === 0 ? 0 : earned / possible;
}

// share of checks that passed, 0 to 1
export function checkScore(checks: { passed: boolean; info?: boolean }[]): number {
  // notes are shown in the report but never count
  const scored = checks.filter((check) => !check.info);
  if (scored.length === 0) return 1;
  return scored.filter((check) => check.passed).length / scored.length;
}

// rolls the category scores into the final match rate, 0 to 100.
// a category with nothing to judge is left out and the others share its weight, so "we could not read any skills" never counts as "you have them all"
export function matchRate(scores: CategoryScores, leftOut: ScoreCategory[] = []): number {
  let total = 0;
  let weight = 0;
  for (const category of Object.keys(SCORE_WEIGHTS) as ScoreCategory[]) {
    if (leftOut.includes(category)) continue;
    const clamped = Math.min(1, Math.max(0, scores[category]));
    total += SCORE_WEIGHTS[category] * clamped;
    weight += SCORE_WEIGHTS[category];
  }
  return weight === 0 ? 0 : Math.round((100 * total) / weight);
}

// picks the gauge color for a score
export function scoreBand(rate: number): "good" | "okay" | "low" {
  if (rate >= SCORE_BANDS.good) return "good";
  if (rate >= SCORE_BANDS.okay) return "okay";
  return "low";
}
