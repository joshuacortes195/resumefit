// grey blocks that stand in for a page while its data loads
export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded-lg bg-border/70 ${className}`} />;
}

// stand in for the report page
export function ReportSkeleton() {
  return (
    <div className="mx-auto max-w-6xl" role="status" aria-label="Loading report">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="mt-3 h-9 w-80 max-w-full" />
      <div className="mt-6 grid gap-6 lg:grid-cols-[17rem_1fr]">
        <Skeleton className="h-96" />
        <div className="space-y-6">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    </div>
  );
}

// stand in for a card with a table in it
export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Loading" className="space-y-3 rounded-2xl border border-border bg-surface p-6">
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="h-10" />
      ))}
    </div>
  );
}
