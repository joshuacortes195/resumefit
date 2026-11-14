"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Files } from "lucide-react";
import { compareResumes } from "@/app/actions/scans";
import { LINK_BUTTON } from "@/components/ui/buttons";
import type { RankedResume } from "@/lib/data/scans";

// scores every saved resume against this job in one press and shows which version fits best.
// picking one runs a full scan with it, so the report is always about the resume that was chosen
export function BestResume({ scanId, jdText, matchRate }: { scanId: string; jdText: string; matchRate: number }) {
  const router = useRouter();
  const [ranked, setRanked] = useState<RankedResume[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [switching, setSwitching] = useState<string | null>(null);

  function compare() {
    setError(null);
    startTransition(async () => {
      const result = await compareResumes(scanId);
      if (result.ok) setRanked(result.resumes);
      else setError(result.error);
    });
  }

  // a new scan of the same posting with the resume that was picked
  async function use(resumeId: string) {
    setSwitching(resumeId);
    setError(null);
    try {
      const form = new FormData();
      form.set("resumeId", resumeId);
      form.set("jdText", jdText);
      form.set("previousScanId", scanId);
      const response = await fetch("/api/scans", { method: "POST", body: form });
      const result = (await response.json()) as { id?: string; error?: string };
      if (!response.ok || !result.id) throw new Error(result.error ?? "Something went wrong. Try again.");
      router.push(`/scans/${result.id}`);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Something went wrong. Try again.");
      setSwitching(null);
    }
  }

  if (!ranked) {
    return (
      <div className="mt-4 print:hidden">
        <button type="button" onClick={compare} disabled={pending} className={`inline-flex items-center gap-1.5 text-sm ${LINK_BUTTON}`}>
          <Files className="size-4" aria-hidden />
          {pending ? "Scoring your resumes..." : "Which of my resumes fits best?"}
        </button>
        {error && (
          <p role="alert" className="mt-1 text-sm text-danger">
            {error}
          </p>
        )}
      </div>
    );
  }

  const best = ranked[0];
  return (
    <section aria-label="Your resumes for this job" className="mt-4 rounded-xl border border-border/70 bg-background/60 px-3.5 py-3 text-sm print:hidden">
      <h3 className="font-medium">Your resumes for this job</h3>
      {ranked.length <= 1 ? (
        <p className="mt-1 text-muted">You have one saved resume. Save a few versions and this shows which one to send.</p>
      ) : (
        <>
          <p className="mt-1 text-muted">{best && !best.current && best.matchRate > matchRate ? `${best.name} fits this job better than the one you scanned.` : "The one you scanned is your best fit for this job."}</p>
          <ol className="mt-2 space-y-1.5">
            {ranked.slice(0, 5).map((resume) => (
              <li key={resume.resumeId} className="flex items-baseline gap-2">
                <span className="w-10 shrink-0 font-semibold tabular-nums">{resume.matchRate}%</span>
                <span className="min-w-0 flex-1 truncate" title={resume.name}>
                  {resume.name}
                  {resume.current && <span className="text-muted"> (this scan)</span>}
                </span>
                {!resume.current && (
                  <button type="button" onClick={() => use(resume.resumeId)} disabled={switching !== null} className={`shrink-0 ${LINK_BUTTON}`}>
                    {switching === resume.resumeId ? "Scanning..." : "Use it"}
                  </button>
                )}
              </li>
            ))}
          </ol>
          {ranked.length > 5 && <p className="mt-2 text-xs text-muted">The best 5 of {ranked.length}. Scored on each resume&apos;s text, so a number can sit a point or two from its full scan.</p>}
        </>
      )}
      {error && (
        <p role="alert" className="mt-1 text-danger">
          {error}
        </p>
      )}
    </section>
  );
}
