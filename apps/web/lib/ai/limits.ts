import { and, count, eq, gte, ne, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";

// the things people can ask the writing helpers to do
export const AI_FEATURES = ["optimize", "cover-letter", "bullets", "linkedin", "interview", "thank-you", "jd-extraction", "builder", "screening"] as const;
export type AiFeature = (typeof AI_FEATURES)[number];

// how many times a day one person can use each feature, null means no cap
export const DAILY_CAPS: Record<AiFeature, number | null> = {
  optimize: 10,
  "cover-letter": 10,
  bullets: 30,
  linkedin: 5,
  interview: 40,
  "thank-you": 10,
  builder: 30,
  // drafted answers to the written questions on an application form
  screening: 30,
  // reading a job description is cached and shared, so it is not capped per person
  "jd-extraction": null,
};

// across everyone, so one busy day cannot burn the whole free allowance
export const GLOBAL_DAILY_CAP = 1200;

// across every feature for one person, reading job descriptions included. it is an eighth of the shared allowance,
// so no single account can use it all up however it spreads its requests
export const USER_DAILY_CAP = 150;

// what is written in place of a model's name for a request that no provider answered
export const NO_ANSWER = "failed";

// midnight today, the caps reset then
function startOfDay(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

// how many times a feature was used today, by one person or by everyone.
// the count for one feature leaves out requests nobody answered, so a busy provider does not eat someone's ten cover letters.
// the counts across all features keep them in, because a request that failed still used up the shared allowance on the way.
// upTo only counts what came in no later than one held spot, so requests that arrive together are put in a line
export async function usedToday(feature?: AiFeature, userId?: string, upTo?: string): Promise<number> {
  const db = await getDb();
  const [row] = await db
    .select({ total: count() })
    .from(schema.aiUsage)
    .where(
      and(
        gte(schema.aiUsage.createdAt, startOfDay()),
        feature ? eq(schema.aiUsage.feature, feature) : undefined,
        feature ? ne(schema.aiUsage.model, NO_ANSWER) : undefined,
        userId ? eq(schema.aiUsage.userId, userId) : undefined,
        upTo ? sql`(${schema.aiUsage.createdAt}, ${schema.aiUsage.id}) <= (select ${schema.aiUsage.createdAt}, ${schema.aiUsage.id} from ${schema.aiUsage} where ${schema.aiUsage.id} = ${upTo})` : undefined,
      ),
    );
  return row?.total ?? 0;
}

// how many uses of a feature someone has left today, null when it is not capped
export async function remainingToday(userId: string, feature: AiFeature): Promise<number | null> {
  // the admin can change the caps, so the saved ones win over the built in ones
  const { dailyCaps } = await import("@/lib/data/settings");
  const cap = (await dailyCaps())[feature];
  if (cap === null) return null;
  return Math.max(0, cap - (await usedToday(feature, userId)));
}

// true when one person has used their whole share for today
export async function userCapReached(userId: string): Promise<boolean> {
  return (await usedToday(undefined, userId)) >= USER_DAILY_CAP;
}

// true when the shared daily allowance is used up
export async function globalCapReached(): Promise<boolean> {
  return (await usedToday()) >= GLOBAL_DAILY_CAP;
}

// what is written in place of a model's name while a request is still waiting on its answer
export const WAITING = "waiting";

// takes a spot in today's counts before any model is asked. requests sent side by side each count the spots ahead of theirs,
// so a burst of them cannot all get under a cap while the first answers are still on their way
export async function holdSpot(userId: string, feature: AiFeature): Promise<string> {
  const db = await getDb();
  const [row] = await db.insert(schema.aiUsage).values({ userId, feature, provider: "none", model: WAITING }).returning({ id: schema.aiUsage.id });
  if (!row) throw new Error("Could not count the request.");
  return row.id;
}

// which cap a held spot lands past, if any: the feature's own, the person's share of the day or the one everyone shares.
// only the uses up to and including the spot are counted, so the first ones in line go ahead and the rest are turned away
export async function capPassed(userId: string, feature: AiFeature, spot: string): Promise<"feature" | "user" | "global" | null> {
  const { dailyCaps } = await import("@/lib/data/settings");
  const cap = (await dailyCaps())[feature];
  if (cap !== null && (await usedToday(feature, userId, spot)) > cap) return "feature";
  if ((await usedToday(undefined, userId, spot)) > USER_DAILY_CAP) return "user";
  if ((await usedToday(undefined, undefined, spot)) > GLOBAL_DAILY_CAP) return "global";
  return null;
}

// fills in a held spot once we know who answered, or that nobody did
export async function settleSpot(id: string, entry: { provider: string; model: string; tokensIn: number; tokensOut: number }): Promise<void> {
  const db = await getDb();
  await db.update(schema.aiUsage).set(entry).where(eq(schema.aiUsage.id, id));
}

// gives a spot back when the request was turned away before any model was asked
export async function dropSpot(id: string): Promise<void> {
  const db = await getDb();
  await db.delete(schema.aiUsage).where(eq(schema.aiUsage.id, id));
}

// writes down one call, the caps and the admin page are built from these rows
export async function logUsage(entry: { userId: string; feature: AiFeature; provider: string; model: string; tokensIn: number; tokensOut: number }): Promise<void> {
  const db = await getDb();
  await db.insert(schema.aiUsage).values(entry);
}
