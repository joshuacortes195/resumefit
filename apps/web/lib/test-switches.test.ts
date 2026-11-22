import { afterEach, describe, expect, it, vi } from "vitest";
import { testSwitch } from "@/lib/env";

describe("the switches only the browser tests use", () => {
  afterEach(() => vi.unstubAllEnvs());

  // on your own machine and in ci the tests can turn them on
  it("are read when the app is not on the live host", () => {
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("AI_MOCK", "1");
    vi.stubEnv("JOB_FEED_OFFLINE", "1");
    vi.stubEnv("LOCAL_DATA_DIR", "memory");
    expect(testSwitch("AI_MOCK")).toBe("1");
    expect(testSwitch("JOB_FEED_OFFLINE")).toBe("1");
    expect(testSwitch("LOCAL_DATA_DIR")).toBe("memory");
  });

  // a stray setting on vercel can never fake the ai, stop the job feed or move the data
  it("always read as unset on the live host", () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("AI_MOCK", "1");
    vi.stubEnv("JOB_FEED_OFFLINE", "1");
    vi.stubEnv("LOCAL_DATA_DIR", "memory");
    expect(testSwitch("AI_MOCK")).toBeUndefined();
    expect(testSwitch("JOB_FEED_OFFLINE")).toBeUndefined();
    expect(testSwitch("LOCAL_DATA_DIR")).toBeUndefined();
  });

  // an empty line in the env file counts as not set
  it("treat an empty value as unset", () => {
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("AI_MOCK", "");
    expect(testSwitch("AI_MOCK")).toBeUndefined();
  });
});
