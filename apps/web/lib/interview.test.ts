import { describe, expect, it } from "vitest";
import { fallbackQuestions, measureAnswer } from "./interview";

describe("measureAnswer", () => {
  it("counts words, pace and filler words", () => {
    const metrics = measureAnswer("Um, so I basically led the migration. You know, it was, um, a big project and I mean it went well.", 20);
    expect(metrics.words).toBe(21);
    expect(metrics.wordsPerMinute).toBe(63);
    expect(metrics.fillerCount).toBe(5);
    expect(metrics.fillers[0]).toEqual({ word: "um", count: 2 });
  });

  it("does not count real uses of like and right as filler", () => {
    expect(measureAnswer("I like working on the right problems.", 10).fillerCount).toBe(0);
    expect(measureAnswer("It was like, really hard, like, every day, like that.", 10).fillerCount).toBe(3);
  });

  it("leaves pace out when the answer was typed", () => {
    expect(measureAnswer("A typed answer.", null).wordsPerMinute).toBeNull();
  });
});

describe("fallbackQuestions", () => {
  const jd = "Data Analyst\nRequirements\nStrong SQL and Tableau skills. SQL every day. Clear communication.";
  const resume = "Work Experience\nData Analyst, Northwind Health\nJan 2022 - Present\n• Built 14 Tableau dashboards used by 200 staff\n";

  it("builds eight questions from the job and the resume, with a mix of kinds", () => {
    const questions = fallbackQuestions(jd, resume, "Data Analyst");
    expect(questions).toHaveLength(8);
    expect(questions.filter((question) => question.type === "behavioral")).toHaveLength(3);
    expect(questions.filter((question) => question.type === "technical")).toHaveLength(3);
    expect(questions.filter((question) => question.type === "resume")).toHaveLength(2);
    // the most mentioned skill is asked about first, and the resume question quotes the resume
    expect(questions.find((question) => question.type === "technical")?.question).toContain("SQL");
    expect(questions.find((question) => question.type === "resume")?.question).toContain("Built 14 Tableau dashboards");
    expect(questions[0]?.question).toContain("communication");
  });

  it("still gives a full set when it knows almost nothing", () => {
    const questions = fallbackQuestions("We are hiring.", "", null);
    expect(questions).toHaveLength(8);
    expect(new Set(questions.map((question) => question.question)).size).toBe(8);
  });
});
