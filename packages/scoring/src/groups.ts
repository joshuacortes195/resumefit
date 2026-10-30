import type { SkillMatch } from "@resumefit/shared";
import { findSkillSpans, unflatten, type SkillSpan, type SkillTerm } from "./match";

// one "any one of these" list from a posting, like "Java, Python, C++, Go, or TypeScript", with where each skill sat
export type AlternativeGroup = SkillSpan[];

// the joining words a list can use
const JOIN = /^(?:or|and\/or|and|&|nor)$/i;
const OR_JOIN = /^(?:or|and\/or)\b/i;

// reads what sits between two skills. a list gap is separators plus maybe a few short items we do not know as skills,
// like ", System Integration, " or ", Bare-Metal, or ". choice is true when an "or" or a slash joins them
function listGap(gap: string): { list: boolean; choice: boolean } {
  const pieces = gap.split(/[,/;]/).map((piece) => piece.trim());
  // one piece means no separator at all, which is only a list when it is a joining word like "and" or "or"
  if (pieces.length === 1) {
    const only = pieces[0] ?? "";
    return { list: JOIN.test(only), choice: OR_JOIN.test(only) };
  }
  const first = pieces[0] ?? "";
  const last = pieces.at(-1) ?? "";
  // the gap has to start right at a separator and end on one or a joining word
  if (first !== "" || !(last === "" || JOIN.test(last))) return { list: false, choice: false };
  const middle = pieces.slice(1, -1).map((piece) => piece.replace(/^(?:or|and\/or|and)\s+/i, ""));
  const short = middle.every((piece) => piece.split(/\s+/).length <= 4 && piece.length <= 40);
  return { list: short, choice: short && (gap.includes("/") || pieces.some((piece) => OR_JOIN.test(piece))) };
}

// true when the rest of a list after its last skill ends with "or" plus a few short items, like ", ARM, Bare-Metal, or Kernel"
function endsInOr(after: string): boolean {
  const clause = after.split(/[.;:\n]/)[0] ?? "";
  const pieces = clause.split(",").map((piece) => piece.trim());
  const last = pieces.at(-1) ?? "";
  return pieces[0] === "" && /^(?:or|and\/or)\s+\S/i.test(last) && pieces.every((piece) => piece.split(/\s+/).length <= 5);
}
// words before a list that make it a choice even when it ends in "and"
const CHOICE_LEAD = /(?:one or more of|one of|any of|at least one|either|such as|e\.g\.?,?|for example|for instance|like|including|e\.g\.,)(?:\s+the following)?\s*:?\s*(?:\(\s*)?$/i;
// words after a list that make it a choice: "or related", "or similar", "or equivalent"
const CHOICE_TAIL = /^\s*,?\s*(?:or|and\/or)\s+(?:other|similar|related|equivalent|another|comparable|a related|an equivalent)\b/i;
// a line about a degree, where a list of fields always means any one of them
const DEGREE_LINE = /\b(?:degree|bachelor|master|ph\.?d|b\.?s\.?|m\.?s\.?|major|field of study|enrolled)\b/i;
// a line that opens a block of choices on the lines under it
const BLOCK_LEAD = /(?:one or more of|one of|any of|at least one of|any combination of)(?:\s+the following)?\s*:?\s*$/i;

// the marks at the start of a list line, like "- o" or "•", used to tell sub items from the line that opened them
function markOf(line: string): string {
  return (line.match(/^\s*(?:[-–—•▪◦●○■·*]\s*|o\s+|\d+[.)]\s*)*/)?.[0] ?? "").replace(/\s+/g, "");
}

// the skill lists in a posting that ask for any one of their skills, not all of them
export function findAlternativeGroups(jdText: string, skills: SkillTerm[]): AlternativeGroup[] {
  const text = unflatten(jdText);
  const spans = findSkillSpans(text, skills);
  const lines: { start: number; end: number; text: string }[] = [];
  let at = 0;
  for (const line of text.split("\n")) {
    lines.push({ start: at, end: at + line.length, text: line });
    at += line.length + 1;
  }
  const spansIn = (from: number, to: number) => spans.filter((span) => span.start >= from && span.end <= to);
  const groups: AlternativeGroup[] = [];
  const add = (members: SkillSpan[]) => {
    if (new Set(members.map((span) => span.name)).size >= 2) groups.push(members);
  };

  lines.forEach((line, index) => {
    // lists inside one line
    const inLine = spansIn(line.start, line.end);
    let run: SkillSpan[] = [];
    let choice = false;
    const close = () => {
      const first = run[0];
      const last = run.at(-1);
      if (first && last && run.length >= 2) {
        const before = text.slice(Math.max(line.start, first.start - 60), first.start);
        const after = text.slice(last.end, line.end);
        if (choice || CHOICE_LEAD.test(before) || CHOICE_TAIL.test(after.slice(0, 40)) || endsInOr(after) || DEGREE_LINE.test(line.text)) add(run);
      }
      run = [];
      choice = false;
    };
    for (const span of inLine) {
      const previous = run.at(-1);
      const gap = previous ? listGap(text.slice(previous.end, span.start)) : null;
      if (previous && gap?.list) {
        if (gap.choice) choice = true;
        run.push(span);
      } else {
        close();
        run = [span];
      }
    }
    close();

    // "Experience with one or more of the following:" and the list lines under it
    if (BLOCK_LEAD.test(line.text.trim())) {
      const lead = markOf(line.text);
      const members: SkillSpan[] = [];
      let itemMark: string | null = null;
      for (const next of lines.slice(index + 1, index + 12)) {
        if (!next.text.trim()) break;
        const mark = markOf(next.text);
        itemMark ??= mark;
        // the block ends at a line that goes back to the outer list
        if (mark !== itemMark || (itemMark === lead && lead !== "" && members.length > 0 && next.text.trim().length > 80)) break;
        members.push(...spansIn(next.start, next.end));
      }
      add(members);
    }
  });
  return groups;
}

// any one skill from a list is enough. a skill whose every list already has a match on the resume is not missing at all,
// and one from a list with no match yet shares a single skill's weight with the others in it
export function applyAlternatives(rows: SkillMatch[], groups: AlternativeGroup[], forced: Set<string> = new Set()): SkillMatch[] {
  if (groups.length === 0) return rows;
  const byName = new Map(rows.map((row) => [row.name, row]));
  // how many of each skill's mentions sit inside a list. one mention outside a list means the job asks for it on its own
  const seen = new Map<string, Set<number>>();
  for (const group of groups) {
    for (const span of group) seen.set(span.name, (seen.get(span.name) ?? new Set()).add(span.start));
  }
  const clauses = groups.map((group) => [...new Set(group.map((span) => span.name))].filter((name) => byName.has(name)));
  const covered = (clause: string[]) => clause.some((name) => byName.get(name)?.match === "exact");

  const kept: SkillMatch[] = [];
  for (const row of rows) {
    const inLists = seen.get(row.name)?.size ?? 0;
    if (row.match === "exact" || forced.has(row.name) || inLists < row.jdCount) {
      kept.push(row);
      continue;
    }
    const mine = clauses.filter((clause) => clause.includes(row.name) && clause.length >= 2);
    const open = mine.find((clause) => !covered(clause));
    // every list it is in already has a match, so the job's ask is met
    if (mine.length > 0 && !open) continue;
    if (!open) {
      kept.push(row);
      continue;
    }
    // when one of its lists is already met, what is left is the other list, which is usually the nice to have one
    const partlyMet = mine.some(covered);
    kept.push({ ...row, options: open.filter((name) => name !== row.name), ...(partlyMet ? { importance: "preferred" as const } : {}) });
  }
  return kept;
}
