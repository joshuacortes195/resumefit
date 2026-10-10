import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { DAILY_CAPS, type AiFeature } from "@/lib/ai/limits";

// features that can be switched on and off from the admin page
export const FLAGS = { findJobs: "Find Jobs", interviewVoice: "Voice answers in Interview Practice" } as const;
export type Flag = keyof typeof FLAGS;
const FLAG_DEFAULTS: Record<Flag, boolean> = { findJobs: true, interviewVoice: true };

// reads one saved setting, null when it was never changed
async function read<T>(key: string): Promise<T | null> {
  const db = await getDb();
  const [row] = await db.select({ value: schema.appSettings.value }).from(schema.appSettings).where(eq(schema.appSettings.key, key)).limit(1);
  return (row?.value as T | undefined) ?? null;
}

async function write(key: string, value: unknown): Promise<void> {
  const db = await getDb();
  await db.insert(schema.appSettings).values({ key, value }).onConflictDoUpdate({ target: schema.appSettings.key, set: { value } });
}

// the daily caps in force: the built in ones, with any the admin changed on top
export async function dailyCaps(): Promise<Record<AiFeature, number | null>> {
  const saved = (await read<Partial<Record<AiFeature, number>>>("ai-caps")) ?? {};
  const caps = { ...DAILY_CAPS };
  for (const feature of Object.keys(caps) as AiFeature[]) {
    // features without a cap stay that way
    if (caps[feature] !== null && typeof saved[feature] === "number") caps[feature] = saved[feature];
  }
  return caps;
}

export async function saveDailyCaps(caps: Partial<Record<AiFeature, number>>): Promise<void> {
  await write("ai-caps", caps);
}

// which switches are on
export async function featureFlags(): Promise<Record<Flag, boolean>> {
  return { ...FLAG_DEFAULTS, ...((await read<Partial<Record<Flag, boolean>>>("flags")) ?? {}) };
}

export async function saveFeatureFlags(flags: Record<Flag, boolean>): Promise<void> {
  await write("flags", flags);
}
