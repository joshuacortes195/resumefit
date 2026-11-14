"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Copy } from "lucide-react";
import { CARD, SECONDARY_BUTTON } from "@/components/ui/buttons";
import { followUpNote, type FollowUp } from "@/lib/stats";

// applications that have had no answer for two weeks, each with a short note ready to copy into an email
export function FollowUps({ jobs, name, limit = 5 }: { jobs: FollowUp[]; name: string | null; limit?: number }) {
  const [copied, setCopied] = useState<string | null>(null);
  if (jobs.length === 0) return null;

  async function copy(job: FollowUp) {
    await navigator.clipboard.writeText(followUpNote(job, name));
    setCopied(job.id);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <section aria-label="Worth a follow up" className={`${CARD} p-5`}>
      <h2 className="font-semibold">Worth a follow up</h2>
      <p className="mt-1 text-sm text-muted">No answer in two weeks or more. A short, polite note can bring an application back to the top of the pile.</p>
      <ul className="mt-3 divide-y divide-border">
        {jobs.slice(0, limit).map((job) => (
          <li key={job.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5 text-sm">
            <span className="min-w-0">
              <Link href={`/tracker/${job.id}/job`} className="font-medium hover:text-primary">
                {job.title}
              </Link>
              <span className="block text-muted">
                {job.company ? `${job.company}, ` : ""}sent {job.days} days ago
              </span>
            </span>
            <button type="button" onClick={() => copy(job)} className={`${SECONDARY_BUTTON} px-3 py-1.5`}>
              {copied === job.id ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
              {copied === job.id ? "Copied" : "Copy a follow up note"}
            </button>
          </li>
        ))}
      </ul>
      {jobs.length > limit && <p className="mt-2 text-xs text-muted">and {jobs.length - limit} more on your tracker.</p>}
    </section>
  );
}
