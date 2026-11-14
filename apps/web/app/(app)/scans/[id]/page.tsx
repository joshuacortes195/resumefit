import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Report } from "@/components/report/report";
import { ReportSkeleton } from "@/components/ui/skeleton";
import { getCurrentUser } from "@/lib/auth";
import { listResumes } from "@/lib/data/resumes";
import { getScan, previousScan, type SavedScan } from "@/lib/data/scans";
import { getProfile } from "@/lib/data/profile";
import { toReportData } from "@/lib/report-data";

export const metadata = { title: "Match report" };

// the match report for one saved scan
export default async function ScanPage({ params }: { params: Promise<{ id: string }> }) {
  // looked up before anything is sent, so a scan that is not there answers with a real 404 and the not found page
  const { id } = await params;
  const user = await getCurrentUser();
  const scan = await getScan(user.id, id);
  if (!scan) notFound();
  return (
    <Suspense fallback={<ReportSkeleton />}>
      <ScanReport userId={user.id} scan={scan} />
    </Suspense>
  );
}

// loads the rest and hands it to the report
async function ScanReport({ userId, scan }: { userId: string; scan: SavedScan }) {
  // the profile is what the posting's rules about who can apply are checked against
  const [previous, resumes, profile] = await Promise.all([previousScan(userId, scan), listResumes(userId), getProfile(userId)]);
  // the key gives each scan a fresh report, so an open pop up does not carry over to the next one
  return <Report key={scan.id} data={toReportData(scan, previous, profile)} resumes={resumes.map(({ id, name, isBase }) => ({ id, name, isBase }))} />;
}
