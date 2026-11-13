import { describe, expect, it } from "vitest";
import { findSavedAnswer, similarity } from "./qa-match";

const BANK = [
  { question: "Why do you want to work here?", answer: "I like the mission." },
  { question: "Are you legally authorized to work in the United States?", answer: "Yes" },
  { question: "Describe a project you are proud of", answer: "The checkout rebuild." },
];

describe("saved answers", () => {
  it("matches the same question asked a different way", () => {
    expect(findSavedAnswer("Why do you want to work at Acme?", BANK)?.answer).toBe("I like the mission.");
    expect(findSavedAnswer("Why do you want to work at Harbor Freight Co?", BANK)?.answer).toBe("I like the mission.");
    expect(findSavedAnswer("Are you authorized to work in the United States?", BANK)?.answer).toBe("Yes");
    expect(findSavedAnswer("Tell us about a project you're proud of.", BANK)?.answer).toBe("The checkout rebuild.");
  });

  it("does not stretch to a different question", () => {
    expect(findSavedAnswer("What are your salary expectations?", BANK)).toBeNull();
    expect(findSavedAnswer("Will you now or in the future require sponsorship?", BANK)).toBeNull();
    expect(findSavedAnswer("Why did you leave your last job?", BANK)).toBeNull();
    expect(findSavedAnswer("Describe your work style", BANK)).toBeNull();
  });

  it("scores identical questions as 1 and unrelated ones as 0", () => {
    expect(similarity("Why this company?", "why this company")).toBe(1);
    expect(similarity("Favorite color", "Years of experience")).toBe(0);
  });
});
