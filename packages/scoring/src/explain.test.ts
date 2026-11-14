import { describe, expect, it } from "vitest";
import type { SkillMatch } from "@resumefit/shared";
import type { Check } from "./checks";
import { explainScore } from "./explain";
import { checkScore, lightScale, matchRate, skillScore } from "./score";

const skill = (name: string, match: SkillMatch["match"], extra: Partial<SkillMatch> = {}): SkillMatch => ({ name, match, jdCount: 1, resumeCount: match === "missing" ? 0 : 1, importance: "preferred", ...extra }) as SkillMatch;
const check = (id: string, category: Check["category"], passed: boolean, extra: Partial<Check> = {}): Check => ({ id, category, group: "contact", passed, message: `${id} message`, ...extra });

// a result the way the scan builds it, from skills and checks
function result(hard: SkillMatch[], soft: SkillMatch[], checks: Check[], cap: { limit: number; reason: "levelGap" } | null = null) {
  const of = (category: Check["category"]) => checks.filter((entry) => entry.category === category);
  const unread = [...(hard.length === 0 ? (["hardSkills"] as const) : []), ...(soft.length === 0 ? (["softSkills"] as const) : [])];
  const raw = matchRate({ hardSkills: skillScore(hard), softSkills: skillScore(soft), searchability: checkScore(of("searchability")), recruiterTips: checkScore(of("recruiterTips")), formatting: checkScore(of("formatting")) }, unread, { softSkills: lightScale(soft) });
  return { hardSkills: hard, softSkills: soft, checks, unread, cap, matchRate: cap ? Math.min(raw, cap.limit) : raw };
}

const HARD = [skill("TypeScript", "exact", { importance: "required", jdCount: 3 }), skill("React", "exact"), skill("GraphQL", "missing", { importance: "required", jdCount: 2 }), skill("Docker", "missing"), skill("Kubernetes", "related")];
const SOFT = [skill("Communication", "exact"), skill("Mentoring", "missing")];
const CHECKS = [check("email", "searchability", true), check("title", "searchability", false, { group: "job-title" }), check("results", "recruiterTips", false), check("length", "recruiterTips", true), check("fonts", "formatting", true), check("note", "formatting", false, { info: true })];

describe("explaining a match rate", () => {
  it("adds up to the match rate the scan gave", () => {
    const scan = result(HARD, SOFT, CHECKS);
    const why = explainScore(scan);
    expect(Math.round(why.parts.reduce((sum, part) => sum + part.earned, 0))).toBe(scan.matchRate);
    expect(Math.round(why.parts.reduce((sum, part) => sum + part.possible, 0))).toBe(100);
    expect(why.parts.map((part) => part.category)).toEqual(["hardSkills", "softSkills", "searchability", "recruiterTips", "formatting"]);
  });

  it("gives each fix the gain the scorer itself would give", () => {
    const scan = result(HARD, SOFT, CHECKS);
    const why = explainScore(scan, 20);
    const graphql = why.fixes.find((fix) => fix.name === "GraphQL");
    // scoring it again by hand with GraphQL on the resume
    const again = result(HARD.map((entry) => (entry.name === "GraphQL" ? { ...entry, match: "exact" as const } : entry)), SOFT, CHECKS);
    expect(Math.abs((graphql?.gain ?? 0) - (again.matchRate - scan.matchRate))).toBeLessThanOrEqual(1);
    // a required skill named twice is worth more than a nice to have named once, and a half match is worth less than a miss
    const gain = (name: string) => why.fixes.find((fix) => fix.name === name)?.gain ?? 0;
    expect(gain("GraphQL")).toBeGreaterThan(gain("Docker"));
    expect(gain("Docker")).toBeGreaterThan(gain("Kubernetes"));
    // biggest first, and a note that does not count is never offered
    expect(why.fixes.map((fix) => fix.gain)).toEqual([...why.fixes.map((fix) => fix.gain)].sort((a, b) => b - a));
    expect(why.fixes.some((fix) => fix.name === "note message")).toBe(false);
    expect(why.fixes.find((fix) => fix.name === "title message")).toMatchObject({ kind: "check", category: "searchability", group: "job-title" });
  });

  it("offers an any one of list once, leaves out a part the posting gave nothing for, and says when the score is held", () => {
    const either = [skill("TypeScript", "exact"), skill("Java", "missing", { options: ["Go", "Rust"] }), skill("Go", "missing", { options: ["Java", "Rust"] }), skill("Rust", "missing", { options: ["Java", "Go"] })];
    const why = explainScore(result(either, [], CHECKS), 20);
    expect(why.fixes.filter((fix) => fix.kind === "skill").map((fix) => fix.name)).toEqual(["Java or Go or Rust"]);
    expect(why.parts.map((part) => part.category)).not.toContain("softSkills");
    const held = explainScore(result([skill("TypeScript", "exact"), skill("React", "exact")], SOFT, CHECKS.map((entry) => ({ ...entry, passed: true })), { limit: 60, reason: "levelGap" }));
    expect(held.heldAt).toBe(60);
    expect(held.fixes).toEqual([]);
  });
});
