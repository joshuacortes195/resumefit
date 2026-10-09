import { Suspense } from "react";
import { AutoApply } from "@/components/auto-apply";
import { CARD } from "@/components/ui/buttons";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUser } from "@/lib/auth";
import { listApplications } from "@/lib/data/applications";
import { extensionStatus } from "@/lib/data/extension";
import { listJobs } from "@/lib/data/jobs";
import { getProfile, profileReady } from "@/lib/data/profile";

export const metadata = { title: "Auto Apply" };

// the four steps, in order
const STEPS = [
  { title: "Find a job and hit Auto Apply", text: "Any job on your tracker with a link to its posting can be started from here." },
  { title: "Complete your preferences", text: "Your profile holds the answers that get typed in. Fill it in once." },
  { title: "Review and submit", text: "The extension fills the form. You check every field and press the site's own Submit button." },
  { title: "Track it", text: "Mark it as applied and the job moves to Applied on your tracker." },
];

// auto apply: how it works, what to set up, and the jobs and applications
export default function AutoApplyPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Auto Apply</h1>
        <p className="mt-1 max-w-2xl text-muted">We fill out the application, you review it and hit submit. Free, with no credits to run out of.</p>
      </div>

      {/* this really is a sequence, so the steps are numbered */}
      <ol className={`${CARD} grid gap-5 p-6 sm:grid-cols-2 lg:grid-cols-4`}>
        {STEPS.map((step, index) => (
          <li key={step.title}>
            <span className="flex size-7 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary">{index + 1}</span>
            <p className="mt-2 font-semibold">{step.title}</p>
            <p className="mt-1 text-sm text-muted">{step.text}</p>
          </li>
        ))}
      </ol>

      <Suspense fallback={<Skeleton className="h-72" />}>
        <AutoApplyLoader />
      </Suspense>
    </div>
  );
}

// loads the jobs that can be applied to and the applications so far
async function AutoApplyLoader() {
  const user = await getCurrentUser();
  const [jobs, applications, profile, extension] = await Promise.all([listJobs(user.id), listApplications(user.id), getProfile(user.id), extensionStatus(user.id)]);
  return (
    <AutoApply
      jobs={jobs
        .filter((job) => job.url && /^https?:\/\//.test(job.url) && job.status !== "rejected")
        .map((job) => ({ id: job.id, title: job.title, company: job.company, url: job.url ?? "", matchRate: job.matchRate, createdAt: job.createdAt.toISOString() }))}
      applications={applications.map((application) => ({
        id: application.id,
        jobTitle: application.jobTitle,
        company: application.company,
        ats: application.ats,
        applyUrl: application.applyUrl,
        status: application.status,
        fieldsFilled: application.fieldsFilled,
        fieldsNeedingAttention: application.fieldsNeedingAttention,
        updatedAt: application.updatedAt.toISOString(),
      }))}
      profileReady={profileReady(profile)}
      extensionConnected={extension.connected}
    />
  );
}
