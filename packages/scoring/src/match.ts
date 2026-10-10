import type { SkillMatch } from "@resumefit/shared";

// one skill from the skill lists
export type SkillTerm = {
  name: string;
  // other spellings that count as the same skill
  aliases?: string[];
  // close cousins that only get half credit
  related?: string[];
};

// characters that are part of a skill name, so "C" does not match inside "C++" or "Excel" inside "excellent"
const SKILL_CHARS = "A-Za-z0-9+#";

// turns a skill name into a pattern that finds it as a whole word
function termPattern(term: string): RegExp {
  let body = "";
  for (const char of term.trim()) {
    // spaces and hyphens are interchangeable, "object oriented" matches "object-oriented"
    if (char === " " || char === "-") body += "[\\s-]+";
    else body += char.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
  }
  // tiny all letter names like Go, JS and ML have to match the exact casing or they hit normal words
  const exactCase = /^[A-Za-z]{1,2}$/.test(term.trim());
  return new RegExp(`(?<![${SKILL_CHARS}])${body}(?![${SKILL_CHARS}])`, exactCase ? "g" : "gi");
}

// one way of writing a skill, with what is needed to look for it quickly
type Spelling = { term: string; name: string; start: string; key: string; pattern: RegExp };

// the words of a text, cut at the same places a skill name is allowed to start and end
function wordSet(lower: string): Set<string> {
  return new Set(lower.match(new RegExp(`[${SKILL_CHARS}]+`, "g")) ?? []);
}

// true when a spelling cannot be in the text, decided without running its pattern
function ruledOut(spelling: Spelling, lower: string, words: Set<string>): boolean {
  // the first word of the spelling has to be a whole word of the text, which is one cheap lookup
  if (spelling.key) return !words.has(spelling.key);
  // names that start with a symbol, like .NET, fall back to a plain search
  return !lower.includes(spelling.start);
}

// the spellings of one skill, worked out once and kept with the skill itself.
// building a pattern is the slow part, and scans put the same skills into fresh lists all the time
const termCache = new WeakMap<SkillTerm, Spelling[]>();
// the sorted spellings of a whole list, for lists that are reused as they are
const listCache = new WeakMap<SkillTerm[], Spelling[]>();

// the ways one skill can be written
function spellingsOfTerm(skill: SkillTerm): Spelling[] {
  let spellings = termCache.get(skill);
  if (!spellings) {
    spellings = [skill.name, ...(skill.aliases ?? [])].map((term) => {
      const start = (term.trim().toLowerCase().split(/[\s-]/)[0] ?? "").trim();
      return { term, name: skill.name, start, key: start.match(new RegExp(`^[${SKILL_CHARS}]+`))?.[0] ?? "", pattern: termPattern(term) };
    });
    termCache.set(skill, spellings);
  }
  return spellings;
}

// every spelling of every skill, longest first so "Node.js" is taken before "Node"
function spellingsOf(skills: SkillTerm[]): Spelling[] {
  let spellings = listCache.get(skills);
  if (!spellings) {
    spellings = skills.flatMap(spellingsOfTerm).sort((a, b) => b.term.length - a.term.length);
    listCache.set(skills, spellings);
  }
  return spellings;
}

// counts how many times each skill shows up in a piece of text
export function countSkills(text: string, skills: SkillTerm[]): Map<string, number> {
  const counts = new Map<string, number>();
  const lower = text.toLowerCase();
  let remaining = text;
  const words = wordSet(lower);
  for (const spelling of spellingsOf(skills)) {
    // nearly every spelling is ruled out here, before its pattern is ever run
    if (ruledOut(spelling, lower, words)) continue;
    const { name, pattern } = spelling;
    let found = 0;
    pattern.lastIndex = 0;
    // blank out each hit so a shorter spelling cannot count the same words again
    remaining = remaining.replace(pattern, (hit) => {
      found += 1;
      return " ".repeat(hit.length);
    });
    if (found > 0) counts.set(name, (counts.get(name) ?? 0) + found);
  }
  return counts;
}

// true when any of the terms appears in the text
function hasAny(text: string, terms: string[]): boolean {
  return terms.some((term) => termPattern(term).test(text));
}

// headings and phrases that mark skills as optional
const PREFERRED_HEADING = /\b(preferred|nice to have|nice-to-haves?|bonus|desired|pluses)\b/i;
const PREFERRED_PHRASE = /\b(is a plus|are a plus|a plus|nice to have|preferred|bonus points?|ideally)\b/i;
// headings that switch back to the must haves
const REQUIRED_HEADING = /\b(requirements?|required|minimum|basic qualifications|must have|responsibilities|what you.ll do|what you will do)\b/i;

// keeps only the parts of the job description that are must haves
export function requiredText(jdText: string): string {
  const kept: string[] = [];
  let optional = false;
  for (const line of jdText.split(/\r?\n/)) {
    const trimmed = line.trim();
    // short lines are treated as headings that flip the mode
    if (trimmed.length > 0 && trimmed.length <= 60) {
      if (PREFERRED_HEADING.test(trimmed)) {
        optional = true;
        continue;
      }
      if (REQUIRED_HEADING.test(trimmed)) optional = false;
    }
    if (optional) continue;
    // a sentence can also call itself optional, like "GraphQL is a plus"
    const sentences = line.split(/(?<=[.!?])\s+/).filter((sentence) => !PREFERRED_PHRASE.test(sentence));
    kept.push(sentences.join(" "));
  }
  return kept.join("\n");
}

// builds the skill rows for the report, one row per skill the job description asks for
export function matchSkills(
  jdText: string,
  resumeText: string,
  skills: SkillTerm[],
  category: SkillMatch["category"],
  // skills the user added by hand, these get a row even when the job never mentions them
  forced: Set<string> = new Set(),
): SkillMatch[] {
  const jdCounts = countSkills(jdText, skills);
  const resumeCounts = countSkills(resumeText, skills);
  // skills that only show up in the optional parts count as preferred
  const requiredCounts = countSkills(requiredText(jdText), skills);

  const rows: SkillMatch[] = [];
  for (const skill of skills) {
    const isForced = forced.has(skill.name);
    const jdCount = Math.max(jdCounts.get(skill.name) ?? 0, isForced ? 1 : 0);
    // skills the job never mentions are not part of the report
    if (jdCount === 0) continue;

    const resumeCount = resumeCounts.get(skill.name) ?? 0;
    // exact if the resume has it, related if it only has a similar term, otherwise missing
    let match: SkillMatch["match"] = "missing";
    if (resumeCount > 0) match = "exact";
    else if (hasAny(resumeText, skill.related ?? [])) match = "related";

    const importance = requiredCounts.has(skill.name) || isForced ? "required" : "preferred";
    rows.push({ name: skill.name, category, importance, jdCount, resumeCount, match });
  }

  // missing skills first, then the ones the job mentions most, required before preferred
  const order = { missing: 0, related: 1, exact: 2 } as const;
  const rank = { required: 0, preferred: 1 } as const;
  return rows.sort(
    (a, b) => order[a.match] - order[b.match] || b.jdCount - a.jdCount || rank[a.importance] - rank[b.importance] || a.name.localeCompare(b.name),
  );
}

// where one skill mention sits in a piece of text
export type SkillSpan = { start: number; end: number; name: string };

// finds every skill mention with its position, so the text can be shown with highlights
export function findSkillSpans(text: string, skills: SkillTerm[]): SkillSpan[] {
  const spans: SkillSpan[] = [];
  const lower = text.toLowerCase();
  let remaining = text;
  const words = wordSet(lower);
  for (const spelling of spellingsOf(skills)) {
    if (ruledOut(spelling, lower, words)) continue;
    const { name, pattern } = spelling;
    pattern.lastIndex = 0;
    // blank out each hit so a shorter spelling cannot mark the same words again
    remaining = remaining.replace(pattern, (hit, offset: number) => {
      spans.push({ start: offset, end: offset + hit.length, name });
      return " ".repeat(hit.length);
    });
  }
  return spans.sort((a, b) => a.start - b.start);
}
