import { Suspense } from "react";
import { BoardLoader } from "@/components/tracker/board-loader";
import { Skeleton } from "@/components/ui/skeleton";

// the board shows on every tracker page, a job's card opens on top of it
export default function TrackerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <h1 className="text-3xl font-semibold">Application Tracker</h1>
      <p className="mt-1 mb-6 text-muted">Drag jobs from Saved to Offer and keep notes on each one.</p>
      <Suspense
        fallback={
          <div className="flex gap-3" role="status" aria-label="Loading the board">
            {Array.from({ length: 5 }, (_, index) => (
              <Skeleton key={index} className="h-72 flex-1" />
            ))}
          </div>
        }
      >
        <BoardLoader />
      </Suspense>
      {children}
    </div>
  );
}
