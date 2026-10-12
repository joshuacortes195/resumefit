import { and, asc, count, eq, lt, ne, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { CurrentUser } from "@/lib/auth";
import { serverEnv } from "@/lib/env";
import { checkInviteCode, INVITE_ERRORS, normalizeInviteCode } from "@/lib/invite";

// the app's own record of a signed in person, null when they have not been let in yet
export async function findUser(id: string): Promise<CurrentUser | null> {
  const db = await getDb();
  const [row] = await db.select().from(schema.users).where(eq(schema.users.id, id)).limit(1);
  return row ? { id: row.id, email: row.email, name: row.name, isAdmin: row.isAdmin } : null;
}

// true when someone with this email has already been let in
export async function emailKnown(email: string): Promise<boolean> {
  const db = await getDb();
  const rows = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, email.toLowerCase())).limit(1);
  return rows.length > 0;
}

// the note that says the app already has, or once had, its first admin
const CLAIMED_KEY = "setup:claimed";

// true while nobody has ever signed up, the first person in becomes the admin and needs no code.
// an app that had people and was emptied again does not count, or a stranger could walk in as the admin
export async function noUsersYet(): Promise<boolean> {
  const db = await getDb();
  const [row] = await db.select({ total: count() }).from(schema.users);
  if ((row?.total ?? 0) > 0) return false;
  const [claimed] = await db.select({ key: schema.appSettings.key }).from(schema.appSettings).where(eq(schema.appSettings.key, CLAIMED_KEY)).limit(1);
  return claimed === undefined;
}

// writes down that the first admin spot is taken, for good
export async function markClaimed(): Promise<void> {
  const db = await getDb();
  await db.insert(schema.appSettings).values({ key: CLAIMED_KEY, value: true }).onConflictDoNothing({ target: schema.appSettings.key });
}

// when the only admin leaves, the person who has been here longest takes over, so there is always someone who can make invites
export async function handOverAdmin(leavingId: string): Promise<void> {
  const db = await getDb();
  const others = await db.select({ id: schema.users.id, isAdmin: schema.users.isAdmin }).from(schema.users).where(ne(schema.users.id, leavingId)).orderBy(asc(schema.users.createdAt));
  const next = others[0];
  if (!next || others.some((user) => user.isAdmin)) return;
  await db.update(schema.users).set({ isAdmin: true }).where(eq(schema.users.id, next.id));
}

// thrown inside the sign up when someone else took the last use of a code a moment before
class InviteSpent extends Error {}

// checks a code against the invite table, returns a message when it cannot be used
export async function inviteProblem(code: string | null | undefined): Promise<string | null> {
  const normalized = normalizeInviteCode(code ?? "");
  const db = await getDb();
  const [invite] = normalized ? await db.select().from(schema.inviteCodes).where(eq(schema.inviteCodes.code, normalized)).limit(1) : [];
  const result = checkInviteCode(code, invite ?? null);
  return result.ok ? null : INVITE_ERRORS[result.reason];
}

// lets a newly signed in person into the app, using up their invite code. returns a message when they cannot come in
export async function admitUser(person: { id: string; email: string; name: string | null; avatar: string | null }, inviteCode: string | null): Promise<{ user: CurrentUser } | { error: string }> {
  const existing = await findUser(person.id);
  if (existing) return { user: existing };

  const first = await noUsersYet();
  const needsInvite = serverEnv().INVITE_ONLY && !first;
  if (needsInvite) {
    const problem = await inviteProblem(inviteCode);
    if (problem) return { error: problem };
  }

  const db = await getDb();
  const code = needsInvite ? normalizeInviteCode(inviteCode ?? "") : null;
  try {
    await db.transaction(async (tx) => {
      await tx.insert(schema.users).values({ id: person.id, email: person.email.toLowerCase(), name: person.name, avatar: person.avatar, inviteCodeUsed: code, isAdmin: first });
      if (!code) return;
      // the use is only counted while there is one left. two people signing up at the same moment cannot both take the last one
      const taken = await tx
        .update(schema.inviteCodes)
        .set({ uses: sql`${schema.inviteCodes.uses} + 1` })
        .where(and(eq(schema.inviteCodes.code, code), lt(schema.inviteCodes.uses, schema.inviteCodes.maxUses)))
        .returning({ code: schema.inviteCodes.code });
      // throwing undoes the new account too
      if (taken.length === 0) throw new InviteSpent();
    });
  } catch (error) {
    if (error instanceof InviteSpent) return { error: INVITE_ERRORS.used_up };
    throw error;
  }
  if (first) await markClaimed();
  return { user: { id: person.id, email: person.email.toLowerCase(), name: person.name, isAdmin: first } };
}
