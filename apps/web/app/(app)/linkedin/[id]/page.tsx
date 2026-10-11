import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LinkedinReportView } from "@/components/linkedin-report";
import { LINK_BUTTON } from "@/components/ui/buttons";
import { ReportSkeleton } from "@/components/ui/skeleton";
import { remainingToday } from "@/lib/ai/limits";
import { aiAvailable } from "@/lib/ai/router";
import { getCurrentUser } from "@/lib/auth";
import { getLinkedinReport } from "@/lib/data/practice";

export const metadata = { title: "LinkedIn report" };

// one saved linkedin report
export default async function LinkedinReportPage({ params }: { params: Promise<{ id: string }> }) {
  // looked up before anything is sent, so a report that is not there answers with a real 404 and the not found page
  const { id } = await params;
  const user = await getCurrentUser();
  const saved = await getLinkedinReport(user.id, id);
  if (!saved) notFound();
  return (
    <div className="mx-auto max-w-4xl">
      <p className="text-sm">
        <Link href="/linkedin" className={LINK_BUTTON}>
          LinkedIn Optimizer
        </Link>
      </p>
      <h1 className="mt-1 mb-6 text-3xl font-semibold">LinkedIn report</h1>
      <Suspense fallback={<ReportSkeleton />}>
        <ReportLoader userId={user.id} saved={saved} />
      </Suspense>
    </div>
  );
}

async function ReportLoader({ userId, saved }: { userId: string; saved: NonNullable<Awaited<ReturnType<typeof getLinkedinReport>>> }) {
  const [available, remaining] = await Promise.all([aiAvailable(userId), remainingToday(userId, "linkedin")]);
  return <LinkedinReportView id={saved.id} score={saved.score} report={saved.report} ai={{ available, remaining }} />;
}
