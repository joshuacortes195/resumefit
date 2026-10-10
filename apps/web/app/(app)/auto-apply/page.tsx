import { Suspense } from "react";
import { AutoApply } from "@/components/auto-apply";
import { CARD } from "@/components/ui/buttons";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUser } from "@/lib/auth";
import { listApplications } from "@/lib/data/applications";
import { autoSubmit, extensionId, extensionStatus } from "@/lib/data/extension";
import { listJobs } from "@/lib/data/jobs";
import { applicationAnswered, getProfile, profileReady } from "@/lib/data/profile";
import { applicationParts } from "@/lib/profile";
import { listResumes } from "@/lib/data/resumes";
import { featureFlags } from "@/lib/data/settings";

export const metadata = { title: "Auto Apply" };

// the suggestions may have to fetch fresh openings the first time
export const maxDuration = 60;

// the four steps, in order
const STEPS = [
  { title: "Pick jobs and hit Auto Apply", text: "We line up open roles that suit your resume. Start one, or tick up to five and start them together." },
  { title: "We open and fill it", text: "The extension opens each application and types in your details, attaches your resume and drafts the written answers." },
  { title: "Review and submit", text: "A bar on the page shows what needs you. You check it and press the site's own Submit button, unless you switch on Submit for me." },
  { title: "It tracks itself", text: "When the site says thanks, the job moves to Applied on your tracker." },
];

// auto apply: how it works, what to set up, and the jobs and applications
export default function AutoApplyPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Auto Apply</h1>
        <p className="mt-1 max-w-2xl text-muted">One click opens the application and fills it out. You review it and hit submit, or let us send the ones that need nothing from you. Free, with no credits to run out of.</p>
      </div>

      {/* this really is a sequence, so the steps are numbered */}
      <ol className={`${CARD} stagger grid gap-5 p-6 sm:grid-cols-2 lg:grid-cols-4`}>
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
  const [jobs, applications, profile, extension, resumes, flags, knownExtension, submitForMe, answered] = await Promise.all([
    listJobs(user.id),
    listApplications(user.id),
    getProfile(user.id),
    extensionStatus(user.id),
    listResumes(user.id),
    featureFlags(),
    extensionId(user.id),
    autoSubmit(user.id),
    applicationAnswered(user.id),
  ]);
  return (
    <AutoApply
      jobs={jobs
        .filter((job) => job.url && /^https?:\/\//.test(job.url) && URL.canParse(job.url) && job.status !== "rejected")
        .map((job) => ({ id: job.id, title: job.title, company: job.company, url: job.url ?? "", matchRate: job.matchRate, createdAt: job.createdAt.toISOString() }))}
      applications={applications.map((application) => ({
        id: application.id,
        jobId: application.jobId,
        jobTitle: application.jobTitle,
        company: application.company,
        ats: application.ats,
        applyUrl: application.applyUrl,
        status: application.status,
        fieldsFilled: application.fieldsFilled,
        fieldsNeedingAttention: application.fieldsNeedingAttention,
        updatedAt: application.updatedAt.toISOString(),
      }))}
      resumes={resumes.map(({ id, name, isBase }) => ({ id, name, isBase }))}
      suggest={flags.findJobs}
      profileReady={profileReady(profile)}
      extensionConnected={extension.connected}
      extensionId={knownExtension}
      submitForMe={submitForMe}
      parts={applicationParts(profile, answered)}
    />
  );
}
