import { describe, expect, it } from "vitest";
import { checkInviteCode, normalizeInviteCode, type InviteCode } from "./invite";

// a code that should work
const valid: InviteCode = { code: "FRIENDS-2026", maxUses: 5, uses: 1, expiresAt: null };
const now = new Date("2026-10-08T12:00:00Z");

describe("normalizeInviteCode", () => {
  it("ignores case and spaces", () => {
    expect(normalizeInviteCode("  friends-2026 ")).toBe("FRIENDS-2026");
  });
});

describe("checkInviteCode", () => {
  it("accepts a good code", () => {
    expect(checkInviteCode("friends-2026", valid, now)).toEqual({ ok: true });
  });

  it("rejects an empty code", () => {
    expect(checkInviteCode("   ", valid, now)).toEqual({ ok: false, reason: "missing" });
  });

  it("rejects a code that is not in the table", () => {
    expect(checkInviteCode("nope", null, now)).toEqual({ ok: false, reason: "not_found" });
  });

  it("rejects an expired code", () => {
    const expired = { ...valid, expiresAt: new Date("2026-10-01T00:00:00Z") };
    expect(checkInviteCode("FRIENDS-2026", expired, now)).toEqual({ ok: false, reason: "expired" });
  });

  it("rejects a code with no uses left", () => {
    expect(checkInviteCode("FRIENDS-2026", { ...valid, uses: 5 }, now)).toEqual({ ok: false, reason: "used_up" });
  });
});

describe("database address", async () => {
  const { cleanDatabaseUrl } = await import("@/db");

  it("drops settings the database does not know and keeps the rest", () => {
    expect(cleanDatabaseUrl("postgres://user:p%40ss@db.example.com:6543/postgres?sslmode=require&supa=base-pooler.x&pgbouncer=true")).toBe("postgres://user:p%40ss@db.example.com:6543/postgres?sslmode=require");
    expect(cleanDatabaseUrl("postgresql://user:pass@db.example.com:6543/postgres")).toBe("postgresql://user:pass@db.example.com:6543/postgres");
  });
});
