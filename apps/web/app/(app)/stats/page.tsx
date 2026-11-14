import { Suspense } from "react";
import Link from "next/link";
import { BarChart3 } from "lucide-react";
import { FollowUps } from "@/components/follow-ups";
import { CARD, SECONDARY_BUTTON } from "@/components/ui/buttons";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUser } from "@/lib/auth";
import { statJobs } from "@/lib/data/jobs";
import { summarize, type StatRow } from "@/lib/stats";

export const metadata = { title: "Results" };

// what the tracker adds up to: how many applications went out, how many came back, and which scores and resumes got the answers
export default function StatsPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-3xl font-semibold">Results</h1>
      <p className="mt-1 mb-6 max-w-2xl text-muted">What your applications add up to, worked out from your tracker. It shows which match scores and which resumes are getting you interviews.</p>
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Numbers />
      </Suspense>
    </div>
  );
}

// one headline number
function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className={`${CARD} p-4`}>
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

// a table of how each group of applications did
function Breakdown({ title, hint, first, rows }: { title: string; hint: string; first: string; rows: StatRow[] }) {
  return (
    <section className={`${CARD} p-5`}>
      <h2 className="font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-muted">{hint}</p>
      <table className="mt-3 w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border text-muted">
            <th scope="col" className="py-2 font-medium">{first}</th>
            <th scope="col" className="py-2 text-right font-medium">Sent</th>
            <th scope="col" className="py-2 text-right font-medium">Interviews</th>
            <th scope="col" className="py-2 text-right font-medium">Rate</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-b border-border last:border-0">
              <th scope="row" className="break-words py-2 pr-2 font-normal">{row.label}</th>
              <td className="py-2 text-right tabular-nums">{row.applied}</td>
              <td className="py-2 text-right tabular-nums">{row.interviews}</td>
              <td className="py-2 text-right tabular-nums">{row.rate === null ? "" : `${row.rate}%`}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

// the numbers themselves
async function Numbers() {
  const user = await getCurrentUser();
  const stats = summarize(await statJobs(user.id));

  if (stats.applied === 0) {
    return (
      <EmptyState icon={BarChart3} title="Nothing to count yet" text="Once a job on your tracker moves to Applied, this page starts adding things up.">
        <Link href="/tracker" className={SECONDARY_BUTTON}>
          Open the tracker
        </Link>
      </EmptyState>
    );
  }

  // the tallest week sets the scale of the bars
  const most = Math.max(1, ...stats.weeks.map((week) => week.count));
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Figure label="Applications sent" value={String(stats.applied)} />
        <Figure label="Interviews and offers" value={String(stats.interviews + stats.offers)} />
        <Figure label="Response rate" value={stats.responseRate === null ? "" : `${stats.responseRate}%`} />
        <Figure label="Still waiting" value={String(stats.waiting)} />
      </div>

      <FollowUps jobs={stats.followUps} name={user.name} />

      {/* one bar per week, with the count written out so nothing depends on reading the bar */}
      <section className={`${CARD} p-5`}>
        <h2 className="font-semibold">Applications per week</h2>
        <ol className="mt-4 flex items-end gap-2" aria-label="Applications sent in each of the last eight weeks">
          {stats.weeks.map((week) => (
            <li key={week.start} className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <span className="text-xs tabular-nums">{week.count}</span>
              <span aria-hidden className="w-full rounded-t bg-primary" style={{ height: `${Math.max(2, (week.count / most) * 96)}px`, opacity: week.count === 0 ? 0.25 : 1 }} />
              <span className="truncate text-xs text-muted">{week.start.slice(5).replace("-", "/")}</span>
            </li>
          ))}
        </ol>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Breakdown title="By match score" hint="Whether a higher score at the time you applied really leads to more interviews." first="Score" rows={stats.byScore} />
        <Breakdown title="By resume" hint="Which version of your resume is getting the answers." first="Resume" rows={stats.byResume} />
      </div>
      <p className="text-sm text-muted">An interview or an offer counts as a response. With only a few applications these rates swing a lot, so read them as a hint, not a verdict.</p>
    </div>
  );
}
