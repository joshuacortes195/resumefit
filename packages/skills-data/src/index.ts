// skill lists: a hand picked core, plus a few thousand tools and technologies from the O*NET database
import { CURATED_HARD_SKILLS, type SkillEntry } from "./curated";
import onetSkills from "./onet-skills.json" with { type: "json" };

export * from "./curated";

// tools and technologies from O*NET (CC BY 4.0), built by scripts/build-skills.ts. names already in the hand picked list are left out there
export const ONET_SKILLS: SkillEntry[] = onetSkills;

// every hard skill we look for, the hand picked ones first
export const HARD_SKILLS: SkillEntry[] = [...CURATED_HARD_SKILLS, ...ONET_SKILLS];
