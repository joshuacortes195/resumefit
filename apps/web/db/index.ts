import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { serverEnv } from "@/lib/env";
import * as schema from "./schema";

export type Db = PostgresJsDatabase<typeof schema>;

// keeps one connection around between hot reloads in dev
const globalForDb = globalThis as unknown as { db?: Promise<Db> };

// where the local database and uploads live when no hosted database is set up
export const LOCAL_DATA_DIR = process.env.LOCAL_DATA_DIR ?? path.join(process.cwd(), ".data");

// the migrations folder, whether the app was started from its own folder or from the repo root
function migrationsFolder(): string {
  const here = path.join(process.cwd(), "db", "migrations");
  return existsSync(here) ? here : path.join(process.cwd(), "apps", "web", "db", "migrations");
}

// true when the app is running on the built in local database
export function isLocalDb(): boolean {
  return !serverEnv().DATABASE_URL;
}

// connection strings from hosting integrations carry extra settings the database itself does not know, which would make it refuse the connection
export function cleanDatabaseUrl(raw: string): string {
  try {
    const url = new URL(raw);
    for (const name of [...url.searchParams.keys()]) if (!["sslmode", "ssl"].includes(name)) url.searchParams.delete(name);
    return url.toString();
  } catch {
    return raw;
  }
}

// opens the hosted database, or a local one on disk so the app runs without any accounts
async function connect(): Promise<Db> {
  const { DATABASE_URL } = serverEnv();
  if (DATABASE_URL) {
    // prepare is off because the supabase pooler does not support it.
    // the connection is always encrypted, whatever the address says, unless it turns that off itself for a database on the same machine
    return drizzle(postgres(cleanDatabaseUrl(DATABASE_URL), { prepare: false, ssl: /[?&]sslmode=disable\b/.test(DATABASE_URL) ? false : "require" }), { schema });
  }
  if (process.env.VERCEL) throw new Error("No database address is set. Connect the Supabase integration, or add DATABASE_URL in the project settings.");

  // the local database is real postgres running inside the app, it gets its tables on first start
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle: drizzleLocal } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  if (LOCAL_DATA_DIR !== "memory") mkdirSync(LOCAL_DATA_DIR, { recursive: true });
  // tests ask for a throwaway database that only lives in memory
  const local = drizzleLocal(LOCAL_DATA_DIR === "memory" ? new PGlite() : new PGlite(path.join(LOCAL_DATA_DIR, "db")), { schema });
  await migrate(local, { migrationsFolder: migrationsFolder() });
  // both drivers answer the same queries, so the rest of the app only needs to know one type
  return local as unknown as Db;
}

// hands back the database client, only connects the first time it's asked for
export function getDb(): Promise<Db> {
  globalForDb.db ??= connect().catch((error) => {
    // let the next call try again instead of keeping a broken connection around
    globalForDb.db = undefined;
    throw error;
  });
  return globalForDb.db;
}

export { schema };
