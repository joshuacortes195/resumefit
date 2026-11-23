import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb, schema } from "@/db";
import { countJunkSignIns, deleteJunkSignIns, JUNK_PER_RUN, type AuthAdmin } from "@/lib/data/junk-users";

const DAY = 86_400_000;
const now = Date.now();
const ago = (days: number) => new Date(now - days * DAY).toISOString();

// a pretend sign in service admin api that pages like the real one and remembers what was deleted
function fakeAdmin(records: { id: string; email?: string; created_at: string }[], onPage?: (page: number) => Promise<void>) {
  const deleted: string[] = [];
  const admin: AuthAdmin = {
    listUsers: vi.fn(async ({ page, perPage }) => {
      await onPage?.(page);
      const users = records.slice((page - 1) * perPage, page * perPage);
      return { data: { users, nextPage: page * perPage < records.length ? page + 1 : null }, error: null };
    }),
    deleteUser: vi.fn(async (id: string) => {
      deleted.push(id);
      return { error: null };
    }),
  };
  return { admin, deleted };
}

// puts a person in the app's own users table
async function member(email: string, isAdmin = false) {
  const db = await getDb();
  const [row] = await db.insert(schema.users).values({ email, isAdmin }).returning();
  if (!row) throw new Error("no row");
  return row;
}

beforeEach(async () => {
  await (await getDb()).delete(schema.users);
  vi.stubEnv("ADMIN_EMAIL", "owner@example.com");
});
afterEach(() => vi.unstubAllEnvs());

describe("cleaning up sign in records that never got into the app", () => {
  it("never deletes anyone in the app, the admin, the owner email, or anything under a week old", async () => {
    const admin = await member("admin@example.com", true);
    const real = await member("Real@Example.com");
    const junk = randomUUID();
    const records = [
      // the admin, a member, and a member's email under a different sign in record, all old
      { id: admin.id, email: admin.email, created_at: ago(400) },
      { id: real.id, email: real.email, created_at: ago(200) },
      { id: randomUUID(), email: "real@example.com", created_at: ago(30) },
      // the owner email before they ever got in
      { id: randomUUID(), email: "OWNER@example.com", created_at: ago(60) },
      // someone who asked for a link three days ago and may still be coming
      { id: randomUUID(), email: "soon@example.com", created_at: ago(3) },
      // a record with no date at all
      { id: randomUUID(), email: "nodate@example.com", created_at: "" },
      // the only real junk
      { id: junk, email: "stranger@example.com", created_at: ago(10) },
    ];
    const { admin: api, deleted } = fakeAdmin(records);
    expect(await countJunkSignIns(api, { id: admin.id, email: admin.email }, now)).toBe(1);
    expect(await deleteJunkSignIns(api, { id: admin.id, email: admin.email }, now)).toEqual({ deleted: 1, failed: 0 });
    expect(deleted).toEqual([junk]);
  });

  it("never deletes the admin pressing the button even when they have no row in the app", async () => {
    const adminId = randomUUID();
    const { admin: api, deleted } = fakeAdmin([{ id: adminId, email: "admin@example.com", created_at: ago(90) }]);
    await deleteJunkSignIns(api, { id: adminId, email: "admin@example.com" }, now);
    expect(deleted).toEqual([]);
  });

  it("reads every page, and deletes only after the whole list is read", async () => {
    const keepers = await Promise.all(Array.from({ length: 5 }, (_, n) => member(`member${n}@example.com`)));
    // 2,400 old records over three pages: the members first, then strangers, so the junk sits on every page
    const strangers = Array.from({ length: 2395 }, (_, n) => ({ id: randomUUID(), email: `s${n}@example.com`, created_at: ago(20) }));
    const records = [...keepers.map((row) => ({ id: row.id, email: row.email, created_at: ago(100) })), ...strangers];
    const { admin: api } = fakeAdmin(records);
    expect(await countJunkSignIns(api, { id: randomUUID(), email: "admin@example.com" }, now)).toBe(2395);
    const pages = vi.mocked(api.listUsers).mock.calls.map(([params]) => params.page);
    expect(pages).toEqual([1, 2, 3]);
  });

  it("stops at one run's worth each time and keeps every member across runs", async () => {
    const keep = await member("kept@example.com");
    const strangers = Array.from({ length: 1200 }, () => ({ id: randomUUID(), created_at: ago(15) }));
    const records = [...strangers.slice(0, 700), { id: keep.id, email: keep.email, created_at: ago(15) }, ...strangers.slice(700)];
    const { admin: api, deleted } = fakeAdmin(records);
    const caller = { id: randomUUID(), email: "admin@example.com" };
    expect(await deleteJunkSignIns(api, caller, now)).toEqual({ deleted: JUNK_PER_RUN, failed: 0 });
    expect(deleted).toHaveLength(500);
    expect(deleted).not.toContain(keep.id);
  });

  it("skips someone who got into the app while the list was being read", async () => {
    const late = randomUUID();
    const { admin: api, deleted } = fakeAdmin([{ id: late, email: "late@example.com", created_at: ago(8) }], async () => {
      // they finish signing in with their invite code right as the page of records comes back
      await (await getDb()).insert(schema.users).values({ id: late, email: "late@example.com" }).onConflictDoNothing();
    });
    expect(await deleteJunkSignIns(api, { id: randomUUID(), email: "admin@example.com" }, now)).toEqual({ deleted: 0, failed: 0 });
    expect(deleted).toEqual([]);
  });

  it("deletes nothing when a page of records cannot be read", async () => {
    const { admin: api, deleted } = fakeAdmin([{ id: randomUUID(), created_at: ago(30) }]);
    vi.mocked(api.listUsers).mockResolvedValueOnce({ data: { users: [] }, error: new Error("down") });
    await expect(deleteJunkSignIns(api, { id: randomUUID(), email: "admin@example.com" }, now)).rejects.toThrow();
    expect(deleted).toEqual([]);
  });
});

describe("the clean up button for someone who is not the admin", () => {
  it("is refused on the server before the sign in service is asked anything", async () => {
    const { admin: api } = fakeAdmin([{ id: randomUUID(), created_at: ago(30) }]);
    vi.resetModules();
    vi.doMock("@/lib/auth", () => ({ getCurrentUser: async () => ({ id: randomUUID(), email: "member@example.com", name: null, isAdmin: false }) }));
    vi.doMock("@/lib/supabase/admin", () => ({ authAdmin: () => api }));
    vi.doMock("next/cache", () => ({ revalidatePath: () => undefined }));
    const { deleteJunkSignInsAction } = await import("@/app/actions/admin-cleanup");
    await expect(deleteJunkSignInsAction()).rejects.toThrow("Not allowed.");
    expect(api.listUsers).not.toHaveBeenCalled();
    expect(api.deleteUser).not.toHaveBeenCalled();
  });
});
