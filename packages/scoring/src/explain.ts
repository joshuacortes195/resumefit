import type { ScoreCategory, SkillMatch } from "@resumefit/shared";
import type { Check, CheckGroup } from "./checks";
import { SCORE_WEIGHTS } from "./config";
import type { ScanResult } from "./scan";
import { checkScore, lightScale, skillScore, type CategoryScores } from "./score";

// one part of the score: how much of the whole it is, how it did, and the points it put in
export type ScorePart = { category: ScoreCategory; weight: number; score: number; earned: number; possible: number };

// one thing to change, with how many points of match rate it is worth
export type ScoreFix = { kind: "skill" | "check"; category: ScoreCategory; name: string; gain: number; group?: CheckGroup };

export type ScoreExplanation = {
  parts: ScorePart[];
  // the changes worth the most, biggest first
  fixes: ScoreFix[];
  // set when the score is held at a ceiling, so no single fix moves it
  heldAt: number | null;
};

// the pieces a score is worked out from
type Pieces = { hard: SkillMatch[]; soft: SkillMatch[]; checks: Check[] };

// the match rate before rounding, worked out the same way the scan does it
function exactRate(pieces: Pieces, unread: ScoreCategory[]): { rate: number; scores: CategoryScores; weights: Partial<CategoryScores> } {
  const of = (category: Check["category"]) => pieces.checks.filter((check) => check.category === category);
  const scores: CategoryScores = { hardSkills: skillScore(pieces.hard), softSkills: skillScore(pieces.soft), searchability: checkScore(of("searchability")), recruiterTips: checkScore(of("recruiterTips")), formatting: checkScore(of("formatting")) };
  const weights: Partial<CategoryScores> = {};
  let total = 0;
  let weight = 0;
  for (const category of Object.keys(SCORE_WEIGHTS) as ScoreCategory[]) {
    if (unread.includes(category)) continue;
    // soft skills that are mostly filler count for less, the same as in the scan
    const share = SCORE_WEIGHTS[category] * (category === "softSkills" ? lightScale(pieces.soft) : 1);
    weights[category] = share;
    total += share * Math.min(1, Math.max(0, scores[category]));
    weight += share;
  }
  // each weight as a share of what is actually being judged
  for (const category of Object.keys(weights) as ScoreCategory[]) weights[category] = weight === 0 ? 0 : (weights[category] ?? 0) / weight;
  return { rate: weight === 0 ? 0 : (100 * total) / weight, scores, weights };
}

// says where a match rate comes from, and which single changes would raise it the most.
// every gain is found by scoring the resume again with that one thing fixed, so the numbers are the scorer's own
export function explainScore(result: Pick<ScanResult, "hardSkills" | "softSkills" | "checks" | "unread" | "cap" | "matchRate">, limit = 6): ScoreExplanation {
  const unread = (result.unread ?? []) as ScoreCategory[];
  const pieces: Pieces = { hard: result.hardSkills, soft: result.softSkills, checks: result.checks };
  const now = exactRate(pieces, unread);
  const ceiling = result.cap?.limit ?? 100;
  const held = (rate: number) => Math.min(rate, ceiling);

  const parts = (Object.keys(now.weights) as ScoreCategory[]).map((category) => {
    const weight = now.weights[category] ?? 0;
    const score = Math.min(1, Math.max(0, now.scores[category]));
    return { category, weight: Math.round(weight * 1000) / 10, score: Math.round(score * 100), earned: Math.round(weight * score * 1000) / 10, possible: Math.round(weight * 1000) / 10 };
  });

  const fixes: ScoreFix[] = [];
  // each skill the resume does not fully cover, scored as if it were there
  for (const [list, category] of [
    [result.hardSkills, "hardSkills"],
    [result.softSkills, "softSkills"],
  ] as const) {
    const seen = new Set<string>();
    for (const skill of list) {
      if (skill.match === "exact") continue;
      // an "any one of" list is fixed by adding any one of them, so it is offered once
      const group = skill.options ? [skill.name, ...skill.options].sort().join("|") : skill.name;
      if (seen.has(group)) continue;
      seen.add(group);
      const fixed = list.map((entry) => (entry === skill || (skill.options && entry.options && [entry.name, ...entry.options].sort().join("|") === group) ? { ...entry, match: "exact" as const } : entry));
      const after = exactRate(category === "hardSkills" ? { ...pieces, hard: fixed } : { ...pieces, soft: fixed }, unread);
      fixes.push({ kind: "skill", category, name: skill.options ? [skill.name, ...skill.options].slice(0, 3).join(" or ") : skill.name, gain: held(after.rate) - held(now.rate) });
    }
  }
  // each check that failed, scored as if it had passed
  for (const check of result.checks) {
    if (check.passed || check.info) continue;
    const after = exactRate({ ...pieces, checks: result.checks.map((entry) => (entry === check ? { ...entry, passed: true } : entry)) }, unread);
    fixes.push({ kind: "check", category: check.category, name: check.message, gain: held(after.rate) - held(now.rate), group: check.group });
  }

  return {
    parts,
    fixes: fixes
      .filter((fix) => fix.gain >= 0.05)
      .sort((a, b) => b.gain - a.gain)
      .slice(0, limit)
      .map((fix) => ({ ...fix, gain: Math.round(fix.gain * 10) / 10 })),
    heldAt: result.cap && now.rate > result.cap.limit ? result.cap.limit : null,
  };
}
