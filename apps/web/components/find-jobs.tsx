"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Briefcase, ExternalLink, ScanSearch, Search, Zap } from "lucide-react";
import { findJobs, readJob, saveFoundJob } from "@/app/actions/find-jobs";
import { CARD, INPUT, PRIMARY_BUTTON, SECONDARY_BUTTON } from "@/components/ui/buttons";
import { EmptyState } from "@/components/ui/empty-state";
import type { JobResult } from "@/lib/jobs-feed";

// how long ago an opening was posted
function age(iso: string | null): string {
  if (!iso) return "";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return days < 1 ? "Posted today" : days === 1 ? "Posted yesterday" : days < 31 ? `Posted ${days} days ago` : "Posted over a month ago";
}

// the words on the match badge
const badge = (match: number | null) => (match === null ? null : match >= 70 ? "Top match" : match >= 45 ? "Good match" : null);

// search the public job boards and act on what you find
export function FindJobs({ hasResume }: { hasResume: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<"resume" | "keyword">(hasResume ? "resume" : "keyword");
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [days, setDays] = useState("");
  const [sort, setSort] = useState<"relevance" | "date">("relevance");
  const [results, setResults] = useState<JobResult[] | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [selected, setSelected] = useState<JobResult | null>(null);
  const [description, setDescription] = useState<string | null>(null);
  const [saved, setSaved] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // runs the search
  function search(event?: React.FormEvent) {
    event?.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await findJobs({ query, location, remoteOnly, days: days ? (Number(days) as 1 | 7 | 30) : null, sort, useResume: mode === "resume" });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setResults(result.jobs);
      setSelected(null);
      setDescription(null);
      setSummary(`${result.jobs.length} shown, from ${result.total.toLocaleString("en-US")} open jobs${result.resumeName ? `, ranked against ${result.resumeName}` : ""}.`);
    });
  }

  // opens one result in the detail pane and loads its description
  function open(job: JobResult) {
    setSelected(job);
    setDescription(null);
    setError(null);
    startTransition(async () => {
      const result = await readJob(job.id);
      if (result.ok) setDescription(result.description);
      else setError(result.error);
    });
  }

  // saves the job to the tracker, then goes on to wherever the button was pointing
  async function save(job: JobResult, then?: "scan" | "apply") {
    setBusy(then ?? "save");
    setError(null);
    const known = saved[job.id];
    const result = known ? { ok: true as const, jobId: known } : await saveFoundJob(job.id);
    setBusy(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSaved((all) => ({ ...all, [job.id]: result.jobId }));
    if (then === "scan") router.push(`/scans/new?job=${result.jobId}`);
    if (then === "apply") router.push("/auto-apply");
  }

  return (
    <div className="space-y-5">
      <form onSubmit={search} className={`${CARD} space-y-4 p-5`}>
        {/* two ways to search */}
        <div role="tablist" aria-label="How to search" className="flex w-fit gap-1 rounded-lg bg-background p-1 text-sm font-medium">
          {(
            [
              ["resume", "Use my resume"],
              ["keyword", "Search by keyword"],
            ] as const
          ).map(([key, label]) => (
            <button key={key} type="button" role="tab" aria-selected={mode === key} disabled={key === "resume" && !hasResume} onClick={() => setMode(key)} className={`rounded-md px-3 py-1.5 transition-colors duration-150 disabled:opacity-50 ${mode === key ? "bg-surface text-foreground shadow-sm" : "text-muted hover:text-foreground"}`}>
              {label}
            </button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm font-medium lg:col-span-2">
            {mode === "resume" ? "Narrow it down (optional)" : "Job title or company"}
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Data analyst" className={`${INPUT} mt-1 font-normal`} />
          </label>
          <label className="text-sm font-medium">
            Location
            <input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="City or country" className={`${INPUT} mt-1 font-normal`} />
          </label>
          <label className="text-sm font-medium">
            Posted
            <select value={days} onChange={(event) => setDays(event.target.value)} className={`${INPUT} mt-1 font-normal`}>
              <option value="">Any time</option>
              <option value="1">Last 24 hours</option>
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
            </select>
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={remoteOnly} onChange={(event) => setRemoteOnly(event.target.checked)} className="size-4 accent-(--primary)" />
            Remote only
          </label>
          <label className="flex items-center gap-2 text-sm">
            Sort by
            <select value={sort} onChange={(event) => setSort(event.target.value as "relevance" | "date")} className={`${INPUT} w-auto`}>
              <option value="relevance">{mode === "resume" ? "Best match" : "Relevance"}</option>
              <option value="date">Newest</option>
            </select>
          </label>
          <button type="submit" disabled={pending} className={`${PRIMARY_BUTTON} ml-auto`}>
            <Search className="size-4" aria-hidden />
            {pending && !selected ? "Searching..." : "Search"}
          </button>
        </div>
      </form>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {summary && <p className="text-sm text-muted">{summary} The match is a quick estimate from the job title and description. Run a full scan before you apply.</p>}

      {results !== null && results.length === 0 && <EmptyState icon={Search} title="No jobs match that search" text="Try fewer words, a wider location or a longer time span." />}

      {results !== null && results.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
          {/* the list */}
          <ul className="max-h-[70vh] space-y-2 overflow-y-auto pr-1">
            {results.map((job) => (
              <li key={job.id}>
                <button type="button" onClick={() => open(job)} aria-pressed={selected?.id === job.id} className={`${CARD} w-full p-4 text-left transition-colors duration-150 ${selected?.id === job.id ? "border-primary bg-primary-soft" : "hover:border-primary/50"}`}>
                  <span className="flex items-start justify-between gap-2">
                    <span className="font-semibold">{job.title}</span>
                    {badge(job.match) && <span className="shrink-0 rounded-sm bg-marker px-1.5 py-0.5 text-xs font-medium text-on-marker">{badge(job.match)}</span>}
                  </span>
                  <span className="mt-0.5 block text-sm text-muted">{[job.company, job.location].filter(Boolean).join(", ")}</span>
                  <span className="mt-1 block text-xs text-muted">{[age(job.postedAt), job.remote ? "Remote" : "", job.match !== null ? `${job.match}% estimated match` : ""].filter(Boolean).join(", ")}</span>
                </button>
              </li>
            ))}
          </ul>

          {/* the job that was clicked */}
          <section className={`${CARD} self-start p-6`}>
            {selected ? (
              <>
                <h2 className="text-xl font-semibold">{selected.title}</h2>
                <p className="mt-1 text-muted">{[selected.company, selected.location, age(selected.postedAt)].filter(Boolean).join(", ")}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button type="button" disabled={busy !== null} onClick={() => save(selected, "scan")} className={PRIMARY_BUTTON}>
                    <ScanSearch className="size-4" aria-hidden />
                    {busy === "scan" ? "Saving..." : "Scan"}
                  </button>
                  <button type="button" disabled={busy !== null || Boolean(saved[selected.id])} onClick={() => save(selected)} className={SECONDARY_BUTTON}>
                    <Briefcase className="size-4" aria-hidden />
                    {saved[selected.id] ? "Saved to tracker" : busy === "save" ? "Saving..." : "Save job"}
                  </button>
                  <button type="button" disabled={busy !== null} onClick={() => save(selected, "apply")} className={SECONDARY_BUTTON}>
                    <Zap className="size-4" aria-hidden />
                    Auto Apply
                  </button>
                  <a href={selected.url} target="_blank" rel="noreferrer" className={SECONDARY_BUTTON}>
                    <ExternalLink className="size-4" aria-hidden />
                    View job site
                  </a>
                </div>
                <div className="mt-5 max-h-[55vh] overflow-y-auto whitespace-pre-wrap border-t border-border pt-4 text-sm leading-6">{description ?? (error ? "" : "Loading the description...")}</div>
              </>
            ) : (
              <p className="text-sm text-muted">Pick a job from the list to read it here.</p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
