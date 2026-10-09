import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { getDb, schema } from "@/db";
import { getCurrentUser } from "@/lib/auth";
import { admitUser, emailKnown, inviteProblem } from "./users";

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
});
