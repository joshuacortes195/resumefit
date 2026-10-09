import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight, Briefcase, CalendarClock, Check, Minus, UserSearch, X } from "lucide-react";
import { JOB_STATUSES } from "@resumefit/shared";
import { PromoBanner } from "@/components/promo-banner";
import { ScanFormLoader } from "@/components/scan/scan-form-loader";
import { ScoreRing } from "@/components/score-ring";
import { CARD, LINK_BUTTON } from "@/components/ui/buttons";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUser } from "@/lib/auth";
import { getCoverLetter, jobCounts, nextInterview } from "@/lib/data/jobs";
import { listLinkedinReports } from "@/lib/data/practice";
import { latestScan } from "@/lib/data/scans";

export const metadata = { title: "Dashboard" };

// tracker columns shown as counters on the dashboard
const TRACKER_COUNTS = JOB_STATUSES.filter((status) => status !== "rejected");

// date and time for the next interview line
const WHEN = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

// home page after sign in
export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PromoBanner />

      <div>
        <h1 className="text-3xl font-semibold sm:text-4xl">Welcome to ResumeFit</h1>
        <p className="mt-2 max-w-xl text-muted">See how well your resume fits a job, fix what is missing and keep every application in one place.</p>
      </div>

      {/* the scan form, right on the dashboard */}
      <section className={`${CARD} p-6`}>
        <h2 className="mb-4 text-lg font-semibold">New scan</h2>
        <Suspense fallback={<Skeleton className="h-80" />}>
          <ScanFormLoader />
        </Suspense>
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <section className={`${CARD} p-6`}>
          <h2 className="font-semibold">Latest resume scan</h2>
          <Suspense fallback={<Skeleton className="mt-4 h-24" />}>
            <LatestScan />
          </Suspense>
        </section>

        {/* linkedin card */}
        <section className={`${CARD} p-6`}>
          <h2 className="font-semibold">LinkedIn report</h2>
          <Suspense fallback={<Skeleton className="mt-4 h-16" />}>
            <LinkedinCard />
          </Suspense>
        </section>

        {/* tracker counts card */}
        <section className={`${CARD} p-6 md:col-span-2`}>
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-semibold">
              <Briefcase className="size-4 text-muted" aria-hidden />
              Job tracker
            </h2>
            {/* the arrow nudges over on hover */}
            <Link href="/tracker" className={`group inline-flex items-center gap-1 text-sm ${LINK_BUTTON}`}>
              Open tracker
              <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
            </Link>
          </div>
          <Suspense fallback={<Skeleton className="mt-5 h-24" />}>
            <TrackerSummary />
          </Suspense>
        </section>
      </div>
    </div>
  );
}

// one chip on the latest scan card: done, needs work, or not started
function Chip({ label, state }: { label: string; state: "good" | "bad" | "none" }) {
  const look = state === "good" ? "text-success" : state === "bad" ? "text-danger" : "text-muted";
  const Icon = state === "good" ? Check : state === "bad" ? X : Minus;
  return (
    <li className="flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs font-medium">
      <Icon className={`size-3.5 ${look}`} aria-hidden />
      {label}
      <span className="sr-only">{state === "good" ? ", looks good" : state === "bad" ? ", needs work" : ", not done yet"}</span>
    </li>
  );
}

// the most recent scan with its score and checklist
async function LatestScan() {
  const user = await getCurrentUser();
  const scan = await latestScan(user.id);
  if (!scan) {
    return (
      <div className="mt-4 flex items-center gap-4">
        <ScoreRing score={0} />
        <p className="text-sm text-muted">No scans yet. Your most recent match rate and checklist will show up here.</p>
      </div>
    );
  }

  const { issuesToFix } = scan.report;
  // the cover letter chip turns green once the job this scan belongs to has one
  const letter = scan.jobId ? await getCoverLetter(user.id, scan.jobId) : null;
  const clean = (issues: number) => (issues === 0 ? "good" : "bad");
  return (
    <Link href={`/scans/${scan.id}`} className="group mt-4 block">
      <div className="flex items-center gap-4">
        <ScoreRing score={scan.matchRate} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium group-hover:text-primary">{scan.jobTitle ?? "Untitled scan"}</p>
          <p className="truncate text-sm text-muted">{scan.company ?? "Company not set"}</p>
        </div>
        <ArrowRight className="size-4 shrink-0 text-muted transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
      </div>
      {/* quick checklist of the report's parts */}
      <ul className="mt-4 flex flex-wrap gap-1.5">
        <Chip label="Searchability" state={clean(issuesToFix.searchability)} />
        <Chip label="Formatting" state={clean(issuesToFix.formatting)} />
        <Chip label="Skills match" state={clean(issuesToFix.hardSkills + issuesToFix.softSkills)} />
        <Chip label="Cover letter" state={letter?.content.trim() ? "good" : "none"} />
        <Chip label="Recruiter tips" state={clean(issuesToFix.recruiterTips)} />
      </ul>
    </Link>
  );
}

// the latest linkedin score, or a nudge to get one
async function LinkedinCard() {
  const user = await getCurrentUser();
  const [latest] = await listLinkedinReports(user.id);
  return (
    <>
      {latest ? (
        <Link href={`/linkedin/${latest.id}`} className="group mt-4 flex items-center gap-4">
          <ScoreRing score={latest.score} label="LinkedIn score" />
          <span className="min-w-0 flex-1 truncate text-sm text-muted group-hover:text-foreground">{latest.headline || "Your latest profile report"}</span>
        </Link>
      ) : (
        <p className="mt-4 text-sm text-muted">Score your profile against the jobs you want and see which keywords are missing.</p>
      )}
      <Link href="/linkedin" className={`mt-4 inline-flex items-center gap-2 text-sm ${LINK_BUTTON}`}>
        <UserSearch className="size-4" aria-hidden />
        Optimize LinkedIn
      </Link>
    </>
  );
}

// counts per tracker column and the next interview
async function TrackerSummary() {
  const user = await getCurrentUser();
  const [counts, interview] = await Promise.all([jobCounts(user.id), nextInterview(user.id)]);
  return (
    <>
      {/* one counter per column, split by thin lines */}
      <dl className="mt-5 grid grid-cols-2 gap-y-4 sm:grid-cols-4 sm:divide-x sm:divide-border">
        {TRACKER_COUNTS.map((status) => (
          <div key={status} className="sm:px-5 sm:first:pl-0">
            <dt className="text-sm capitalize text-muted">{status}</dt>
            <dd className="mt-1 font-display text-3xl font-semibold tabular-nums">{counts[status]}</dd>
          </div>
        ))}
      </dl>

      {/* next interview line */}
      <p className="mt-5 flex items-center gap-2 border-t border-border pt-4 text-sm text-muted">
        <CalendarClock className="size-4" aria-hidden />
        {interview ? (
          <span>
            Next interview:{" "}
            <Link href={`/tracker/${interview.jobId}/interviews`} className="font-medium text-foreground hover:text-primary">
              {interview.jobTitle}
              {interview.company ? ` at ${interview.company}` : ""}, {WHEN.format(interview.datetime)}
            </Link>
          </span>
        ) : (
          "Next interview: No upcoming interview"
        )}
      </p>
    </>
  );
}
