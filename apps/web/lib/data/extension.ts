import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { CurrentUser } from "@/lib/auth";

// how long a connection lasts before the extension has to be connected again
const TOKEN_DAYS = 90;

// only the hash is stored, so a leaked database cannot be used to act as someone
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// makes a new connection key for the extension. the key itself is only ever shown once
export async function createExtensionToken(userId: string): Promise<string> {
  const token = `rf_${randomBytes(32).toString("base64url")}`;
  const db = await getDb();
  // one connection at a time, connecting again replaces the old one
  await db.delete(schema.extensionTokens).where(eq(schema.extensionTokens.userId, userId));
  await db.insert(schema.extensionTokens).values({ userId, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + TOKEN_DAYS * 86_400_000) });
  return token;
}

// who a connection key belongs to, null when it is unknown or expired
export async function userForToken(token: string): Promise<CurrentUser | null> {
  if (!token.startsWith("rf_") || token.length > 100) return null;
  const db = await getDb();
  const [row] = await db
    .select({ tokenId: schema.extensionTokens.id, id: schema.users.id, email: schema.users.email, name: schema.users.name, isAdmin: schema.users.isAdmin })
    .from(schema.extensionTokens)
    .innerJoin(schema.users, eq(schema.extensionTokens.userId, schema.users.id))
    .where(and(eq(schema.extensionTokens.tokenHash, hashToken(token)), gt(schema.extensionTokens.expiresAt, new Date())))
    .limit(1);
  if (!row) return null;
  await db.update(schema.extensionTokens).set({ lastUsedAt: new Date() }).where(eq(schema.extensionTokens.id, row.tokenId));
  return { id: row.id, email: row.email, name: row.name, isAdmin: row.isAdmin };
}

// where we keep the id of the extension a person connected, so the web app can talk to it without them typing the id in
const idKey = (userId: string) => `extension-id:${userId}`;

// notes which extension just called in. chrome puts the extension's id in the address the call comes from
export async function rememberExtension(userId: string, origin: string): Promise<void> {
  const id = /^chrome-extension:\/\/([a-p]{32})$/.exec(origin)?.[1];
  if (!id) return;
  const db = await getDb();
  await db.insert(schema.appSettings).values({ key: idKey(userId), value: id }).onConflictDoUpdate({ target: schema.appSettings.key, set: { value: id } });
}

// the id of the extension that last called in for this person, empty when none has
export async function extensionId(userId: string): Promise<string> {
  const db = await getDb();
  const [row] = await db.select({ value: schema.appSettings.value }).from(schema.appSettings).where(eq(schema.appSettings.key, idKey(userId))).limit(1);
  return typeof row?.value === "string" ? row.value : "";
}

// when the extension last checked in, null when it is not connected
export async function extensionStatus(userId: string): Promise<{ connected: boolean; lastUsedAt: Date | null }> {
  const db = await getDb();
  const [row] = await db
    .select({ lastUsedAt: schema.extensionTokens.lastUsedAt })
    .from(schema.extensionTokens)
    .where(and(eq(schema.extensionTokens.userId, userId), gt(schema.extensionTokens.expiresAt, new Date())))
    .limit(1);
  return { connected: row !== undefined, lastUsedAt: row?.lastUsedAt ?? null };
}

// disconnects the extension
export async function revokeExtensionTokens(userId: string): Promise<void> {
  const db = await getDb();
  await db.delete(schema.extensionTokens).where(eq(schema.extensionTokens.userId, userId));
  await db.delete(schema.appSettings).where(eq(schema.appSettings.key, idKey(userId)));
}
