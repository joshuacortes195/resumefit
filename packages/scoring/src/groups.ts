import type { SkillMatch } from "@resumefit/shared";
import { countSkills, findSkillSpans, unflatten, type SkillSpan, type SkillTerm } from "./match";
import { categoryTools, normalizeName, stemCount, stemWords } from "./wording";

// one "any one of these" list from a posting, like "Java, Python, C++, Go, or TypeScript".
// spans are the skills we know in it, with their text, and items is every choice as the posting wrote it, known or not
export type AlternativeGroup = { spans: (SkillSpan & { text: string })[]; items: string[] };

// words that end a list without being a choice of their own, like "or related fields"
const NOT_AN_ITEM = /^(?:related|other|similar|equivalent|another|comparable|a related|an equivalent)\b/i;

// cuts the text of a list into its choices, "C, C++, Firmware, or Kernel" into four
function listItems(region: string): string[] {
  return region
    .replace(/\([^)]*\)/g, " ")
    // a slash only splits when it has spaces round it, so CI/CD and TCP/IP stay whole
    .split(/,|\s\/\s|;|\s+(?:or|and\/or)\s+/i)
    .map((item) => item.replace(/^\s*(?:or|and\/or|and)\s+/i, "").replace(/[\s•*]+$/g, "").trim())
    .filter((item) => item.length > 0 && item.split(/\s+/).length <= 6 && !NOT_AN_ITEM.test(item));
}

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

// the choices written before the first skill we know, like the "C" in "Experience with C, C++, Firmware, or Kernel"
function leadingItems(before: string): string[] {
  const pieces = before.split(",");
  if ((pieces.at(-1) ?? "").trim() !== "") return [];
  const items: string[] = [];
  for (let i = pieces.length - 2; i >= 0; i--) {
    const piece = pieces[i] ?? "";
    // "Experience with C" or "Networking: C" starts the list, so only the words after "with" or the colon are a choice
    const parts = piece.split(/:|\b(?:with|in|of|using|including|such as|like|on)\s+/i);
    const item = (parts.at(-1) ?? "").trim();
    if (!item || item.split(/\s+/).length > 3) break;
    items.unshift(item);
    if (parts.length > 1) break;
  }
  return items;
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
  const add = (members: SkillSpan[], items: string[]) => {
    if (members.length > 0 && items.length >= 2) groups.push({ spans: members.map((span) => ({ ...span, text: text.slice(span.start, span.end) })), items });
  };

  lines.forEach((line, index) => {
    // lists inside one line
    const inLine = spansIn(line.start, line.end);
    let run: SkillSpan[] = [];
    let choice = false;
    const close = () => {
      const first = run[0];
      const last = run.at(-1);
      if (first && last) {
        const before = text.slice(Math.max(line.start, first.start - 60), first.start);
        const after = text.slice(last.end, line.end);
        const tail = endsInOr(after) || CHOICE_TAIL.test(after.slice(0, 40));
        // a lone known skill only counts as a list when the "or" list around it is plain to see, like ", Firmware, Hardware, or Operating Systems"
        const isList = run.length >= 2 ? choice || CHOICE_LEAD.test(before) || tail || DEGREE_LINE.test(line.text) : tail && /[,:]\s*$/.test(before);
        if (isList) {
          // the list runs to the end of its clause when it ends in "or ..." past the last skill we know
          const clauseEnd = tail ? last.end + (after.search(/[.;:\n]/) === -1 ? after.length : after.search(/[.;:\n]/)) : last.end;
          add(run, [...leadingItems(text.slice(line.start, first.start)), ...listItems(text.slice(first.start, clauseEnd))]);
        }
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
      const items: string[] = [];
      let itemMark: string | null = null;
      for (const next of lines.slice(index + 1, index + 12)) {
        if (!next.text.trim()) break;
        const mark = markOf(next.text);
        itemMark ??= mark;
        // the block ends at a line that goes back to the outer list
        if (mark !== itemMark || (itemMark === lead && lead !== "" && members.length > 0 && next.text.trim().length > 80)) break;
        members.push(...spansIn(next.start, next.end));
        items.push(next.text.replace(/^\s*(?:[-–—•▪◦●○■·*]\s*|o\s+|\d+[.)]\s*)*/, "").replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim());
      }
      add(members, items.filter(Boolean));
    }
  });
  return groups;
}

// true when the resume covers a list item we do not know as a skill, like "Version control systems" through Git
function itemOnResume(item: string, resumeText: string, resumeStems: string[]): boolean {
  if (stemCount({ name: item }, resumeStems) > 0) return true;
  const tools = categoryTools(item);
  return tools !== null && countSkills(resumeText, tools).size > 0;
}

// any one skill from a list is enough. a skill whose every list already has a match on the resume is not missing at all,
// and one from a list with no match yet shares a single skill's weight with the other choices in it
export function applyAlternatives(rows: SkillMatch[], groups: AlternativeGroup[], resumeText: string, forced: Set<string> = new Set()): SkillMatch[] {
  if (groups.length === 0) return rows;
  const byName = new Map(rows.map((row) => [row.name, row]));
  const resumeStems = stemWords(resumeText);
  // how many of each skill's mentions sit inside a list. one mention outside a list means the job asks for it on its own
  const seen = new Map<string, Set<number>>();
  for (const group of groups) {
    for (const span of group.spans) seen.set(span.name, (seen.get(span.name) ?? new Set()).add(span.start));
  }
  // the items that hold one of the skills, so they are not checked again as unknown words
  const holds = (item: string, span: { text: string }) => normalizeName(item).includes(normalizeName(span.text));
  const met = new Map<AlternativeGroup, boolean>();
  const covered = (group: AlternativeGroup) => {
    let answer = met.get(group);
    if (answer === undefined) {
      answer =
        group.spans.some((span) => byName.get(span.name)?.match === "exact") ||
        group.items.some((item) => !group.spans.some((span) => holds(item, span)) && itemOnResume(item, resumeText, resumeStems));
      met.set(group, answer);
    }
    return answer;
  };

  const kept: SkillMatch[] = [];
  for (const row of rows) {
    const inLists = seen.get(row.name)?.size ?? 0;
    if (row.match === "exact" || forced.has(row.name) || inLists < row.jdCount) {
      kept.push(row);
      continue;
    }
    const mine = groups.filter((group) => group.spans.some((span) => span.name === row.name));
    const open = mine.find((group) => !covered(group));
    // every list it is in already has a match, so the job's ask is met
    if (!open) continue;
    // the other choices, as the posting wrote them
    const own = open.spans.filter((span) => span.name === row.name);
    const options = open.items.filter((item) => !own.some((span) => holds(item, span)));
    // when one of its lists is already met, what is left is the other list, which is usually the nice to have one
    const partlyMet = mine.some(covered);
    kept.push({ ...row, options, ...(partlyMet ? { importance: "preferred" as const } : {}) });
  }
  return kept;
}
