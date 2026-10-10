import { refreshFeed } from "@/lib/jobs-feed";

// this one is allowed to run for a while, it is fetching many companies' openings
export const maxDuration = 60;

// visited once a day to refresh the saved job openings. it only refetches companies whose openings have gone stale,
// so visiting it more often does no harm and no extra work
export async function GET(): Promise<Response> {
  try {
    return Response.json({ ok: true, ...(await refreshFeed(50_000)) });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}
