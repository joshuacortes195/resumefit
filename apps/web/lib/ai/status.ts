import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { AI_FEATURES, usedToday, type AiFeature } from "@/lib/ai/limits";
import { dailyCaps } from "@/lib/data/settings";
import { providerHealth, readyProviders } from "@/lib/ai/router";

// what the settings page shows about the writing helpers
export type AiStatus = {
  // true when at least one provider can be called for this user
  available: boolean;
  hasOwnKey: boolean;
  providers: { name: string; ready: boolean; lastError: string | null }[];
  // uses left today for each capped feature
  remaining: Partial<Record<AiFeature, number>>;
};

// gathers which providers are set up and how much of today's allowance is left
export async function aiStatus(userId: string): Promise<AiStatus> {
  const db = await getDb();
  const [ready, ownKey] = await Promise.all([
    readyProviders(userId),
    db
      .select({ provider: schema.userAiKeys.provider })
      .from(schema.userAiKeys)
      .where(and(eq(schema.userAiKeys.userId, userId), eq(schema.userAiKeys.provider, "gemini")))
      .limit(1),
  ]);
  const health = providerHealth();
  const names = new Set(ready.map((provider) => provider.name));

  const remaining: AiStatus["remaining"] = {};
  // the caps the admin set, not just the built in ones
  const caps = await dailyCaps();
  for (const feature of AI_FEATURES) {
    const cap = caps[feature];
    if (cap !== null) remaining[feature] = Math.max(0, cap - (await usedToday(feature, userId)));
  }

  return {
    available: ready.length > 0,
    hasOwnKey: ownKey.length > 0,
    providers: (["gemini", "groq", "cloudflare"] as const).map((name) => ({ name, ready: names.has(name), lastError: health[name]?.lastError ?? null })),
    remaining,
  };
}
