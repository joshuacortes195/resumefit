import { describe, expect, it } from "vitest";
import { findDateRange, findYear, yearsOfExperience, type DateRange } from "./dates";

// a fixed "today" so Present always means the same month
const TODAY = new Date(2026, 5, 15);

// shorthand for reading a range that has to be there
function range(line: string): DateRange {
  const found = findDateRange(line, TODAY);
  if (!found) throw new Error(`no range in "${line}"`);
  return found;
}

describe("findDateRange", () => {
  it("reads month names, short or long", () => {
    expect(range("Jan 2023 - Mar 2024")).toMatchObject({ start: { year: 2023, month: 1, style: "month-name" }, end: { year: 2024, month: 3 } });
    expect(range("September 2021 to December 2022").end).toMatchObject({ year: 2022, month: 12 });
    expect(range("Sept. 2020 – Feb. 2021").start.month).toBe(9);
  });

  it("reads numeric and year only dates", () => {
    expect(range("01/2024 - 06/2024")).toMatchObject({ start: { month: 1, style: "numeric" }, end: { month: 6 } });
    expect(range("2019 - 2021")).toMatchObject({ start: { year: 2019, month: null, style: "year" }, end: { year: 2021 } });
  });

  it("treats Present as today", () => {
    expect(range("Software Engineer, Acme | Jun 2024 — Present").end).toMatchObject({ year: 2026, month: 6, present: true });
    expect(range("03/2022 - Current").end.present).toBe(true);
  });

  it("keeps the text of the range so it can be cut out of the line", () => {
    expect(range("Acme Corp, Jan 2023 - Present, Austin").text).toBe("Jan 2023 - Present");
  });

  it("ignores lines without a real range", () => {
    expect(findDateRange("Grew revenue to 2024 targets", TODAY)).toBeNull();
    expect(findDateRange("Presented at 3 conferences", TODAY)).toBeNull();
    expect(findDateRange("Graduated May 2021", TODAY)).toBeNull();
  });
});

describe("findYear", () => {
  it("takes the last year on the line", () => {
    expect(findYear("B.S. Computer Science, State University, 2017 - 2021")).toBe(2021);
    expect(findYear("No dates here")).toBeNull();
  });
});

describe("yearsOfExperience", () => {
  it("adds up jobs back to back", () => {
    expect(yearsOfExperience([range("Jan 2020 - Dec 2021"), range("Jan 2022 - Dec 2023")])).toBe(4);
  });

  it("counts overlapping jobs once", () => {
    expect(yearsOfExperience([range("Jan 2020 - Dec 2021"), range("Jul 2021 - Jun 2022")])).toBe(2.5);
  });

  it("handles year only ranges", () => {
    expect(yearsOfExperience([range("2019 - 2021")])).toBe(2);
    // the same year on both sides still counts for something
    expect(yearsOfExperience([range("2022 - 2022")])).toBe(0.5);
  });
});
