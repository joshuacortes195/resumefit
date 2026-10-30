import type { ScoreCategory, SkillMatch } from "@resumefit/shared";
import { SCORE_BANDS, SCORE_WEIGHTS, SKILL_CONFIG } from "./config";

export type CategoryScores = Record<ScoreCategory, number>;

// skills that show up more in the job description count more, required ones get a boost.
// a skill from an "any one of" list shares one skill's weight with the rest of its list, and a light soft skill counts for less
export function skillWeight(skill: Pick<SkillMatch, "jdCount" | "importance"> & Partial<Pick<SkillMatch, "options" | "light">>, ignoreLight = false): number {
  const frequency = 1 + Math.log2(Math.max(1, skill.jdCount));
  const share = 1 / (1 + (skill.options?.length ?? 0));
  const light = skill.light && !ignoreLight ? SKILL_CONFIG.lightWeight : 1;
  return frequency * (skill.importance === "required" ? SKILL_CONFIG.requiredBoost : 1) * share * light;
}

// how much a list of skills is worth next to the same list with nothing marked light, 0 to 1.
// a soft skills part made only of filler should not move the match rate as much as one the job really asks for
export function lightScale(skills: SkillMatch[]): number {
  const full = skills.reduce((sum, skill) => sum + skillWeight(skill, true), 0);
  return full === 0 ? 1 : skills.reduce((sum, skill) => sum + skillWeight(skill), 0) / full;
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
// scale shrinks a category's weight, like a soft skills part that is mostly filler
export function matchRate(scores: CategoryScores, leftOut: ScoreCategory[] = [], scale: Partial<CategoryScores> = {}): number {
  let total = 0;
  let weight = 0;
  for (const category of Object.keys(SCORE_WEIGHTS) as ScoreCategory[]) {
    if (leftOut.includes(category)) continue;
    const clamped = Math.min(1, Math.max(0, scores[category]));
    const categoryWeight = SCORE_WEIGHTS[category] * (scale[category] ?? 1);
    total += categoryWeight * clamped;
    weight += categoryWeight;
  }
  return weight === 0 ? 0 : Math.round((100 * total) / weight);
}

// picks the gauge color for a score
export function scoreBand(rate: number): "good" | "okay" | "low" {
  if (rate >= SCORE_BANDS.good) return "good";
  if (rate >= SCORE_BANDS.okay) return "okay";
  return "low";
}
