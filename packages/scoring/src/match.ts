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

// counts how many times each skill shows up in a piece of text
export function countSkills(text: string, skills: SkillTerm[]): Map<string, number> {
  // every spelling of every skill, longest first so "Node.js" is taken before "Node"
  const spellings = skills
    .flatMap((skill) => [skill.name, ...(skill.aliases ?? [])].map((term) => ({ term, name: skill.name })))
    .sort((a, b) => b.term.length - a.term.length);

  const counts = new Map<string, number>();
  let remaining = text;
  for (const { term, name } of spellings) {
    let found = 0;
    // blank out each hit so a shorter spelling cannot count the same words again
    remaining = remaining.replace(termPattern(term), (hit) => {
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
export function matchSkills(jdText: string, resumeText: string, skills: SkillTerm[], category: SkillMatch["category"]): SkillMatch[] {
  const jdCounts = countSkills(jdText, skills);
  const resumeCounts = countSkills(resumeText, skills);
  // skills that only show up in the optional parts count as preferred
  const requiredCounts = countSkills(requiredText(jdText), skills);

  const rows: SkillMatch[] = [];
  for (const skill of skills) {
    const jdCount = jdCounts.get(skill.name) ?? 0;
    // skills the job never mentions are not part of the report
    if (jdCount === 0) continue;

    const resumeCount = resumeCounts.get(skill.name) ?? 0;
    // exact if the resume has it, related if it only has a similar term, otherwise missing
    let match: SkillMatch["match"] = "missing";
    if (resumeCount > 0) match = "exact";
    else if (hasAny(resumeText, skill.related ?? [])) match = "related";

    const importance = requiredCounts.has(skill.name) ? "required" : "preferred";
    rows.push({ name: skill.name, category, importance, jdCount, resumeCount, match });
  }

  // missing skills first, then the ones the job mentions most, required before preferred
  const order = { missing: 0, related: 1, exact: 2 } as const;
  const rank = { required: 0, preferred: 1 } as const;
  return rows.sort(
    (a, b) => order[a.match] - order[b.match] || b.jdCount - a.jdCount || rank[a.importance] - rank[b.importance] || a.name.localeCompare(b.name),
  );
}
