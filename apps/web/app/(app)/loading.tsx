import { Skeleton } from "@/components/ui/skeleton";

// shown the moment a menu link is clicked, while the page's own data is on its way
export default function AppLoading() {
  return (
    <div className="mx-auto max-w-5xl space-y-6" role="status" aria-label="Loading">
      <Skeleton className="h-9 w-72 max-w-full" />
      <Skeleton className="h-64" />
      <Skeleton className="h-40" />
    </div>
  );
}
