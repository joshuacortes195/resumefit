"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, LoaderCircle, ScanSearch, Sparkles, Star } from "lucide-react";
import { Dropzone } from "@/components/scan/dropzone";
import { INPUT, LINK_BUTTON, PRIMARY_BUTTON, SECONDARY_BUTTON } from "@/components/ui/buttons";

// a saved resume as the picker shows it
export type ResumeOption = { id: string; name: string; isBase: boolean };

type ScanFormProps = {
  resumes: ResumeOption[];
  // set when rescanning, the job description is reused so only the resume step shows
  rescan?: { scanId: string; jdText: string };
  // optimize sends people straight into the workspace when the scan is done
  next?: "optimize";
  // set when scanning for a job on the tracker, its details are filled in already
  job?: { id: string; jdText: string; title: string; company: string; url: string };
};

// the three ways to bring a resume
type Source = "upload" | "paste" | "saved";

// what the button says while the scan runs
const PROGRESS = ["Reading your resume", "Finding skills", "Scoring"];

// shared look for the big text boxes
const TEXTAREA = `${INPUT} h-64 resize-y p-3`;

// pick a resume and paste a job description, then run the scan
export function ScanForm({ resumes, rescan, job, next }: ScanFormProps) {
  const router = useRouter();
  const base = resumes.find((resume) => resume.isBase) ?? resumes[0];
  const [source, setSource] = useState<Source>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [resumeText, setResumeText] = useState("");
  const [resumeId, setResumeId] = useState(base?.id ?? "");
  const [jdText, setJdText] = useState(job?.jdText ?? "");
  const [showDetails, setShowDetails] = useState(job !== undefined);
  const [pending, setPending] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // moves the button text along while we wait
  useEffect(() => {
    if (!pending) return;
    const timer = setInterval(() => setStep((current) => Math.min(current + 1, PROGRESS.length - 1)), 700);
    return () => clearInterval(timer);
  }, [pending]);

  // the scan button stays off until there is a resume and a job description
  const hasResume = source === "upload" ? file !== null : source === "paste" ? resumeText.trim().length >= 50 : resumeId !== "";
  const hasJob = rescan !== undefined || jdText.trim().length >= 50;

  // sends everything to the server and opens the report when it is ready
  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // the button that was pressed says where to go afterwards
    const pressed = (event.nativeEvent as SubmitEvent).submitter?.getAttribute("value");
    const goOptimize = pressed === "optimize" || (pressed === null && next === "optimize");
    if (!hasResume || !hasJob || pending) return;
    const form = new FormData(event.currentTarget);
    // only send the resume from the tab that is showing
    form.delete("file");
    form.delete("resumeText");
    form.delete("resumeId");
    if (source === "upload" && file) form.set("file", file);
    if (source === "paste") form.set("resumeText", resumeText);
    if (source === "saved") form.set("resumeId", resumeId);
    if (rescan) {
      form.set("jdText", rescan.jdText);
      form.set("previousScanId", rescan.scanId);
    }
    if (job) form.set("jobId", job.id);

    setPending(true);
    setStep(0);
    setError(null);
    try {
      const response = await fetch("/api/scans", { method: "POST", body: form });
      const result = (await response.json()) as { id?: string; error?: string };
      if (!response.ok || !result.id) throw new Error(result.error ?? "Something went wrong. Try again.");
      router.push(goOptimize ? `/optimize/${result.id}` : `/scans/${result.id}`);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Something went wrong. Try again.");
      setPending(false);
    }
  }

  // the little tabs above the resume box
  const sources: { key: Source; label: string }[] = [
    { key: "upload", label: "Upload" },
    { key: "paste", label: "Paste text" },
    ...(resumes.length > 0 ? [{ key: "saved" as const, label: "Saved resumes" }] : []),
  ];

  return (
    <form onSubmit={handleSubmit}>
      <div className={`grid gap-6 ${rescan ? "" : "md:grid-cols-2"}`}>
        {/* step one, the resume */}
        <fieldset>
          <div className="flex min-h-9 flex-wrap items-center justify-between gap-2">
            <legend className="float-left font-semibold">{rescan ? "Pick the updated resume" : "1. Add your resume"}</legend>
            <div role="tablist" aria-label="How to add your resume" className="flex gap-1 rounded-lg bg-background p-1 text-xs font-medium">
              {sources.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={source === key}
                  onClick={() => setSource(key)}
                  className={`rounded-md px-2.5 py-1 transition-colors duration-150 ${source === key ? "bg-surface text-foreground shadow-sm" : "text-muted hover:text-foreground"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-2">
            {source === "upload" && <Dropzone file={file} onFile={setFile} />}
            {source === "paste" && (
              <textarea
                aria-label="Resume text"
                value={resumeText}
                onChange={(event) => setResumeText(event.target.value)}
                placeholder="Paste the full text of your resume here."
                className={TEXTAREA}
              />
            )}
            {source === "saved" && (
              <ul className="h-64 space-y-1 overflow-y-auto rounded-lg border border-border bg-background p-2">
                {resumes.map((resume) => (
                  <li key={resume.id}>
                    <label
                      className={`flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors duration-150 ${
                        resumeId === resume.id ? "bg-primary-soft text-foreground" : "hover:bg-surface"
                      }`}
                    >
                      <input type="radio" name="savedResume" checked={resumeId === resume.id} onChange={() => setResumeId(resume.id)} className="accent-(--primary)" />
                      <span className="min-w-0 flex-1 truncate">{resume.name}</span>
                      {/* the star marks the base resume */}
                      {resume.isBase && (
                        <span className="flex items-center gap-1 text-xs text-muted">
                          <Star className="size-3.5 fill-current text-warning" aria-hidden />
                          Base
                        </span>
                      )}
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </fieldset>

        {/* step two, the job description */}
        {!rescan && (
          <div>
            <label htmlFor="jdText" className="flex min-h-9 items-center font-semibold">
              2. Paste the job description
            </label>
            <textarea
              id="jdText"
              name="jdText"
              value={jdText}
              onChange={(event) => setJdText(event.target.value)}
              placeholder="Copy and paste the job description here. Try to leave out benefits, perks and legal disclaimers."
              className={`${TEXTAREA} mt-2`}
            />
          </div>
        )}
      </div>

      {/* optional details, we work them out from the posting when left blank */}
      {!rescan && (
        <div className="mt-4">
          <button type="button" aria-expanded={showDetails} onClick={() => setShowDetails((open) => !open)} className="inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-foreground">
            <ChevronDown className={`size-4 transition-transform duration-200 ${showDetails ? "rotate-180" : ""}`} aria-hidden />
            Job title, company and link (optional)
          </button>
          <div className={`grid gap-3 sm:grid-cols-3 ${showDetails ? "mt-3 animate-rise" : "hidden"}`}>
            <label className="text-sm font-medium">
              Job title
              <input name="jobTitle" defaultValue={job?.title} className={`${INPUT} mt-1 font-normal`} />
            </label>
            <label className="text-sm font-medium">
              Company
              <input name="company" defaultValue={job?.company} className={`${INPUT} mt-1 font-normal`} />
            </label>
            <label className="text-sm font-medium">
              Job posting link
              <input name="jobUrl" type="url" defaultValue={job?.url} placeholder="https://" className={`${INPUT} mt-1 font-normal`} />
            </label>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-4 rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      {/* scan button, plus a way to see an example first */}
      <div className="mt-5 flex flex-wrap items-center gap-4">
        <button type="submit" value={next === "optimize" ? "optimize" : "scan"} disabled={!hasResume || !hasJob || pending} className={PRIMARY_BUTTON}>
          {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : next === "optimize" ? <Sparkles className="size-4" aria-hidden /> : <ScanSearch className="size-4" aria-hidden />}
          <span aria-live="polite">{pending ? `${PROGRESS[step]}...` : rescan ? "Rescan" : next === "optimize" ? "AI Optimize" : "Scan"}</span>
        </button>
        {/* scan first, then go straight to the rewrite suggestions */}
        {!rescan && next !== "optimize" && (
          <button type="submit" value="optimize" disabled={!hasResume || !hasJob || pending} className={SECONDARY_BUTTON}>
            <Sparkles className="size-4" aria-hidden />
            AI Optimize
          </button>
        )}
        {!rescan && (
          <Link href="/scans/sample" className={`text-sm ${LINK_BUTTON}`}>
            View a sample scan
          </Link>
        )}
      </div>
    </form>
  );
}
