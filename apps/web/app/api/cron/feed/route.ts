import { timingSafeEqual } from "node:crypto";
import { serverEnv } from "@/lib/env";
import { refreshFeed, savedJobs } from "@/lib/jobs-feed";
import { withinLimit } from "@/lib/rate-limit";

// this one is allowed to run for a while, it is fetching many companies' openings
export const maxDuration = 60;

// true when the visit carries the secret the host sends with its own scheduled visits
function fromScheduler(request: Request, secret: string): boolean {
  const sent = Buffer.from(request.headers.get("authorization") ?? "");
  const wanted = Buffer.from(`Bearer ${secret}`);
  return sent.length === wanted.length && timingSafeEqual(sent, wanted);
}

// visited once a day to refresh the saved job openings. it only refetches companies whose openings have gone stale,
// so visiting it more often does no harm and no extra work
export async function GET(request: Request): Promise<Response> {
  try {
    // with a secret set, only the scheduler gets in. without one, the address still cannot be hammered:
    // a couple of visits a minute from everyone put together is all it will answer
    const secret = serverEnv().CRON_SECRET;
    if (secret ? !fromScheduler(request, secret) : !(await withinLimit("everyone", "feed-refresh"))) return Response.json({ ok: false }, { status: secret ? 401 : 429 });
    const result = await refreshFeed(50_000);
    // how much is saved now, handy when checking that the feed is healthy
    const pool = await savedJobs();
    return Response.json({ ok: true, ...result, boards: pool.boards, jobs: pool.jobs.length });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}
