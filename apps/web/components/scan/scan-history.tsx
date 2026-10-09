"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Archive, ArchiveRestore, ChevronLeft, ChevronRight, History, Search, Trash2 } from "lucide-react";
import { archiveScans, removeScans, setScanStatus, trackScan, type ActionResult } from "@/app/actions/scans";
import { ScoreRing } from "@/components/score-ring";
import { CARD, INPUT, LINK_BUTTON, PRIMARY_BUTTON, SECONDARY_BUTTON } from "@/components/ui/buttons";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusSelect } from "@/components/ui/status-select";
import type { ScanListItem } from "@/lib/data/scans";
import { localToday } from "@/lib/job-tabs";

type ScanHistoryProps = {
  items: ScanListItem[];
  total: number;
  page: number;
  pageSize: number;
  search: string;
  sort: "date" | "score" | "company";
  archived: boolean;
};

// short date like "Oct 8, 2026"
const DATE = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });

// the scan history table with search, sort, paging and bulk actions
export function ScanHistory({ items, total, page, pageSize, search, sort, archived }: ScanHistoryProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState(search);
  const [selected, setSelected] = useState<string[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // changes the filters by rewriting the address, so a view can be bookmarked
  function go(changes: Record<string, string | null>) {
    const params = new URLSearchParams();
    const next = { q: query, sort: sort === "date" ? null : sort, archived: archived ? "1" : null, page: null, ...changes };
    for (const [key, value] of Object.entries(next)) if (value) params.set(key, value);
    router.replace(`${pathname}${params.size > 0 ? `?${params}` : ""}`);
  }

  // searches a moment after typing stops
  useEffect(() => {
    if (query === search) return;
    const timer = setTimeout(() => go({ q: query || null }), 350);
    return () => clearTimeout(timer);
    // only the typed text should restart the timer
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  // runs an action and clears the checkboxes when it works
  function run(action: () => Promise<ActionResult>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        setSelected([]);
        setConfirming(false);
      } else setError(result.error);
    });
  }

  const allSelected = items.length > 0 && selected.length === items.length;
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(total, page * pageSize);
  const filtered = search !== "" || archived;

  return (
    <div className="space-y-4">
      {/* search, sort and the archived switch */}
      <div className="flex flex-wrap items-center gap-3">
        <label className="relative min-w-52 flex-1">
          <span className="sr-only">Search scans</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by company, title or job description" className={`${INPUT} bg-surface pl-9`} />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted">Sort by</span>
          <select value={sort} onChange={(event) => go({ sort: event.target.value === "date" ? null : event.target.value })} className={`${INPUT} w-auto bg-surface`}>
            <option value="date">Scan date</option>
            <option value="score">Score</option>
            <option value="company">Company</option>
          </select>
        </label>
        <button type="button" aria-pressed={archived} onClick={() => go({ archived: archived ? null : "1" })} className={`${SECONDARY_BUTTON} py-2 ${archived ? "border-primary bg-primary-soft text-primary" : ""}`}>
          <Archive className="size-4" aria-hidden />
          Archived
        </button>
      </div>

      {/* shows up when rows are ticked */}
      {selected.length > 0 && (
        <div className="flex animate-rise flex-wrap items-center gap-3 rounded-xl bg-primary-soft px-4 py-2.5 text-sm">
          <span className="font-medium">{selected.length} selected</span>
          <button type="button" disabled={pending} onClick={() => run(() => archiveScans(selected, !archived))} className={LINK_BUTTON}>
            {archived ? "Restore" : "Archive"}
          </button>
          <button type="button" disabled={pending} onClick={() => setConfirming(true)} className="inline-flex items-center gap-1 font-semibold text-danger hover:underline">
            <Trash2 className="size-3.5" aria-hidden />
            Delete
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      {items.length === 0 ? (
        filtered ? (
          <EmptyState icon={Search} title={archived ? "Nothing archived" : "No scans match that search"} text={archived ? "Scans you archive show up here." : "Try a company name, a job title or a word from the job description."} />
        ) : (
          <EmptyState icon={History} title="No scans yet" text="Every scan you run is saved here with its score, so you can pick up where you left off.">
            <Link href="/scans/new" className={PRIMARY_BUTTON}>
              Run your first scan
            </Link>
          </EmptyState>
        )
      ) : (
        <div className={`${CARD} overflow-x-auto`}>
          <table className="w-full min-w-[52rem] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th className="w-10 py-3 pl-4">
                  <input type="checkbox" aria-label="Select all scans on this page" checked={allSelected} onChange={() => setSelected(allSelected ? [] : items.map((item) => item.id))} className="size-4 accent-(--primary)" />
                </th>
                <th className="py-3 font-medium">Score</th>
                <th className="py-3 font-medium">Company and job title</th>
                <th className="py-3 font-medium">Job description</th>
                <th className="py-3 font-medium">Status</th>
                <th className="py-3 font-medium">Scan date</th>
                <th className="py-3 font-medium">Job tracker</th>
                <th className="py-3 pr-4 text-right font-medium">Archive</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-border transition-colors duration-150 last:border-0 hover:bg-background/60">
                  <td className="py-3 pl-4">
                    <input
                      type="checkbox"
                      aria-label={`Select ${item.jobTitle ?? "scan"}`}
                      checked={selected.includes(item.id)}
                      onChange={() => setSelected((current) => (current.includes(item.id) ? current.filter((id) => id !== item.id) : [...current, item.id]))}
                      className="size-4 accent-(--primary)"
                    />
                  </td>
                  <td className="py-3">
                    <ScoreRing score={item.matchRate} size="sm" />
                  </td>
                  <td className="max-w-56 py-3 pr-4">
                    <Link href={`/scans/${item.id}`} className="block truncate font-semibold hover:text-primary">
                      {item.jobTitle ?? "Untitled scan"}
                    </Link>
                    <span className="block truncate text-muted">{item.company ?? "Company not set"}</span>
                  </td>
                  <td className="max-w-64 py-3 pr-4">
                    <span className="line-clamp-2 text-muted">{item.snippet}</span>
                  </td>
                  <td className="py-3 pr-4">
                    <StatusSelect label={`Status of ${item.jobTitle ?? "this job"}`} value={item.jobStatus} disabled={pending} onChange={(status) => run(() => setScanStatus(item.id, status, localToday()))} />
                  </td>
                  <td className="whitespace-nowrap py-3 pr-4 text-muted">{DATE.format(new Date(item.createdAt))}</td>
                  <td className="py-3 pr-4">
                    {item.jobId ? (
                      <Link href={`/tracker/${item.jobId}/job`} className={LINK_BUTTON}>
                        Tracked
                      </Link>
                    ) : (
                      <button type="button" disabled={pending} onClick={() => run(() => trackScan(item.id))} className={`${SECONDARY_BUTTON} px-3 py-1.5`}>
                        Track
                      </button>
                    )}
                  </td>
                  <td className="py-3 pr-4 text-right">
                    <button
                      type="button"
                      disabled={pending}
                      aria-label={archived ? `Restore ${item.jobTitle ?? "scan"}` : `Archive ${item.jobTitle ?? "scan"}`}
                      onClick={() => run(() => archiveScans([item.id], !archived))}
                      className="rounded-lg p-2 text-muted hover:bg-primary-soft hover:text-foreground"
                    >
                      {archived ? <ArchiveRestore className="size-4" aria-hidden /> : <Archive className="size-4" aria-hidden />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* paging */}
      {total > 0 && (
        <div className="flex items-center justify-between text-sm text-muted">
          <p>
            Showing {first}-{last} of {total}
          </p>
          <div className="flex gap-1">
            <button type="button" aria-label="Previous page" disabled={page <= 1} onClick={() => go({ page: page - 1 > 1 ? String(page - 1) : null })} className="rounded-lg p-2 hover:bg-primary-soft disabled:opacity-40">
              <ChevronLeft className="size-4" aria-hidden />
            </button>
            <button type="button" aria-label="Next page" disabled={last >= total} onClick={() => go({ page: String(page + 1) })} className="rounded-lg p-2 hover:bg-primary-soft disabled:opacity-40">
              <ChevronRight className="size-4" aria-hidden />
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirming}
        title={`Delete ${selected.length} ${selected.length === 1 ? "scan" : "scans"}?`}
        message="This removes the reports for good. Your resumes and tracked jobs stay where they are."
        confirmLabel="Delete"
        pending={pending}
        onConfirm={() => run(() => removeScans(selected))}
        onClose={() => setConfirming(false)}
      />
      <span className="sr-only" aria-live="polite">
        {pending ? "Saving" : ""}
      </span>
    </div>
  );
}
