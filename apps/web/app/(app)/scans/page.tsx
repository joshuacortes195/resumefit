import { Suspense } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { ScanHistory } from "@/components/scan/scan-history";
import { PRIMARY_BUTTON } from "@/components/ui/buttons";
import { TableSkeleton } from "@/components/ui/skeleton";
import { getCurrentUser } from "@/lib/auth";
import { listScans } from "@/lib/data/scans";

export const metadata = { title: "Scan History" };

type SearchParams = Promise<{ q?: string; sort?: string; archived?: string; page?: string }>;

// rows per page in the history table
const PAGE_SIZE = 10;

// every scan you've run, with search, sort and archive
export default function ScanHistoryPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Scan History</h1>
          <p className="mt-1 text-muted">All your past scans and where each job stands.</p>
        </div>
        <Link href="/scans/new" className={PRIMARY_BUTTON}>
          <Plus className="size-4" aria-hidden />
          New Scan
        </Link>
      </div>
      <Suspense fallback={<TableSkeleton />}>
        <HistoryTable searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

// loads one page of scans for the filters in the address
async function HistoryTable({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const user = await getCurrentUser();
  const sort = params.sort === "score" || params.sort === "company" ? params.sort : "date";
  const archived = params.archived === "1";
  const page = Math.max(1, Number(params.page) || 1);
  const search = params.q ?? "";

  const { items, total } = await listScans(user.id, { search, sort, archived, page, pageSize: PAGE_SIZE });
  // the key clears the ticked rows when the sort, view or page changes
  return <ScanHistory key={`${sort}|${archived}|${page}`} items={items} total={total} page={page} pageSize={PAGE_SIZE} search={search} sort={sort} archived={archived} />;
}
