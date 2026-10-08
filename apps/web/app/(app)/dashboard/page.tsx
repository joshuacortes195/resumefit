import Link from "next/link";
import { ArrowRight, Briefcase, CalendarClock, Check, Plus, UserSearch } from "lucide-react";
import { JOB_STATUSES } from "@resumefit/shared";
import { ScoreRing } from "@/components/score-ring";

export const metadata = { title: "Dashboard" };

// tracker columns shown as counters on the dashboard
const TRACKER_COUNTS = JOB_STATUSES.filter((status) => status !== "rejected");

// made up skills for the sample report preview
const SAMPLE_FOUND = ["TypeScript", "React", "REST APIs", "Unit testing"];
const SAMPLE_MISSING = ["GraphQL", "CI/CD"];

// home page after sign in
export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* welcome card with the new scan button and a sample report */}
      <section className="grid gap-8 rounded-2xl border border-border bg-surface p-6 sm:p-8 md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <h1 className="text-3xl font-semibold sm:text-4xl">Welcome to ResumeFit</h1>
          <p className="mt-3 max-w-xl text-muted">
            See how well your resume fits a job, fix what is missing and keep every application in one place. Aim for a match of 75% or more.
          </p>
          <Link
            href="/scans/new"
            className="group mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary transition duration-150 hover:bg-primary-hover active:scale-[0.98]"
          >
            <Plus className="size-4 transition-transform duration-200 group-hover:rotate-90" aria-hidden />
            New Scan
          </Link>
        </div>

        {/* sample report, the ring draws in and then the skills show one by one */}
        <figure className="flex items-center gap-5 rounded-xl bg-background p-5">
          <ScoreRing score={82} size="lg" label="Sample match rate" />
          <div className="max-w-52">
            <figcaption className="text-sm font-semibold">Sample report</figcaption>
            <ul className="mt-3 flex flex-wrap gap-1.5 text-xs font-medium">
              {/* skills the resume already has, shown like highlighter marks */}
              {SAMPLE_FOUND.map((skill, index) => (
                <li
                  key={skill}
                  className="flex animate-rise items-center gap-1 rounded bg-marker px-1.5 py-0.5 text-on-marker"
                  style={{ animationDelay: `${900 + index * 70}ms` }}
                >
                  <Check className="size-3" aria-hidden />
                  {skill}
                </li>
              ))}
              {/* skills the job wants that are not in the resume */}
              {SAMPLE_MISSING.map((skill, index) => (
                <li
                  key={skill}
                  className="animate-rise rounded border border-dashed border-muted/60 px-1.5 py-0.5 text-muted"
                  style={{ animationDelay: `${900 + (SAMPLE_FOUND.length + index) * 70}ms` }}
                >
                  <span className="sr-only">Missing: </span>
                  {skill}
                </li>
              ))}
            </ul>
          </div>
        </figure>
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        {/* latest scan card, empty until the first scan */}
        <section className="rounded-2xl border border-border bg-surface p-6">
          <h2 className="font-semibold">Latest Resume Scan</h2>
          <div className="mt-4 flex items-center gap-4">
            <ScoreRing score={0} />
            <p className="text-sm text-muted">No scans yet. Your most recent match rate and checklist will show up here.</p>
          </div>
        </section>

        {/* linkedin card */}
        <section className="rounded-2xl border border-border bg-surface p-6">
          <h2 className="font-semibold">LinkedIn Report</h2>
          <p className="mt-4 text-sm text-muted">Score your profile against the jobs you want and see which keywords are missing.</p>
          <Link
            href="/linkedin"
            className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary transition-colors duration-150 hover:text-primary-hover"
          >
            <UserSearch className="size-4" aria-hidden />
            Optimize LinkedIn
          </Link>
        </section>

        {/* tracker counts card */}
        <section className="rounded-2xl border border-border bg-surface p-6 md:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-semibold">
              <Briefcase className="size-4 text-muted" aria-hidden />
              Job Tracker
            </h2>
            {/* the arrow nudges over on hover */}
            <Link
              href="/tracker"
              className="group inline-flex items-center gap-1 text-sm font-semibold text-primary transition-colors duration-150 hover:text-primary-hover"
            >
              Open tracker
              <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
            </Link>
          </div>

          {/* one counter per column, split by thin lines */}
          <dl className="mt-5 grid grid-cols-2 gap-y-4 sm:grid-cols-4 sm:divide-x sm:divide-border">
            {TRACKER_COUNTS.map((status) => (
              <div key={status} className="sm:px-5 sm:first:pl-0">
                <dt className="text-sm capitalize text-muted">{status}</dt>
                <dd className="mt-1 font-display text-3xl font-semibold tabular-nums">0</dd>
              </div>
            ))}
          </dl>

          {/* next interview line */}
          <p className="mt-5 flex items-center gap-2 border-t border-border pt-4 text-sm text-muted">
            <CalendarClock className="size-4" aria-hidden />
            Next interview: No upcoming interview
          </p>
        </section>
      </div>
    </div>
  );
}
