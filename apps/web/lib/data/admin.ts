import { count, desc, eq, gte, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";

// everyone who has an account, newest first, with how much they have used the app
export async function listUsers(): Promise<{ id: string; email: string; name: string | null; isAdmin: boolean; inviteCodeUsed: string | null; createdAt: Date; scans: number }[]> {
  const db = await getDb();
  return db
    .select({
      id: schema.users.id,
      email: schema.users.email,
      name: schema.users.name,
      isAdmin: schema.users.isAdmin,
      inviteCodeUsed: schema.users.inviteCodeUsed,
      createdAt: schema.users.createdAt,
      scans: sql<number>`(select count(*)::int from ${schema.scans} where ${schema.scans.userId} = ${schema.users.id})`,
    })
    .from(schema.users)
    .orderBy(desc(schema.users.createdAt))
    .limit(200);
}

export type InviteRow = typeof schema.inviteCodes.$inferSelect;

export async function listInvites(): Promise<InviteRow[]> {
  const db = await getDb();
  return db.select().from(schema.inviteCodes).orderBy(desc(schema.inviteCodes.createdAt)).limit(200);
}

// makes a code that is easy to read out loud, without letters and digits that look alike
export function newInviteCode(): string {
  const letters = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return [...bytes].map((byte) => letters[byte % letters.length]).join("");
}

export async function createInvite(createdBy: string, maxUses: number, expiresInDays: number | null): Promise<string> {
  const db = await getDb();
  const code = newInviteCode();
  await db.insert(schema.inviteCodes).values({ code, createdBy, maxUses, expiresAt: expiresInDays ? new Date(Date.now() + expiresInDays * 86_400_000) : null });
  return code;
}

export async function revokeInvite(code: string): Promise<void> {
  const db = await getDb();
  await db.delete(schema.inviteCodes).where(eq(schema.inviteCodes.code, code));
}

// writing requests over the last two weeks, grouped by day, provider and feature
export async function usageByDay(): Promise<{ day: string; provider: string; feature: string; calls: number; tokens: number }[]> {
  const db = await getDb();
  const day = sql<string>`to_char(${schema.aiUsage.createdAt}, 'YYYY-MM-DD')`;
  return db
    .select({ day, provider: schema.aiUsage.provider, feature: schema.aiUsage.feature, calls: count(), tokens: sql<number>`coalesce(sum(${schema.aiUsage.tokensIn} + ${schema.aiUsage.tokensOut}), 0)::int` })
    .from(schema.aiUsage)
    .where(gte(schema.aiUsage.createdAt, new Date(Date.now() - 14 * 86_400_000)))
    .groupBy(day, schema.aiUsage.provider, schema.aiUsage.feature)
    .orderBy(desc(day));
}
