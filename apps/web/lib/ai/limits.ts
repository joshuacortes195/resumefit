import { and, count, eq, gte, ne } from "drizzle-orm";
import { getDb, schema } from "@/db";

// the things people can ask the writing helpers to do
export const AI_FEATURES = ["optimize", "cover-letter", "bullets", "linkedin", "interview", "thank-you", "jd-extraction", "builder"] as const;
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
// the counts across all features keep them in, because a request that failed still used up the shared allowance on the way
export async function usedToday(feature?: AiFeature, userId?: string): Promise<number> {
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

// writes down a request that every provider failed. it counts toward the person's and everyone's daily total,
// so sending requests that are bound to fail is not a way around the caps
export async function logFailure(userId: string, feature: AiFeature): Promise<void> {
  await logUsage({ userId, feature, provider: "none", model: NO_ANSWER, tokensIn: 0, tokensOut: 0 }).catch(() => undefined);
}

// writes down one call, the caps and the admin page are built from these rows
export async function logUsage(entry: { userId: string; feature: AiFeature; provider: string; model: string; tokensIn: number; tokensOut: number }): Promise<void> {
  const db = await getDb();
  await db.insert(schema.aiUsage).values(entry);
}
