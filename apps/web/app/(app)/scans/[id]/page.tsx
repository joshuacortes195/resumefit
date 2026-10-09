import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Report } from "@/components/report/report";
import { ReportSkeleton } from "@/components/ui/skeleton";
import { getCurrentUser } from "@/lib/auth";
import { listResumes } from "@/lib/data/resumes";
import { getScan, previousScan } from "@/lib/data/scans";
import { toReportData } from "@/lib/report-data";

export const metadata = { title: "Match report" };

// the match report for one saved scan
export default function ScanPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<ReportSkeleton />}>
      <ScanReport params={params} />
    </Suspense>
  );
}

// loads the scan and hands it to the report
async function ScanReport({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  const scan = await getScan(user.id, id);
  if (!scan) notFound();

  const [previous, resumes] = await Promise.all([previousScan(user.id, scan), listResumes(user.id)]);
  // the key gives each scan a fresh report, so an open pop up does not carry over to the next one
  return <Report key={scan.id} data={toReportData(scan, previous)} resumes={resumes.map(({ id, name, isBase }) => ({ id, name, isBase }))} />;
}
