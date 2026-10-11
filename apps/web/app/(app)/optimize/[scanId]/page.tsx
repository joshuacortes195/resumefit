import { Suspense } from "react";
import { notFound } from "next/navigation";
import { countSkills, type SkillTerm } from "@resumefit/scoring";
import { HARD_SKILLS, SOFT_SKILLS } from "@resumefit/skills-data";
import { Workspace } from "@/components/optimize/workspace";
import { ReportSkeleton } from "@/components/ui/skeleton";
import { remainingToday } from "@/lib/ai/limits";
import { aiAvailable } from "@/lib/ai/router";
import { getCurrentUser, type CurrentUser } from "@/lib/auth";
import { latestOptimization } from "@/lib/data/optimizations";
import { cachedHints, getDictionary, getScan, type SavedScan } from "@/lib/data/scans";

export const metadata = { title: "AI Optimize" };

// the optimize workspace for one scan
export default async function OptimizePage({ params }: { params: Promise<{ scanId: string }> }) {
  // looked up before anything is sent, so a scan that is not there answers with a real 404 and the not found page
  const { scanId } = await params;
  const user = await getCurrentUser();
  const scan = await getScan(user.id, scanId);
  if (!scan) notFound();
  return (
    <Suspense fallback={<ReportSkeleton />}>
      <WorkspaceLoader user={user} scan={scan} />
    </Suspense>
  );
}

// the skills this job description mentions, which is all the browser needs to rescore the resume
function jobSkills(jdText: string, dictionary: { name: string; category: "hard" | "soft" }[]) {
  const own = (category: "hard" | "soft") => dictionary.filter((skill) => skill.category === category).map((skill) => ({ name: skill.name }));
  const mentioned = (skills: SkillTerm[]) => {
    const names = new Set(countSkills(jdText, skills).keys());
    return skills.filter((skill) => names.has(skill.name));
  };
  return { hard: mentioned([...HARD_SKILLS, ...own("hard")]), soft: mentioned([...SOFT_SKILLS, ...own("soft")]) };
}

// loads the scan and everything needed to rescore it in the browser
async function WorkspaceLoader({ user, scan }: { user: CurrentUser; scan: SavedScan }) {
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
        skills: jobSkills(scan.jdText, dictionary),
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
