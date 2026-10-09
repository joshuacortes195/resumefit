// how a date was written, used to check the resume sticks to one style
export type DateStyle = "month-name" | "numeric" | "year";

// one date from a resume, like "Jan 2024", "01/2024", "2024" or "Present"
export type ResumeDate = {
  year: number;
  // 1 to 12, null when only the year was written
  month: number | null;
  present: boolean;
  style: DateStyle | "present";
};

// a start and end date found on one line
export type DateRange = {
  start: ResumeDate;
  end: ResumeDate;
  // the range exactly as it was written
  text: string;
};

// month names and their short forms
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const MONTH_NAME = "(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";
const YEAR = "(?:19[5-9]\\d|20[0-4]\\d)";

// finds every date on a line, in the order they were written
const DATE_TOKEN = new RegExp(
  [
    // Jan 2024, January 2024, Sept. 2024
    `(?<![a-z])(?<name>${MONTH_NAME})\\.?,?\\s+(?<nameYear>${YEAR})`,
    // 01/2024 or 1/2024
    `(?<num>0?[1-9]|1[0-2])\\/(?<numYear>${YEAR})`,
    // 2024 on its own
    `(?<![\\d/$.,])(?<year>${YEAR})(?![\\d/%])`,
    // still working there
    `\\b(?<present>present|current|now|ongoing|today)\\b`,
  ].join("|"),
  "gi",
);

// what can sit between a start date and an end date
const RANGE_GAP = /^\s*(?:-|–|—|to|until|through|thru)\s*$/i;

type Token = { date: ResumeDate; index: number; end: number };

// reads the dates out of one line of text
function dateTokens(line: string, today: Date): Token[] {
  const tokens: Token[] = [];
  for (const hit of line.matchAll(DATE_TOKEN)) {
    const groups = hit.groups ?? {};
    let date: ResumeDate;
    if (groups.name && groups.nameYear) {
      date = { year: Number(groups.nameYear), month: MONTHS.indexOf(groups.name.slice(0, 3).toLowerCase()) + 1, present: false, style: "month-name" };
    } else if (groups.num && groups.numYear) {
      date = { year: Number(groups.numYear), month: Number(groups.num), present: false, style: "numeric" };
    } else if (groups.year) {
      date = { year: Number(groups.year), month: null, present: false, style: "year" };
    } else {
      // present counts as this month
      date = { year: today.getFullYear(), month: today.getMonth() + 1, present: true, style: "present" };
    }
    tokens.push({ date, index: hit.index, end: hit.index + hit[0].length });
  }
  return tokens;
}

// finds a "start - end" pair on a line, like "Jan 2023 - Present"
export function findDateRange(line: string, today: Date = new Date()): DateRange | null {
  const tokens = dateTokens(line, today);
  for (let i = 0; i < tokens.length - 1; i++) {
    const start = tokens[i];
    const end = tokens[i + 1];
    if (!start || !end || start.date.present) continue;
    // the two dates only count as a range when a dash or "to" joins them
    if (RANGE_GAP.test(line.slice(start.end, end.index))) {
      return { start: start.date, end: end.date, text: line.slice(start.index, end.end) };
    }
  }
  return null;
}

// the last plain year on a line, used for graduation dates
export function findYear(line: string): number | null {
  const years = dateTokens(line, new Date()).filter((token) => !token.date.present);
  return years.at(-1)?.date.year ?? null;
}

// turns a range into month numbers so ranges can be compared and merged
function monthSpan(range: DateRange): [number, number] {
  const start = range.start.year * 12 + (range.start.month ?? 1) - 1;
  // a year only end date like "2021 - 2023" counts whole years
  const end = range.end.month === null ? range.end.year * 12 : range.end.year * 12 + range.end.month;
  // every job counts for at least six months when only years were given
  const least = range.start.month === null ? 6 : 1;
  return [start, Math.max(end, start + least)];
}

// total years worked, overlapping jobs are only counted once
export function yearsOfExperience(ranges: DateRange[]): number {
  const spans = ranges.map(monthSpan).sort((a, b) => a[0] - b[0]);
  let months = 0;
  let coveredTo = -Infinity;
  for (const [start, end] of spans) {
    // only add the part that is not already covered by an earlier job
    const from = Math.max(start, coveredTo);
    if (end > from) months += end - from;
    coveredTo = Math.max(coveredTo, end);
  }
  return Math.round((months / 12) * 10) / 10;
}
