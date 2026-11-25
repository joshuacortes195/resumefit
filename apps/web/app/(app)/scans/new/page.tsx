import { Suspense } from "react";
import { DrawingPanel, InspectDrawing } from "@/components/app-drawings";
import { ScanFormLoader } from "@/components/scan/scan-form-loader";
import { CARD } from "@/components/ui/buttons";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata = { title: "New Scan" };

// new scan page, add a resume and a job description and get the report
export default function NewScanPage({ searchParams }: { searchParams: Promise<{ job?: string }> }) {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* the title beside a drawing of a scan running down a page */}
      <DrawingPanel drawing={<InspectDrawing />}>
        <h1 className="text-3xl font-semibold sm:text-4xl">New Scan</h1>
        <p className="mt-2 max-w-md text-[var(--bp-muted)]">Add your resume and a job description to see your match rate and what to fix.</p>
      </DrawingPanel>
      <div className={`${CARD} p-6`}>
        <Suspense fallback={<Skeleton className="h-80" />}>
          <ScanFormLoader searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}
