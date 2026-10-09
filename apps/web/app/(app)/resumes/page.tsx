import { Suspense } from "react";
import { ResumeManager } from "@/components/resume-manager";
import { TableSkeleton } from "@/components/ui/skeleton";
import { getCurrentUser } from "@/lib/auth";
import { listManagedResumes } from "@/lib/data/resumes";

export const metadata = { title: "Resume Manager" };

// every resume version you've saved, with one marked as your base
export default function ResumesPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-3xl font-semibold">Resume Manager</h1>
      <p className="mt-1 mb-6 text-muted">Every resume version you&apos;ve saved. The starred one is your base, the one new scans start from.</p>
      <Suspense fallback={<TableSkeleton />}>
        <ResumeTable />
      </Suspense>
    </div>
  );
}

// loads the user's resumes for the table
async function ResumeTable() {
  const user = await getCurrentUser();
  return <ResumeManager resumes={await listManagedResumes(user.id)} />;
}
