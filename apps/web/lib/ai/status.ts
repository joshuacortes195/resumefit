import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { decrypt } from "@/lib/ai/crypto";
import { AI_FEATURES, usedToday, type AiFeature } from "@/lib/ai/limits";
import { encryptionSecret } from "@/lib/ai/secret";
import { dailyCaps } from "@/lib/data/settings";
import { readyProviders, savedProviderHealth } from "@/lib/ai/router";

// what the settings page shows about the writing helpers
export type AiStatus = {
  // true when at least one provider can be called for this user
  available: boolean;
  hasOwnKey: boolean;
  // the last four characters of the saved key, so it can be told apart. the rest never leaves the server
  ownKeyEnding: string | null;
  providers: { name: string; ready: boolean; lastError: string | null }[];
  // uses left today for each capped feature
  remaining: Partial<Record<AiFeature, number>>;
};

// the last four characters of a saved key, null when there is none or it can no longer be unlocked
function keyEnding(encryptedKey: string | undefined): string | null {
  const secret = encryptionSecret();
  const key = encryptedKey && secret ? decrypt(encryptedKey, secret) : null;
  return key ? key.slice(-4) : null;
}

// turns what a provider said into a short plain reason. the raw text can hold the provider's own json and model names,
// which mean nothing to the person reading the settings page, so it stays in the server log and on the admin page
export function plainProblem(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const status = Number(raw.match(/^(\d{3}):/)?.[1] ?? raw.match(/status (\d{3})/)?.[1]);
  if (status === 429) return "It had reached its free limit for the moment. It is tried again on the next request.";
  if (status === 401 || status === 403) return "It did not accept the key it was given.";
  if (status === 402) return "It asked for billing to be set up.";
  if (status === 404) return "The model it was asked for was not available.";
  if (status === 400) return "It would not take the request.";
  if (status >= 500) return "It was busy or down for a moment.";
  if (/timeout|timed out|abort/i.test(raw)) return "It took too long to answer.";
  if (/shape|json|empty reply/i.test(raw)) return "It sent back an answer we could not use.";
  return "It had a problem answering.";
}

// gathers which providers are set up and how much of today's allowance is left
export async function aiStatus(userId: string): Promise<AiStatus> {
  const db = await getDb();
  const [ready, ownKey] = await Promise.all([
    readyProviders(userId),
    db
      .select({ encryptedKey: schema.userAiKeys.encryptedKey })
      .from(schema.userAiKeys)
      .where(and(eq(schema.userAiKeys.userId, userId), eq(schema.userAiKeys.provider, "gemini")))
      .limit(1),
  ]);
  const health = await savedProviderHealth();
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
    ownKeyEnding: keyEnding(ownKey[0]?.encryptedKey),
    providers: (["gemini", "groq", "cloudflare"] as const).map((name) => ({ name, ready: names.has(name), lastError: plainProblem(health[name]?.lastError) })),
    remaining,
  };
}
