import { and, desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { Suggestion } from "@/lib/ai/prompts/optimize";

// the newest round of suggestions for a scan, so reopening the workspace does not cost another request
export async function latestOptimization(userId: string, scanId: string): Promise<{ id: string; suggestions: Suggestion[]; acceptedIds: string[]; finalText: string | null } | null> {
  const db = await getDb();
  const [row] = await db
    .select()
    .from(schema.optimizations)
    .where(and(eq(schema.optimizations.userId, userId), eq(schema.optimizations.scanId, scanId)))
    .orderBy(desc(schema.optimizations.createdAt))
    .limit(1);
  return row ? { id: row.id, suggestions: row.suggestions as Suggestion[], acceptedIds: row.acceptedIds, finalText: row.finalText } : null;
}

// saves a fresh round of suggestions
export async function saveSuggestions(userId: string, scanId: string, originalText: string, suggestions: Suggestion[], beforeScore: number): Promise<string> {
  const db = await getDb();
  const [row] = await db.insert(schema.optimizations).values({ userId, scanId, originalText, suggestions, beforeScore }).returning({ id: schema.optimizations.id });
  if (!row) throw new Error("Could not save the suggestions.");
  return row.id;
}

// records what was accepted and how the text ended up
export async function finishOptimization(userId: string, id: string, result: { acceptedIds: string[]; finalText: string; afterScore: number }): Promise<void> {
  const db = await getDb();
  await db
    .update(schema.optimizations)
    .set(result)
    .where(and(eq(schema.optimizations.id, id), eq(schema.optimizations.userId, userId)));
}
