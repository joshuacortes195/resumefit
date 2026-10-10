import { refreshFeed, savedJobs } from "@/lib/jobs-feed";

// this one is allowed to run for a while, it is fetching many companies' openings
export const maxDuration = 60;

// visited once a day to refresh the saved job openings. it only refetches companies whose openings have gone stale,
// so visiting it more often does no harm and no extra work
export async function GET(): Promise<Response> {
  try {
    const result = await refreshFeed(50_000);
    // how much is saved now, handy when checking that the feed is healthy
    const pool = await savedJobs();
    return Response.json({ ok: true, ...result, boards: pool.boards, jobs: pool.jobs.length });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}
