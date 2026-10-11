"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Briefcase, ExternalLink, ScanSearch, Search } from "lucide-react";
import { findJobs, readJob, saveFoundJob } from "@/app/actions/find-jobs";
import { CompanyLogo } from "@/components/company-logo";
import { FitBadge } from "@/components/fit-badge";
import type { ResumeOption } from "@/components/scan-form";
import { CARD, INPUT, PRIMARY_BUTTON, SECONDARY_BUTTON } from "@/components/ui/buttons";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import type { JobResult } from "@/lib/jobs-feed";

// how long ago an opening was posted
function age(iso: string | null): string {
  if (!iso) return "";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return days < 1 ? "Posted today" : days === 1 ? "Posted yesterday" : days < 31 ? `Posted ${days} days ago` : "Posted over a month ago";
}

// shared look for the labels above each filter
const LABEL = "block text-sm font-medium";

// open roles ranked against a resume. the list is there as soon as the page opens
export function FindJobs({ resumes }: { resumes: ResumeOption[] }) {
  const router = useRouter();
  const base = resumes.find((resume) => resume.isBase) ?? resumes[0];
  const [resumeId, setResumeId] = useState(base?.id ?? "");
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [internOnly, setInternOnly] = useState(false);
  const [days, setDays] = useState("");
  const [sort, setSort] = useState<"relevance" | "date">("relevance");
  const [results, setResults] = useState<JobResult[] | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [selected, setSelected] = useState<JobResult | null>(null);
  const [description, setDescription] = useState<string | null>(null);
  const [saved, setSaved] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [searching, startSearch] = useTransition();
  const [, startRead] = useTransition();

  // runs the search with whatever the filters say right now
  function search(overrides: { resumeId?: string; sort?: "relevance" | "date"; remoteOnly?: boolean; internOnly?: boolean; days?: string } = {}) {
    const now = { resumeId, sort, remoteOnly, internOnly, days, ...overrides };
    startSearch(async () => {
      setError(null);
      const result = await findJobs({ query, location, remoteOnly: now.remoteOnly, internOnly: now.internOnly, days: now.days ? (Number(now.days) as 1 | 7 | 30) : null, sort: now.sort, resumeId: now.resumeId || null });
      if (!result.ok) {
        setError(result.error);
        setResults([]);
        return;
      }
      setResults(result.jobs);
      setSelected(null);
      setDescription(null);
      setSummary(
        `${result.jobs.length} shown, from ${result.total.toLocaleString("en-US")} open jobs${result.resumeName ? `, ranked for ${result.resumeName}` : ""}.${result.gathering ? " We are still gathering jobs from more companies, so this list will grow over the next few minutes." : ""}`,
      );
    });
  }

  // the list is filled in as soon as the page opens, nobody has to press search first
  useEffect(() => {
    search();
    // only once, when the page opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // opens one result in the detail pane and loads its description
  function open(job: JobResult) {
    setSelected(job);
    setDescription(null);
    setError(null);
    startRead(async () => {
      const result = await readJob(job.id);
      if (result.ok) setDescription(result.description);
      else setError(result.error);
    });
  }

  // saves the job to the tracker, then goes on to wherever the button was pointing
  async function save(job: JobResult, then?: "scan") {
    setBusy(then ?? "save");
    setError(null);
    const known = saved[job.id];
    const result = known ? { ok: true as const, jobId: known } : await saveFoundJob({ id: job.id, title: job.title, company: job.company, location: job.location, url: job.url, resumeId: resumeId || null });
    setBusy(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSaved((all) => ({ ...all, [job.id]: result.jobId }));
    if (then === "scan") router.push(`/scans/new?job=${result.jobId}`);
  }

  return (
    <div className="space-y-5">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          search();
        }}
        className={`${CARD} space-y-4 p-5`}
      >
        {/* every filter is the same height and lines up on one grid */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <label className={`${LABEL} lg:col-span-2`}>
            Match against
            <select
              value={resumeId}
              onChange={(event) => {
                setResumeId(event.target.value);
                search({ resumeId: event.target.value });
              }}
              disabled={resumes.length === 0}
              className={`${INPUT} mt-1 font-normal`}
            >
              {resumes.length === 0 && <option value="">Upload a resume to rank jobs</option>}
              {resumes.map((resume) => (
                <option key={resume.id} value={resume.id}>
                  {resume.name}
                  {resume.isBase ? " (base)" : ""}
                </option>
              ))}
            </select>
          </label>
          <label className={`${LABEL} lg:col-span-2`}>
            Job title or company
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Any" className={`${INPUT} mt-1 font-normal`} />
          </label>
          <label className={`${LABEL} lg:col-span-2`}>
            Location
            <input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="City, state or country" className={`${INPUT} mt-1 font-normal`} />
          </label>
          <label className={`${LABEL} lg:col-span-2`}>
            Posted
            <select
              value={days}
              onChange={(event) => {
                setDays(event.target.value);
                search({ days: event.target.value });
              }}
              className={`${INPUT} mt-1 font-normal`}
            >
              <option value="">Any time</option>
              <option value="1">Last 24 hours</option>
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
            </select>
          </label>
          <label className={`${LABEL} lg:col-span-2`}>
            Sort by
            <select
              value={sort}
              onChange={(event) => {
                setSort(event.target.value as "relevance" | "date");
                search({ sort: event.target.value as "relevance" | "date" });
              }}
              className={`${INPUT} mt-1 font-normal`}
            >
              <option value="relevance">Best fit for my resume</option>
              <option value="date">Newest</option>
            </select>
          </label>
          <div className="flex items-end lg:col-span-2">
            <button type="submit" disabled={searching} className={`${PRIMARY_BUTTON} w-full`}>
              <Search className="size-4" aria-hidden />
              {searching ? "Searching..." : "Search"}
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={remoteOnly}
              onChange={(event) => {
                setRemoteOnly(event.target.checked);
                search({ remoteOnly: event.target.checked });
              }}
              className="size-4 accent-(--primary)"
            />
            Remote only
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={internOnly}
              onChange={(event) => {
                setInternOnly(event.target.checked);
                search({ internOnly: event.target.checked });
              }}
              className="size-4 accent-(--primary)"
            />
            Internships and new grad only
          </label>
        </div>
      </form>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {summary && results !== null && <p className="text-sm text-muted">{summary} The fit is an estimate from the title, level and skills each posting names, not a scan score. Run a full scan before you apply.</p>}

      {/* while the first search runs */}
      {results === null && (
        <div className="grid gap-4 lg:grid-cols-[24rem_1fr]" role="status" aria-label="Finding jobs">
          <div className="space-y-2">
            {Array.from({ length: 6 }, (_, index) => (
              <Skeleton key={index} className="h-20" />
            ))}
          </div>
          <Skeleton className="hidden h-96 lg:block" />
        </div>
      )}

      {results !== null && results.length === 0 && !error && <EmptyState icon={Search} title="No jobs match that search" text="Try fewer words, a wider location or a longer time span." />}

      {results !== null && results.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-[24rem_1fr]">
          {/* the list */}
          <ul className="stagger max-h-[75vh] space-y-2 overflow-y-auto pr-1">
            {results.map((job) => (
              <li key={job.id}>
                <button type="button" onClick={() => open(job)} aria-pressed={selected?.id === job.id} className={`${CARD} flex w-full items-start gap-3 p-3.5 text-left transition-colors duration-150 ${selected?.id === job.id ? "border-primary bg-primary-soft" : "hover:border-primary/50"}`}>
                  <CompanyLogo company={job.company} domain={job.domain} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold leading-snug">{job.title}</span>
                    <span className="mt-0.5 block truncate text-sm text-muted">{[job.company, job.location].filter(Boolean).join(", ")}</span>
                    <span className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted">
                      <FitBadge fit={job.fit} />
                      {[age(job.postedAt), job.remote ? "Remote" : ""].filter(Boolean).join(", ")}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>

          {/* the job that was clicked */}
          <section className={`${CARD} self-start p-6`}>
            {selected ? (
              <>
                <div className="flex items-start gap-4">
                  <CompanyLogo company={selected.company} domain={selected.domain} size={48} />
                  <div className="min-w-0 flex-1">
                    <h2 className="text-xl font-semibold">{selected.title}</h2>
                    <p className="mt-0.5 text-muted">{[selected.company, selected.location, age(selected.postedAt)].filter(Boolean).join(", ")}</p>
                    <p className="mt-2">
                      <FitBadge fit={selected.fit} />
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button type="button" disabled={busy !== null} onClick={() => save(selected, "scan")} className={PRIMARY_BUTTON}>
                    <ScanSearch className="size-4" aria-hidden />
                    {busy === "scan" ? "Saving..." : "Scan"}
                  </button>
                  <button type="button" disabled={busy !== null || Boolean(saved[selected.id])} onClick={() => save(selected)} className={SECONDARY_BUTTON}>
                    <Briefcase className="size-4" aria-hidden />
                    {saved[selected.id] ? "Saved to tracker" : busy === "save" ? "Saving..." : "Save job"}
                  </button>
                  <a href={selected.url} target="_blank" rel="noreferrer" className={SECONDARY_BUTTON}>
                    <ExternalLink className="size-4" aria-hidden />
                    View job site
                  </a>
                </div>
                {selected.skills.length > 0 && (
                  <p className="mt-4 text-sm text-muted">
                    <span className="font-medium text-foreground">Skills it names:</span> {selected.skills.slice(0, 14).join(", ")}
                  </p>
                )}
                <div className="mt-4 max-h-[50vh] overflow-y-auto whitespace-pre-wrap border-t border-border pt-4 text-sm leading-6">{description ?? (error ? "" : "Loading the description...")}</div>
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
