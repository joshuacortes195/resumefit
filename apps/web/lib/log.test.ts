import { describe, expect, it } from "vitest";
import { safeErrorText, withoutNulls } from "./log";

// the shape the database library throws when a query fails
class FailedQuery extends Error {
  query = "insert into resumes (raw_text) values ($1)";
  params = ["Maria Garcia, 555 010 0199"];
  constructor(cause?: Error) {
    super("Failed query: insert into resumes (raw_text) values ($1)\nparams: Maria Garcia, 555 010 0199");
    this.cause = cause;
  }
}

describe("safeErrorText", () => {
  it("keeps the values of a failed query out of the log", () => {
    const text = safeErrorText(new FailedQuery(new Error("connection timed out")), "request failed");
    expect(text).toBe("database query failed: connection timed out");
    expect(text).not.toContain("Maria");
  });

  it("says so when a failed query has no reason", () => {
    expect(safeErrorText(new FailedQuery(), "request failed")).toBe("database query failed: no reason given");
  });

  it("passes an ordinary message through, cut to a sane length", () => {
    expect(safeErrorText(new Error("boom"), "request failed")).toBe("boom");
    expect(safeErrorText(new Error("x".repeat(900)), "request failed")).toHaveLength(500);
  });

  it("falls back when there is nothing to say", () => {
    expect(safeErrorText("nope", "request failed")).toBe("request failed");
  });
});

describe("withoutNulls", () => {
  it("drops the character the database cannot store", () => {
    expect(withoutNulls("a\u0000b")).toBe("ab");
    expect(withoutNulls("plain")).toBe("plain");
  });
});
