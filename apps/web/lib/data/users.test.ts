import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { getDb, schema } from "@/db";
import { getCurrentUser } from "@/lib/auth";
import { deleteAccount } from "./account";
import { admitUser, emailKnown, inviteProblem, noUsersYet } from "./users";

// someone coming back from their email link or from google
const person = (email: string) => ({ id: randomUUID(), email, name: "Test Person", avatar: null });

describe("letting people in", () => {
  it("asks new people for a working invite code and uses it up", async () => {
    // make sure somebody is already here, so the first person rule does not apply
    await getCurrentUser();
    const db = await getDb();
    await db.insert(schema.inviteCodes).values({ code: "FRIEND1", maxUses: 1 });

    // no code, a made up code
    expect(await admitUser(person("nocode@example.com"), null)).toEqual({ error: "Enter your invite code to sign up." });
    expect(await admitUser(person("wrong@example.com"), "NOPE")).toEqual({ error: "That invite code doesn't exist. Check for typos." });
    expect(await emailKnown("nocode@example.com")).toBe(false);

    // the right code, typed in lower case with a space
    const friend = person("Friend@Example.com");
    const admitted = await admitUser(friend, " friend1 ");
    expect(admitted).toMatchObject({ user: { email: "friend@example.com", isAdmin: false } });
    expect(await emailKnown("friend@example.com")).toBe(true);
    const [invite] = await db.select().from(schema.inviteCodes).where(eq(schema.inviteCodes.code, "FRIEND1"));
    expect(invite?.uses).toBe(1);

    // the code is spent now
    expect(await admitUser(person("late@example.com"), "FRIEND1")).toEqual({ error: "That invite code has already been used." });
    // but the friend can sign in again without it
    expect(await admitUser(friend, null)).toMatchObject({ user: { email: "friend@example.com" } });
  });

  it("turns away an expired code", async () => {
    const db = await getDb();
    await db.insert(schema.inviteCodes).values({ code: "OLDCODE", maxUses: 5, expiresAt: new Date(Date.now() - 1000) });
    expect(await inviteProblem("OLDCODE")).toBe("That invite code has expired. Ask for a new one.");
  });

  it("lets only one of two people who sign up at the same moment take the last use of a code", async () => {
    await getCurrentUser();
    const db = await getDb();
    await db.insert(schema.inviteCodes).values({ code: "LASTONE", maxUses: 1 });
    const results = await Promise.all([admitUser(person("first@example.com"), "LASTONE"), admitUser(person("second@example.com"), "LASTONE")]);

    expect(results.filter((result) => "user" in result)).toHaveLength(1);
    expect(results.filter((result) => "error" in result)).toEqual([{ error: "That invite code has already been used." }]);
    const [invite] = await db.select().from(schema.inviteCodes).where(eq(schema.inviteCodes.code, "LASTONE"));
    expect(invite?.uses).toBe(1);
    // the one who lost has no account left behind
    expect([await emailKnown("first@example.com"), await emailKnown("second@example.com")].filter(Boolean)).toHaveLength(1);
  });
});

describe("the admin spot", () => {
  it("goes to whoever has been here longest when the only admin leaves, and is not handed to a stranger once the app is empty", async () => {
    const db = await getDb();
    // start from nobody at all
    for (const user of await db.select({ id: schema.users.id }).from(schema.users)) await deleteAccount(user.id);
    await db.delete(schema.appSettings).where(eq(schema.appSettings.key, "setup:claimed"));
    expect(await noUsersYet()).toBe(true);

    // the first person in needs no code and is the admin
    const owner = person("owner@example.com");
    expect(await admitUser(owner, null)).toMatchObject({ user: { isAdmin: true } });
    await db.insert(schema.inviteCodes).values({ code: "TWOUSES", maxUses: 2 });
    const older = person("older@example.com");
    const newer = person("newer@example.com");
    await admitUser(older, "TWOUSES");
    await db.update(schema.users).set({ createdAt: new Date(Date.now() - 60_000) }).where(eq(schema.users.id, older.id));
    await admitUser(newer, "TWOUSES");

    // the owner leaves, the older of the two friends takes over
    await deleteAccount(owner.id);
    const left = await db.select({ email: schema.users.email, isAdmin: schema.users.isAdmin }).from(schema.users);
    expect(left.filter((user) => user.isAdmin).map((user) => user.email)).toEqual(["older@example.com"]);

    // everyone leaves. the next person to turn up is a stranger, not the new admin
    await deleteAccount(older.id);
    await deleteAccount(newer.id);
    expect(await noUsersYet()).toBe(false);
    expect(await admitUser(person("stranger@example.com"), null)).toEqual({ error: "Enter your invite code to sign up." });
  });
});
