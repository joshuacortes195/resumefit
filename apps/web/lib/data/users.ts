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

// thrown inside the sign up when someone else became the first admin a moment before
class FirstSpotTaken extends Error {}

// checks a code against the invite table, returns a message when it cannot be used
export async function inviteProblem(code: string | null | undefined): Promise<string | null> {
  const normalized = normalizeInviteCode(code ?? "");
  const db = await getDb();
  const [invite] = normalized ? await db.select().from(schema.inviteCodes).where(eq(schema.inviteCodes.code, normalized)).limit(1) : [];
  const result = checkInviteCode(code, invite ?? null);
  return result.ok ? null : INVITE_ERRORS[result.reason];
}

// true for the owner's email from the environment
export function isOwnerEmail(email: string): boolean {
  const owner = serverEnv().ADMIN_EMAIL;
  return owner !== undefined && owner.toLowerCase() === email.trim().toLowerCase();
}

// lets a newly signed in person into the app, using up their invite code. returns a message when they cannot come in.
// confirmed says whether the sign in provider has seen proof that the person owns the email
export async function admitUser(person: { id: string; email: string; name: string | null; avatar: string | null; confirmed: boolean }, inviteCode: string | null): Promise<{ user: CurrentUser } | { error: string }> {
  // the owner's email only counts once the provider has confirmed it, so typing it in somewhere is not enough
  const owner = person.confirmed && isOwnerEmail(person.email);
  const existing = await findUser(person.id);
  if (existing) {
    // the owner gets the admin spot back if it was handed on while they were away.
    // the email they joined with has to be the owner's too, so a member cannot get there by changing their email later
    const back = owner && isOwnerEmail(existing.email);
    if (back && !existing.isAdmin) await (await getDb()).update(schema.users).set({ isAdmin: true }).where(eq(schema.users.id, existing.id));
    return { user: { ...existing, isAdmin: existing.isAdmin || back } };
  }

  // the owner comes in as an admin with no code. so does the very first person ever, but only when no owner email is set:
  // with one set, a stranger who finds the address before the owner does is just a stranger
  const claiming = !owner && serverEnv().ADMIN_EMAIL === undefined && (await noUsersYet());
  const first = owner || claiming;
  const needsInvite = serverEnv().INVITE_ONLY && !first;
  if (needsInvite) {
    const problem = await inviteProblem(inviteCode);
    if (problem) return { error: problem };
  }

  const db = await getDb();
  const code = needsInvite ? normalizeInviteCode(inviteCode ?? "") : null;
  try {
    await db.transaction(async (tx) => {
      if (claiming) {
        // the first admin spot is taken by writing the note. two people arriving together cannot both write it
        const taken = await tx.insert(schema.appSettings).values({ key: CLAIMED_KEY, value: true }).onConflictDoNothing({ target: schema.appSettings.key }).returning({ key: schema.appSettings.key });
        if (taken.length === 0) throw new FirstSpotTaken();
      }
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
    // the other person is the admin now, so this one needs a code like everyone after them
    if (error instanceof FirstSpotTaken) return { error: serverEnv().INVITE_ONLY ? INVITE_ERRORS.missing : "Something went wrong signing you in. Try again." };
    throw error;
  }
  if (first) await markClaimed();
  return { user: { id: person.id, email: person.email.toLowerCase(), name: person.name, isAdmin: first } };
}
