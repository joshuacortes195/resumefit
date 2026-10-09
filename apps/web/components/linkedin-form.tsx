"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Upload, UserSearch } from "lucide-react";
import type { LinkedinProfile } from "@resumefit/scoring";
import { createLinkedinReport } from "@/app/actions/practice";
import { CARD, INPUT, LINK_BUTTON, PRIMARY_BUTTON, SECONDARY_BUTTON } from "@/components/ui/buttons";

type LinkedinFormProps = {
  // tracked jobs that have a description, offered as a shortcut for step two
  jobs: { id: string; label: string; description: string }[];
};

// step one: your profile. step two: the jobs to compare it with
export function LinkedinForm({ jobs }: LinkedinFormProps) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [profile, setProfile] = useState({ headline: "", about: "", experience: "", skills: "", url: "" });
  const [targets, setTargets] = useState<string[]>([""]);
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [pending, startTransition] = useTransition();
  const set = (patch: Partial<typeof profile>) => setProfile((current) => ({ ...current, ...patch }));

  // reads the profile pdf and fills in the boxes, ready to be checked and edited
  async function importPdf(file: File | undefined) {
    if (!file) return;
    setReading(true);
    setError(null);
    const form = new FormData();
    form.set("file", file);
    try {
      const response = await fetch("/api/linkedin/import", { method: "POST", body: form });
      const result = (await response.json()) as { profile?: LinkedinProfile; error?: string };
      if (!response.ok || !result.profile) throw new Error(result.error ?? "We could not read that file.");
      set({ headline: result.profile.headline, about: result.profile.about, experience: result.profile.experience, skills: result.profile.skills.join(", "), url: result.profile.url ?? "" });
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "We could not read that file.");
    } finally {
      setReading(false);
    }
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createLinkedinReport({ profile: { ...profile, skills: profile.skills.split(/[,\n]/).map((skill) => skill.trim()).filter(Boolean) }, jobDescriptions: targets });
      if (result.ok) router.push(`/linkedin/${result.id}`);
      else setError(result.error);
    });
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <section className={`${CARD} space-y-4 p-6`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">1. Your LinkedIn profile</h2>
          <button type="button" disabled={reading} onClick={() => fileRef.current?.click()} className={SECONDARY_BUTTON}>
            <Upload className="size-4" aria-hidden />
            {reading ? "Reading..." : "Upload profile PDF"}
          </button>
          <input ref={fileRef} type="file" accept=".pdf" aria-label="LinkedIn profile PDF" className="sr-only" tabIndex={-1} onChange={(event) => importPdf(event.target.files?.[0])} />
        </div>
        <details className="text-sm text-muted">
          <summary className={`cursor-pointer ${LINK_BUTTON}`}>How do I get my profile as a PDF?</summary>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>Open your own profile on linkedin.com.</li>
            <li>Under your name, press the Resources button (some accounts show More).</li>
            <li>Choose Save to PDF, then upload that file here.</li>
          </ol>
          <p className="mt-2">We never sign in to LinkedIn or read your profile ourselves. You can also just paste each part below.</p>
        </details>

        <label className="block text-sm font-medium">
          Headline
          <input value={profile.headline} onChange={(event) => set({ headline: event.target.value })} maxLength={400} placeholder="The line under your name" className={`${INPUT} mt-1 font-normal`} />
          <span className="mt-1 block text-xs font-normal text-muted">{profile.headline.length} of 220 characters</span>
        </label>
        <label className="block text-sm font-medium">
          About
          <textarea value={profile.about} onChange={(event) => set({ about: event.target.value })} rows={5} className={`${INPUT} mt-1 resize-y font-normal`} />
        </label>
        <label className="block text-sm font-medium">
          Experience
          <textarea value={profile.experience} onChange={(event) => set({ experience: event.target.value })} rows={6} placeholder="Paste your experience section, titles and descriptions." className={`${INPUT} mt-1 resize-y font-normal`} />
        </label>
        <label className="block text-sm font-medium">
          Skills
          <textarea value={profile.skills} onChange={(event) => set({ skills: event.target.value })} rows={2} placeholder="Separated by commas" className={`${INPUT} mt-1 resize-y font-normal`} />
        </label>
        <label className="block text-sm font-medium">
          Profile address <span className="font-normal text-muted">(optional)</span>
          <input value={profile.url} onChange={(event) => set({ url: event.target.value })} placeholder="linkedin.com/in/yourname" className={`${INPUT} mt-1 font-normal`} />
        </label>
      </section>

      <section className={`${CARD} space-y-4 p-6`}>
        <div>
          <h2 className="text-lg font-semibold">2. The jobs you want</h2>
          <p className="mt-1 text-sm text-muted">Add one to three job descriptions. We look for the skills they share and check whether your profile shows them.</p>
        </div>
        {targets.map((target, index) => (
          <div key={index} className="space-y-2">
            <div className="flex items-start gap-2">
              <textarea
                aria-label={`Job description ${index + 1}`}
                value={target}
                onChange={(event) => setTargets(targets.map((entry, position) => (position === index ? event.target.value : entry)))}
                rows={5}
                placeholder="Paste a job description here."
                className={`${INPUT} resize-y`}
              />
              {targets.length > 1 && (
                <button type="button" aria-label={`Remove job description ${index + 1}`} onClick={() => setTargets(targets.filter((_, position) => position !== index))} className="rounded-lg p-2 text-muted hover:bg-danger/10 hover:text-danger">
                  <Trash2 className="size-4" aria-hidden />
                </button>
              )}
            </div>
            {/* fill this one in from a job on the tracker */}
            {jobs.length > 0 && target.trim() === "" && (
              <label className="flex items-center gap-2 text-sm text-muted">
                Or use a tracked job
                <select value="" onChange={(event) => setTargets(targets.map((entry, position) => (position === index ? (jobs.find((job) => job.id === event.target.value)?.description ?? "") : entry)))} className={`${INPUT} w-auto`}>
                  <option value="">Pick one</option>
                  {jobs.map((job) => (
                    <option key={job.id} value={job.id}>
                      {job.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        ))}
        {targets.length < 3 && (
          <button type="button" onClick={() => setTargets([...targets, ""])} className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:text-primary-hover">
            <Plus className="size-4" aria-hidden />
            Add another job
          </button>
        )}
      </section>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <button type="submit" disabled={pending} className={PRIMARY_BUTTON}>
        <UserSearch className="size-4" aria-hidden />
        {pending ? "Scoring your profile..." : "Score my profile"}
      </button>
    </form>
  );
}
