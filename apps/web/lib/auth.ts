import { eq } from "drizzle-orm";
import { connection } from "next/server";
import { getDb, schema } from "@/db";
import { publicEnv } from "@/lib/env";

// the signed in person, as much as the pages need to know
export type CurrentUser = {
  id: string;
  email: string;
  name: string | null;
  isAdmin: boolean;
};

// the account used when the app runs on your own machine without sign in set up
const LOCAL_EMAIL = "you@resumefit.local";

// remembers the local user between requests so we do not look it up every time
const globalForAuth = globalThis as unknown as { localUser?: CurrentUser };

// local means one built in account, hosted means real sign in
export function authMode(): "local" | "hosted" {
  if (publicEnv.NEXT_PUBLIC_SUPABASE_URL && publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY) return "hosted";
  // on the live host a missing sign in setting is a mistake, and must never quietly turn into "everyone is the built in admin"
  if (process.env.VERCEL) throw new Error("Sign in is not set up. Connect the Supabase integration, or add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in the project settings.");
  return "local";
}

// finds the built in local account, making it the first time
async function localUser(): Promise<CurrentUser> {
  if (globalForAuth.localUser) return globalForAuth.localUser;
  const db = await getDb();
  // two pages loading at once can both get here, so the insert quietly steps aside when the account is already there
  await db.insert(schema.users).values({ email: LOCAL_EMAIL, name: "You", isAdmin: true }).onConflictDoNothing({ target: schema.users.email });
  const [row] = await db.select().from(schema.users).where(eq(schema.users.email, LOCAL_EMAIL)).limit(1);
  if (!row) throw new Error("Could not create the local account.");
  globalForAuth.localUser = { id: row.id, email: row.email, name: row.name, isAdmin: row.isAdmin };
  return globalForAuth.localUser;
}

// who is making this request, every page and action that touches data starts here
export async function getCurrentUser(): Promise<CurrentUser> {
  // tells the framework this depends on the live request, so pages are never built ahead with someone's data in them
  if (process.env.NEXT_RUNTIME) await connection();
  if (authMode() === "local") return localUser();
  const { hostedUser } = await import("@/lib/auth-hosted");
  return hostedUser();
}

// used after the local account is deleted, so a fresh one is made on the next visit
export function forgetLocalUser(): void {
  globalForAuth.localUser = undefined;
}
