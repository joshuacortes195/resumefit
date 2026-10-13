import { like, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";

// how often one person may do each of the expensive things, per minute. these sit on top of the daily caps,
// and stop a script or a stuck button from firing dozens of requests at once
export const RATE_LIMITS = {
  scan: 20,
  upload: 20,
  ai: 20,
  "find-jobs": 30,
  "job-import": 15,
  "save-job": 30,
  // looking up skills for the builder, which reads through thousands of them each time
  "skill-lookup": 30,
  export: 30,
  // the zip of everything someone has stored is the heaviest download there is
  "account-export": 3,
  // shared by everyone, for the job refresh address when it has no secret. this one is per ten minutes
  "feed-refresh": 1,
  // sign in emails one address can ask for, and sign in tries from one connection. these two are per quarter of an hour
  "sign-in-email": 5,
  "sign-in-ip": 20,
} as const;
export type RateBucket = keyof typeof RATE_LIMITS;

// shown when someone goes over, with the status code that means "slow down"
export class RateLimitError extends Error {
  status = 429;
  constructor() {
    super("That is a lot of requests in a short time. Wait a minute and try again.");
  }
}

const WINDOW_MS = 60_000;

// counts one more use and says whether it is still within the limit. the count lives in the database,
// so it holds across the many short lived copies of the app that a host runs, not just inside one of them
export async function withinLimit(userId: string, bucket: RateBucket, limit: number = RATE_LIMITS[bucket], now = Date.now(), windowMs = WINDOW_MS): Promise<boolean> {
  const db = await getDb();
  const key = `rate:${userId}:${bucket}`;
  const fresh = JSON.stringify({ start: now, count: 1 });
  // one statement, so two requests landing together cannot both read the old count
  const rows = await db
    .insert(schema.appSettings)
    .values({ key, value: { start: now, count: 1 } })
    .onConflictDoUpdate({
      target: schema.appSettings.key,
      set: {
        // a window that has run out starts again from one, otherwise the count goes up
        value: sql`case when (${schema.appSettings.value}->>'start')::bigint <= ${now - windowMs} then ${fresh}::jsonb else jsonb_set(${schema.appSettings.value}, '{count}', to_jsonb((${schema.appSettings.value}->>'count')::int + 1)) end`,
      },
    })
    .returning({ value: schema.appSettings.value });
  const count = (rows[0]?.value as { count?: number } | undefined)?.count ?? 1;
  return count <= limit;
}

// the same check for places that would rather throw than branch
export async function rateLimit(userId: string, bucket: RateBucket): Promise<void> {
  if (!(await withinLimit(userId, bucket))) throw new RateLimitError();
}

// forgets a person's counters, used when their account is deleted
export async function clearRateLimits(userId: string): Promise<void> {
  const db = await getDb();
  await db.delete(schema.appSettings).where(like(schema.appSettings.key, `rate:${userId}:%`));
}
