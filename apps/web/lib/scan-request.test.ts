import { describe, expect, it } from "vitest";
import { pastedName } from "./scan-request";

describe("naming a pasted resume", () => {
  const day = new Date(2026, 9, 31);

  it("names it after the job it was pasted for", () => {
    expect(pastedName("Software Engineer Intern", "Roblox", day)).toBe("Pasted for Software Engineer Intern, Roblox");
    expect(pastedName("Software Engineer Intern", undefined, day)).toBe("Pasted for Software Engineer Intern");
  });

  it("falls back to the date when the job is not known", () => {
    expect(pastedName(undefined, undefined, day)).toBe("Pasted resume, Oct 31");
  });

  it("keeps a very long job title within the name limit", () => {
    expect(pastedName("x".repeat(500), "y", day).length).toBeLessThanOrEqual(200);
  });
});
