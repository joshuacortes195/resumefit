import { Suspense } from "react";
import Link from "next/link";
import { LinkedinForm } from "@/components/linkedin-form";
import { ScoreRing } from "@/components/score-ring";
import { CARD } from "@/components/ui/buttons";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUser } from "@/lib/auth";
import { listJobs, getJob } from "@/lib/data/jobs";
import { listLinkedinReports } from "@/lib/data/practice";

export const metadata = { title: "LinkedIn Optimizer" };

const DATE = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });

// score a linkedin profile against the jobs you want
export default function LinkedinPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">LinkedIn Optimizer</h1>
        <p className="mt-1 max-w-2xl text-muted">Recruiters search LinkedIn the way they search resumes. See which keywords your profile is missing for the jobs you want, part by part.</p>
      </div>
      <Suspense fallback={<Skeleton className="h-96" />}>
        <FormLoader />
      </Suspense>
      <Suspense fallback={null}>
        <History />
      </Suspense>
    </div>
  );
}

// the form, with tracked jobs offered as targets
async function FormLoader() {
  const user = await getCurrentUser();
  const jobs = await listJobs(user.id);
  const full = await Promise.all(jobs.slice(0, 15).map((job) => getJob(user.id, job.id)));
  return (
    <LinkedinForm
      jobs={full.flatMap((job) => (job?.description && job.description.length >= 50 ? [{ id: job.id, label: [job.title, job.company].filter(Boolean).join(", "), description: job.description }] : []))}
    />
  );
}

// earlier reports
async function History() {
  const user = await getCurrentUser();
  const reports = await listLinkedinReports(user.id);
  if (reports.length === 0) return null;
  return (
    <section className={`${CARD} p-6`}>
      <h2 className="text-lg font-semibold">LinkedIn scan history</h2>
      <ul className="mt-3 divide-y divide-border">
        {reports.map((report) => (
          <li key={report.id}>
            <Link href={`/linkedin/${report.id}`} className="group flex items-center gap-4 py-3">
              <ScoreRing score={report.score} size="sm" label="LinkedIn score" />
              <span className="min-w-0 flex-1 truncate group-hover:text-primary">{report.headline || "No headline"}</span>
              <span className="shrink-0 text-sm text-muted">{DATE.format(report.createdAt)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
