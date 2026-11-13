import { describe, expect, it } from "vitest";
import { runLabel } from "./application-status";

const NOW = new Date("2026-11-12T12:00:00Z");
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 86_400_000);

describe("what an auto apply run is called", () => {
  it("goes by how the form was left", () => {
    expect(runLabel({ status: "needs_review", fieldsNeedingAttention: 2, updatedAt: daysAgo(0) }, NOW).text).toBe("Needs review");
    expect(runLabel({ status: "needs_review", fieldsNeedingAttention: 0, updatedAt: daysAgo(1) }, NOW).text).toBe("Filled in");
    expect(runLabel({ status: "autofilling", fieldsNeedingAttention: 0, updatedAt: daysAgo(0) }, NOW).text).toBe("Filling in");
    expect(runLabel({ status: "failed", fieldsNeedingAttention: 0, updatedAt: daysAgo(0) }, NOW).text).toBe("Could not fill");
  });

  it("calls a filled form that sat for a week abandoned, and one that was sent never", () => {
    expect(runLabel({ status: "needs_review", fieldsNeedingAttention: 2, updatedAt: daysAgo(7) }, NOW).text).toBe("Abandoned");
    expect(runLabel({ status: "needs_review", fieldsNeedingAttention: 2, updatedAt: daysAgo(6.9) }, NOW).text).toBe("Needs review");
    expect(runLabel({ status: "applied", fieldsNeedingAttention: 0, updatedAt: daysAgo(90) }, NOW).text).toBe("Submitted by me");
  });
});
