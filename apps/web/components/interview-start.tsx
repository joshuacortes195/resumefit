"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Mic } from "lucide-react";
import { startPractice } from "@/app/actions/practice";
import { INPUT, PRIMARY_BUTTON } from "@/components/ui/buttons";

// pick a tracked job or paste a job description, then start
export function InterviewStart({ jobs, preselected }: { jobs: { id: string; label: string }[]; preselected?: string }) {
  const router = useRouter();
  const [jobId, setJobId] = useState(preselected ?? jobs[0]?.id ?? "");
  const [jdText, setJdText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function start() {
    setError(null);
    startTransition(async () => {
      const result = await startPractice(jobId ? { jobId } : { jdText });
      if (result.ok) router.push(`/interview/${result.id}`);
      else setError(result.error);
    });
  }

  return (
    <div className="space-y-4">
      {jobs.length > 0 && (
        <label className="block text-sm font-semibold">
          Practice for
          <select value={jobId} onChange={(event) => setJobId(event.target.value)} className={`${INPUT} mt-1 font-normal`}>
            {jobs.map((job) => (
              <option key={job.id} value={job.id}>
                {job.label}
              </option>
            ))}
            <option value="">A different job (paste the description)</option>
          </select>
        </label>
      )}
      {jobId === "" && (
        <label className="block text-sm font-semibold">
          Job description
          <textarea value={jdText} onChange={(event) => setJdText(event.target.value)} rows={7} placeholder="Paste the job description. The questions are written from it." className={`${INPUT} mt-1 resize-y font-normal`} />
        </label>
      )}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <button type="button" disabled={pending || (jobId === "" && jdText.trim().length < 50)} onClick={start} className={PRIMARY_BUTTON}>
        <Mic className="size-4" aria-hidden />
        {pending ? "Writing your questions..." : "Start practice"}
      </button>
    </div>
  );
}
