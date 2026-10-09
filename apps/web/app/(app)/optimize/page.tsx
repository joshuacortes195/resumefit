import { Suspense } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { ScanFormLoader } from "@/components/scan/scan-form-loader";
import { ScoreRing } from "@/components/score-ring";
import { CARD, SECONDARY_BUTTON } from "@/components/ui/buttons";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUser } from "@/lib/auth";
import { listScans } from "@/lib/data/scans";

export const metadata = { title: "AI Optimize" };

// where optimizing starts: pick a scan you already ran, or run a new one
export default function OptimizeHomePage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-3xl font-semibold sm:text-4xl">Tailor your resume without starting over</h1>
        <p className="mt-2 max-w-2xl text-muted">
          Get rewrites for the lines that matter for one job, accept the ones that are true for you, and watch your match rate move as you go. Nothing is added to your resume unless you say so.
        </p>
      </div>

      <section className={`${CARD} p-6`}>
        <h2 className="mb-4 text-lg font-semibold">Start from a new scan</h2>
        <Suspense fallback={<Skeleton className="h-80" />}>
          <ScanFormLoader next="optimize" />
        </Suspense>
      </section>

      <section className={`${CARD} p-6`}>
        <h2 className="text-lg font-semibold">Or pick a recent scan</h2>
        <Suspense fallback={<Skeleton className="mt-4 h-32" />}>
          <RecentScans />
        </Suspense>
      </section>
    </div>
  );
}

// the last few scans, each with a button into the workspace
async function RecentScans() {
  const user = await getCurrentUser();
  const { items } = await listScans(user.id, { pageSize: 6 });
  if (items.length === 0) return <p className="mt-3 text-sm text-muted">You have not run a scan yet. Use the form above and you will land in the workspace when it finishes.</p>;
  return (
    <ul className="mt-4 divide-y divide-border">
      {items.map((scan) => (
        <li key={scan.id} className="flex items-center gap-4 py-3">
          <ScoreRing score={scan.matchRate} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{scan.jobTitle ?? "Untitled scan"}</p>
            <p className="truncate text-sm text-muted">{scan.company ?? "Company not set"}</p>
          </div>
          <Link href={`/optimize/${scan.id}`} className={`${SECONDARY_BUTTON} px-3 py-1.5`}>
            <Sparkles className="size-4" aria-hidden />
            Optimize
          </Link>
        </li>
      ))}
    </ul>
  );
}
