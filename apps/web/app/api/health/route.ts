import { sql } from "drizzle-orm";
import { getDb } from "@/db";

// a tiny check that the app and its database are both awake.
// a daily visit here also keeps the free database from being paused for sitting idle
export async function GET(): Promise<Response> {
  try {
    const db = await getDb();
    await db.execute(sql`select 1`);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}
