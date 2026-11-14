import { Suspense } from "react";
import Link from "next/link";
import { ApplySaved } from "@/components/tracker/apply-saved";
import { BoardLoader } from "@/components/tracker/board-loader";
import { LINK_BUTTON } from "@/components/ui/buttons";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUser } from "@/lib/auth";
import { listJobs } from "@/lib/data/jobs";
import { getProfile } from "@/lib/data/profile";
import { featureFlags } from "@/lib/data/settings";

// the button that works through every saved job, only for a person who asked for their applications to be sent
async function ApplySavedLoader() {
  const user = await getCurrentUser();
  const [profile, flags, live] = await Promise.all([getProfile(user.id), featureFlags(), listJobs(user.id, false)]);
  if (!flags.autoApply || profile.autoSend === "off") return null;
  // only saved jobs with a secure link can be opened
  const jobs = live.flatMap((job) => (job.status === "saved" && job.url && /^https:\/\//.test(job.url) ? [{ jobId: job.id, url: job.url }] : []));
  return jobs.length > 0 ? <ApplySaved jobs={jobs} cap={profile.dailySendCap} /> : null;
}

// the board shows on every tracker page, a job's card opens on top of it
export default function TrackerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <h1 className="text-3xl font-semibold">Application Tracker</h1>
      <p className="mt-1 mb-6 text-muted">
        Drag jobs from Saved to Offer and keep notes on each one.{" "}
        <Link href="/applications" className={LINK_BUTTON}>
          All applications
        </Link>
      </p>
      <Suspense fallback={null}>
        <ApplySavedLoader />
      </Suspense>
      <Suspense
        fallback={
          <div className="flex gap-3" role="status" aria-label="Loading the board">
            {Array.from({ length: 5 }, (_, index) => (
              <Skeleton key={index} className="h-72 flex-1" />
            ))}
          </div>
        }
      >
        <BoardLoader />
      </Suspense>
      {children}
    </div>
  );
}
