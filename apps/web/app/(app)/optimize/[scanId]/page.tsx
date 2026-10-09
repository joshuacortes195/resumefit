import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Workspace } from "@/components/optimize/workspace";
import { ReportSkeleton } from "@/components/ui/skeleton";
import { remainingToday } from "@/lib/ai/limits";
import { aiAvailable } from "@/lib/ai/router";
import { getCurrentUser } from "@/lib/auth";
import { latestOptimization } from "@/lib/data/optimizations";
import { cachedHints, getDictionary, getScan } from "@/lib/data/scans";

export const metadata = { title: "AI Optimize" };

// the optimize workspace for one scan
export default function OptimizePage({ params }: { params: Promise<{ scanId: string }> }) {
  return (
    <Suspense fallback={<ReportSkeleton />}>
      <WorkspaceLoader params={params} />
    </Suspense>
  );
}

// loads the scan and everything needed to rescore it in the browser
async function WorkspaceLoader({ params }: { params: Promise<{ scanId: string }> }) {
  const { scanId } = await params;
  const user = await getCurrentUser();
  const scan = await getScan(user.id, scanId);
  if (!scan) notFound();

  const [saved, dictionary, hints, available, remaining, bulletsRemaining] = await Promise.all([
    latestOptimization(user.id, scan.id),
    getDictionary(user.id),
    cachedHints(scan.jdHash),
    aiAvailable(user.id),
    remainingToday(user.id, "optimize"),
    remainingToday(user.id, "bullets"),
  ]);

  return (
    <Workspace
      key={scan.id}
      scan={{
        id: scan.id,
        jobTitle: scan.jobTitle,
        company: scan.company,
        jdText: scan.jdText,
        resumeText: scan.resumeTextSnapshot,
        targetTitle: scan.jobTitleOverride,
        educationOverride: scan.educationOverride,
        customSkills: scan.customSkills,
        dictionary,
        hints,
        layout: scan.layoutMeta,
        createdAt: scan.createdAt.toISOString(),
        jobId: scan.jobId,
      }}
      saved={saved ? { id: saved.id, suggestions: saved.suggestions } : null}
      ai={{ available, remaining, bulletsRemaining }}
    />
  );
}
