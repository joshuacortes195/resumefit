import Link from "next/link";
import { ArrowRight, Briefcase, CalendarClock, ScanSearch, UserSearch } from "lucide-react";
import { JOB_STATUSES } from "@resumefit/shared";
import { ScoreRing } from "@/components/score-ring";

export const metadata = { title: "Dashboard" };

// tracker columns shown as counters on the dashboard
const TRACKER_COUNTS = JOB_STATUSES.filter((status) => status !== "rejected");

// home page after sign in
export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* welcome text */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Welcome to ResumeFit!</h1>
        <p className="mt-1 text-muted">See how well your resume fits a job, fix what is missing and keep every application in one place.</p>
      </div>

      {/* start a scan card */}
      <section className="flex flex-col items-start gap-4 rounded-xl border border-border bg-surface p-6 shadow-sm sm:flex-row sm:items-center">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
          <ScanSearch className="size-6" aria-hidden />
        </span>
        <div className="flex-1">
          <h2 className="font-semibold">Scan your resume against a job</h2>
          <p className="text-sm text-muted">Upload a resume, paste the job description and aim for a 75%+ match.</p>
        </div>
        <Link href="/scans/new" className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-hover">
          New Scan
        </Link>
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        {/* latest scan card, empty until the first scan */}
        <section className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          <h2 className="font-semibold">Latest Resume Scan</h2>
          <div className="mt-4 flex items-center gap-4">
            <ScoreRing score={0} />
            <p className="text-sm text-muted">No scans yet. Your most recent match rate and checklist will show up here.</p>
          </div>
        </section>

        {/* linkedin card */}
        <section className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          <h2 className="font-semibold">LinkedIn Report</h2>
          <p className="mt-4 text-sm text-muted">Score your profile against the jobs you want and see which keywords are missing.</p>
          <Link href="/linkedin" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:text-primary-hover">
            <UserSearch className="size-4" aria-hidden />
            Optimize LinkedIn
          </Link>
        </section>

        {/* tracker counts card */}
        <section className="rounded-xl border border-border bg-surface p-6 shadow-sm md:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-semibold">
              <Briefcase className="size-4 text-muted" aria-hidden />
              Job Tracker
            </h2>
            <Link href="/tracker" className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:text-primary-hover">
              Open tracker
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>

          {/* one counter per column */}
          <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {TRACKER_COUNTS.map((status) => (
              <div key={status} className="rounded-lg border border-border p-3">
                <dt className="text-xs font-medium uppercase tracking-wide text-muted">{status}</dt>
                <dd className="mt-1 text-2xl font-semibold tabular-nums">0</dd>
              </div>
            ))}
          </dl>

          {/* next interview line */}
          <p className="mt-4 flex items-center gap-2 text-sm text-muted">
            <CalendarClock className="size-4" aria-hidden />
            Next interview: No upcoming interview
          </p>
        </section>
      </div>
    </div>
  );
}
