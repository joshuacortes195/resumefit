import { Suspense } from "react";
import { ScanFormLoader } from "@/components/scan/scan-form-loader";
import { CARD } from "@/components/ui/buttons";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata = { title: "New Scan" };

// new scan page, add a resume and a job description and get the report
export default function NewScanPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-3xl font-semibold">New Scan</h1>
      <p className="mt-1 mb-6 text-muted">Add your resume and a job description to see your match rate and what to fix.</p>
      <div className={`${CARD} p-6`}>
        <Suspense fallback={<Skeleton className="h-80" />}>
          <ScanFormLoader />
        </Suspense>
      </div>
    </div>
  );
}
