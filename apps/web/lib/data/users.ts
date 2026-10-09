import { count, eq, sql } from "drizzle-orm";
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

// true while nobody has signed up yet, the first person in becomes the admin and needs no code
export async function noUsersYet(): Promise<boolean> {
  const db = await getDb();
  const [row] = await db.select({ total: count() }).from(schema.users);
  return (row?.total ?? 0) === 0;
}

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
  await db.transaction(async (tx) => {
    await tx.insert(schema.users).values({ id: person.id, email: person.email.toLowerCase(), name: person.name, avatar: person.avatar, inviteCodeUsed: code, isAdmin: first });
    if (code) await tx.update(schema.inviteCodes).set({ uses: sql`${schema.inviteCodes.uses} + 1` }).where(eq(schema.inviteCodes.code, code));
  });
  return { user: { id: person.id, email: person.email.toLowerCase(), name: person.name, isAdmin: first } };
}
