import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { getDb, schema } from "@/db";
import { clearRateLimits, RATE_LIMITS, withinLimit } from "./rate-limit";

// a person to count against
async function someone(): Promise<string> {
  const db = await getDb();
  const id = randomUUID();
  await db.insert(schema.users).values({ id, email: `rate-${id}@example.com` });
  return id;
}

describe("per person rate limits", () => {
  it("lets the limit through, turns the next one away, and starts again a minute later", async () => {
    const user = await someone();
    const start = 1_800_000_000_000;
    for (let used = 0; used < 3; used++) expect(await withinLimit(user, "scan", 3, start + used)).toBe(true);
    expect(await withinLimit(user, "scan", 3, start + 10)).toBe(false);
    expect(await withinLimit(user, "scan", 3, start + 59_000)).toBe(false);
    // a minute after the first one the window is new
    expect(await withinLimit(user, "scan", 3, start + 60_001)).toBe(true);
  });

  it("counts each person and each kind of request on its own", async () => {
    const [busy, quiet] = [await someone(), await someone()];
    const now = 1_800_000_500_000;
    for (let used = 0; used <= RATE_LIMITS.upload; used++) await withinLimit(busy, "upload", RATE_LIMITS.upload, now);
    expect(await withinLimit(busy, "upload", RATE_LIMITS.upload, now)).toBe(false);
    // someone hammering uploads does not slow anyone else down, or their own scans
    expect(await withinLimit(quiet, "upload", RATE_LIMITS.upload, now)).toBe(true);
    expect(await withinLimit(busy, "scan", RATE_LIMITS.scan, now)).toBe(true);
  });

  it("holds when many requests land at the same moment", async () => {
    const user = await someone();
    const now = 1_800_001_000_000;
    const results = await Promise.all(Array.from({ length: 12 }, () => withinLimit(user, "ai", 5, now)));
    expect(results.filter(Boolean)).toHaveLength(5);
  });

  it("forgets the counters with the account", async () => {
    const user = await someone();
    await withinLimit(user, "scan");
    await clearRateLimits(user);
    const db = await getDb();
    expect((await db.select().from(schema.appSettings)).filter((row) => row.key.includes(user))).toHaveLength(0);
  });
});
