import { Suspense } from "react";
import { Board } from "@/components/tracker/board";
import { BoardFilter } from "@/components/tracker/board-filter";
import { getCurrentUser } from "@/lib/auth";
import { listJobs } from "@/lib/data/jobs";

// loads both the live and the archived jobs, the filter picks which one shows
export async function BoardLoader() {
  const user = await getCurrentUser();
  const [live, archived] = await Promise.all([listJobs(user.id, false), listJobs(user.id, true)]);
  return (
    <Suspense fallback={<Board jobs={live} archived={false} />}>
      <BoardFilter live={live} archived={archived} />
    </Suspense>
  );
}
