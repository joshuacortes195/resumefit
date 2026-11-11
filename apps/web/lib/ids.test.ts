import { describe, expect, it } from "vitest";
import { isUuid } from "./ids";

describe("isUuid", () => {
  it("takes a real id in either case", () => {
    expect(isUuid("16261af3-a681-4917-a213-c1bcf8599a9c")).toBe(true);
    expect(isUuid("16261AF3-A681-4917-A213-C1BCF8599A9C")).toBe(true);
  });

  it("turns away text that is only the right length", () => {
    expect(isUuid("-".repeat(36))).toBe(false);
    expect(isUuid("16261af3a681-4917-a213-c1bcf8599a9c-")).toBe(false);
    expect(isUuid("zzzzzzzz-zzzz-zzzz-zzzz-zzzzzzzzzzzz")).toBe(false);
  });

  it("turns away anything that is not an id at all", () => {
    expect(isUuid("1' OR '1'='1")).toBe(false);
    expect(isUuid("")).toBe(false);
    expect(isUuid(null)).toBe(false);
    expect(isUuid(undefined)).toBe(false);
  });
});
