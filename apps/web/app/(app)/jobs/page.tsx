import { Suspense } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { FindJobs } from "@/components/find-jobs";
import { LINK_BUTTON } from "@/components/ui/buttons";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUser } from "@/lib/auth";
import { listResumes } from "@/lib/data/resumes";
import { featureFlags } from "@/lib/data/settings";
import { BOARDS } from "@/lib/jobs-feed";

export const metadata = { title: "Find Jobs" };

// search open roles from public job boards and rank them against your resume
export default function JobsPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-3xl font-semibold">Find Jobs</h1>
      <p className="mt-1 mb-6 max-w-2xl text-muted">Open roles from the public job boards of {BOARDS.length} companies, ranked against your resume. Bring your own job descriptions for everything else.</p>
      <Suspense fallback={<Skeleton className="h-64" />}>
        <JobsLoader />
      </Suspense>
    </div>
  );
}

// shows the search when the feature is switched on
async function JobsLoader() {
  const user = await getCurrentUser();
  if (!(await featureFlags()).findJobs) {
    return (
      <EmptyState icon={Search} title="Find Jobs is switched off" text="It is an optional part of the app. Every other feature works with job descriptions you paste in or save with the extension.">
        {user.isAdmin && (
          <Link href="/admin" className={LINK_BUTTON}>
            Switch it on from the admin page
          </Link>
        )}
      </EmptyState>
    );
  }
  return <FindJobs hasResume={(await listResumes(user.id)).length > 0} />;
}
