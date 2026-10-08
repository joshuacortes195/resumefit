import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { serverEnv } from "@/lib/env";
import * as schema from "./schema";

// keeps one connection around between hot reloads in dev
const globalForDb = globalThis as unknown as { pg?: ReturnType<typeof postgres> };

// hands back the database client, only connects the first time it's asked for
export function getDb() {
  const { DATABASE_URL } = serverEnv();
  if (!DATABASE_URL) throw new Error("DATABASE_URL is not set. Copy .env.example to apps/web/.env.local and fill it in.");
  // prepare is off because the supabase pooler does not support it
  globalForDb.pg ??= postgres(DATABASE_URL, { prepare: false });
  return drizzle(globalForDb.pg, { schema });
}

export { schema };
