"use client";

import { useRef, useState, useTransition } from "react";
import { Check, Copy, Download, RefreshCw, Save, Sparkles, Upload } from "lucide-react";
import { generateCoverLetter, saveLetterToJob } from "@/app/actions/writing";
import { AiNotice } from "@/components/ai-notice";
import { CARD, INPUT, PRIMARY_BUTTON, SECONDARY_BUTTON } from "@/components/ui/buttons";
import { LENGTHS, TONES, type Length, type Tone } from "@/lib/ai/prompts/letters";
import { downloadExport } from "@/lib/download";

type StudioProps = {
  resumes: { id: string; name: string; isBase: boolean }[];
  // recent scans, picking one fills in the resume and the job
  scans: { id: string; label: string; jobId: string | null; resumeId: string | null }[];
  // tracked jobs the finished letter can be saved to
  jobs: { id: string; label: string }[];
  ai: { available: boolean; remaining: number | null };
};

// the two steps of the cover letter page: what to write from, then the letter itself
export function CoverLetterStudio({ resumes: savedResumes, scans, jobs, ai }: StudioProps) {
  const [resumes, setResumes] = useState(savedResumes);
  const base = resumes.find((resume) => resume.isBase) ?? resumes[0];
  const [step, setStep] = useState<1 | 2>(1);
  const [resumeId, setResumeId] = useState(base?.id ?? "");
  // who the letter is for, typed freely, like "Software Engineer Intern for Google"
  const [target, setTarget] = useState("");
  // a scan or tracked job to borrow the job description from, as "scan:id" or "job:id"
  const [saved, setSaved] = useState("");
  const [jdText, setJdText] = useState("");
  const [tone, setTone] = useState<Tone>("Professional");
  const [length, setLength] = useState<Length>("Standard");
  const [why, setWhy] = useState("");
  const [manager, setManager] = useState("");
  const [letter, setLetter] = useState("");
  const [jobId, setJobId] = useState(jobs[0]?.id ?? "");
  const [remaining, setRemaining] = useState(ai.remaining);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const [savedKind, savedId] = saved.split(":");
  // a scan remembers the resume it was run with, so it can stand in when none is saved
  const ready = (resumeId !== "" || savedKind === "scan") && (target.trim().length >= 2 || jdText.trim().length >= 50);

  // picking a job that is already saved fills in who the letter is for, and uses its description
  function pickSaved(value: string) {
    setSaved(value);
    const [kind, id] = value.split(":");
    const scan = kind === "scan" ? scans.find((entry) => entry.id === id) : undefined;
    const job = kind === "job" ? jobs.find((entry) => entry.id === id) : undefined;
    if (scan) setTarget(scan.label);
    if (job) setTarget(job.label);
    // the letter gets saved to the same job by default, and written from the resume the scan used
    const trackedJob = scan?.jobId ?? job?.id;
    if (trackedJob) setJobId(trackedJob);
    if (scan?.resumeId && resumes.some((resume) => resume.id === scan.resumeId)) setResumeId(scan.resumeId);
  }

  // saves an uploaded file as a resume and picks it
  async function upload(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setMessage(null);
    const form = new FormData();
    form.set("file", file);
    try {
      const response = await fetch("/api/resumes", { method: "POST", body: form });
      const result = (await response.json()) as { id?: string; error?: string };
      if (!response.ok || !result.id) throw new Error(result.error ?? "The upload did not work. Try again.");
      const added = { id: result.id, name: file.name.replace(/\.(pdf|docx)$/i, ""), isBase: false };
      setResumes((all) => (all.some((resume) => resume.id === added.id) ? all : [added, ...all]));
      setResumeId(added.id);
    } catch (problem) {
      setMessage({ ok: false, text: problem instanceof Error ? problem.message : "The upload did not work. Try again." });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  // writes the letter, the first time and every time after
  function generate() {
    setMessage(null);
    startTransition(async () => {
      const result = await generateCoverLetter({
        resumeId: resumeId || undefined,
        scanId: savedKind === "scan" ? savedId : undefined,
        jobId: savedKind === "job" ? savedId : undefined,
        target,
        jdText,
        tone,
        length,
        why,
        manager,
      });
      if (!result.ok) {
        setMessage({ ok: false, text: result.error });
        return;
      }
      setLetter(result.letter);
      setRemaining(result.remaining);
      setStep(2);
    });
  }

  // downloads the letter as it reads right now
  function download(format: "docx" | "pdf") {
    startTransition(async () => {
      const problem = await downloadExport({ text: letter, format, kind: "letter", name: "Cover-Letter" });
      if (problem) setMessage({ ok: false, text: problem });
    });
  }

  return (
    <div className="space-y-6">
      {/* which step we are on */}
      <ol className="flex flex-wrap gap-x-8 gap-y-2 text-sm font-medium">
        {["Resume and job", "Your cover letter"].map((label, index) => (
          <li key={label} aria-current={step === index + 1 ? "step" : undefined} className={`flex items-center gap-2 ${step === index + 1 ? "text-foreground" : "text-muted"}`}>
            <span className={`flex size-6 items-center justify-center rounded-full text-xs ${step === index + 1 ? "bg-primary text-on-primary" : "bg-border"}`}>{index + 1}</span>
            {label}
          </li>
        ))}
      </ol>

      {step === 1 && (
        <section className={`${CARD} space-y-5 p-6`}>
          {/* the resume the letter is written from, and the job it is for */}
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="letter-resume" className="block text-sm font-semibold">
                Resume
              </label>
              <div className="mt-1 flex gap-2">
                <select id="letter-resume" value={resumeId} onChange={(event) => setResumeId(event.target.value)} disabled={resumes.length === 0} className={`${INPUT} min-w-0 flex-1`}>
                  {resumes.length === 0 && <option value="">No saved resumes yet</option>}
                  {resumes.map((resume) => (
                    <option key={resume.id} value={resume.id}>
                      {resume.name}
                      {resume.isBase ? " (base)" : ""}
                    </option>
                  ))}
                </select>
                <button type="button" disabled={uploading} onClick={() => fileRef.current?.click()} className={`${SECONDARY_BUTTON} shrink-0`}>
                  <Upload className="size-4" aria-hidden />
                  {uploading ? "Reading..." : "Upload"}
                </button>
              </div>
              <input ref={fileRef} type="file" accept=".pdf,.docx" aria-label="Upload a resume" className="sr-only" tabIndex={-1} onChange={(event) => upload(event.target.files?.[0])} />
              <p className="mt-1 text-xs text-muted">Pick a saved resume, or upload a PDF or DOCX and it is saved for next time.</p>
            </div>
            <label className="block text-sm font-semibold">
              Write it for
              <input value={target} onChange={(event) => setTarget(event.target.value)} maxLength={200} placeholder="Software Engineer Intern for Google" className={`${INPUT} mt-1 font-normal`} />
              <span className="mt-1 block text-xs font-normal text-muted">The job, then the company.</span>
            </label>
          </div>

          {/* a job that is already saved brings its description along */}
          {(scans.length > 0 || jobs.length > 0) && (
            <label className="block text-sm font-semibold">
              Use a job you already saved <span className="font-normal text-muted">(optional)</span>
              <select value={saved} onChange={(event) => pickSaved(event.target.value)} className={`${INPUT} mt-1 font-normal`}>
                <option value="">None, I typed the job above</option>
                {scans.length > 0 && (
                  <optgroup label="Recent scans">
                    {scans.map((scan) => (
                      <option key={scan.id} value={`scan:${scan.id}`}>
                        {scan.label}
                      </option>
                    ))}
                  </optgroup>
                )}
                {jobs.length > 0 && (
                  <optgroup label="Job tracker">
                    {jobs.map((job) => (
                      <option key={job.id} value={`job:${job.id}`}>
                        {job.label}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </label>
          )}

          <label className="block text-sm font-semibold">
            Job description <span className="font-normal text-muted">(optional)</span>
            <textarea
              value={jdText}
              onChange={(event) => setJdText(event.target.value)}
              placeholder={saved ? "We use the description saved with that job. Paste a different one here to use it instead." : "Paste it for a letter that speaks to the posting. Leave it empty and the letter is written for the job title."}
              className={`${INPUT} mt-1 h-32 resize-y font-normal`}
            />
          </label>

          {/* how it should read */}
          <div className="grid gap-4 sm:grid-cols-2">
            <fieldset>
              <legend className="text-sm font-semibold">Tone</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {TONES.map((option) => (
                  <button key={option} type="button" aria-pressed={tone === option} onClick={() => setTone(option)} className={`rounded-lg border px-3 py-1.5 text-sm transition-colors duration-150 ${tone === option ? "border-primary bg-primary-soft text-primary" : "border-border hover:bg-primary-soft/60"}`}>
                    {option}
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="text-sm font-semibold">Length</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {(Object.keys(LENGTHS) as Length[]).map((option) => (
                  <button key={option} type="button" aria-pressed={length === option} onClick={() => setLength(option)} className={`rounded-lg border px-3 py-1.5 text-sm transition-colors duration-150 ${length === option ? "border-primary bg-primary-soft text-primary" : "border-border hover:bg-primary-soft/60"}`}>
                    {option}, about {LENGTHS[option]} words
                  </button>
                ))}
              </div>
            </fieldset>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-semibold">
              Why this company? <span className="font-normal text-muted">(optional)</span>
              <textarea value={why} onChange={(event) => setWhy(event.target.value)} maxLength={1000} placeholder="A sentence or two in your own words." className={`${INPUT} mt-1 h-20 resize-y font-normal`} />
            </label>
            <label className="block text-sm font-semibold">
              Hiring manager&apos;s name <span className="font-normal text-muted">(optional)</span>
              <input value={manager} onChange={(event) => setManager(event.target.value)} maxLength={120} className={`${INPUT} mt-1 font-normal`} />
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <button type="button" disabled={!ready || pending || !ai.available} onClick={generate} className={PRIMARY_BUTTON}>
              <Sparkles className="size-4" aria-hidden />
              {pending ? "Writing your letter..." : "Generate cover letter"}
            </button>
            <AiNotice available={ai.available} remaining={remaining} />
          </div>
        </section>
      )}

      {step === 2 && (
        <section className={`${CARD} space-y-4 p-6`}>
          <textarea aria-label="Cover letter" value={letter} onChange={(event) => setLetter(event.target.value)} className={`${INPUT} h-96 resize-y p-4 leading-7`} />
          <p className="text-xs text-muted">{letter.trim() ? `${letter.trim().split(/\s+/).length} words.` : ""} Read it through and make it yours before you send it.</p>

          {/* what to do with the letter */}
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={pending} onClick={generate} className={SECONDARY_BUTTON}>
              <RefreshCw className="size-4" aria-hidden />
              {pending ? "Writing..." : "Regenerate"}
            </button>
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(letter);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              className={SECONDARY_BUTTON}
            >
              {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
              {copied ? "Copied" : "Copy"}
            </button>
            <button type="button" disabled={pending} onClick={() => download("docx")} className={SECONDARY_BUTTON}>
              <Download className="size-4" aria-hidden />
              DOCX
            </button>
            <button type="button" disabled={pending} onClick={() => download("pdf")} className={SECONDARY_BUTTON}>
              <Download className="size-4" aria-hidden />
              PDF
            </button>
            <button type="button" onClick={() => setStep(1)} className="ml-auto text-sm font-semibold text-muted hover:text-foreground">
              Change options
            </button>
          </div>

          {/* attach it to a job on the tracker */}
          {jobs.length > 0 && (
            <div className="flex flex-wrap items-end gap-2 border-t border-border pt-4">
              <label className="min-w-52 flex-1 text-sm font-semibold">
                Save to a tracked job
                <select value={jobId} onChange={(event) => setJobId(event.target.value)} className={`${INPUT} mt-1 font-normal`}>
                  {jobs.map((job) => (
                    <option key={job.id} value={job.id}>
                      {job.label}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                disabled={pending || !jobId}
                onClick={() =>
                  startTransition(async () => {
                    const result = await saveLetterToJob(jobId, letter, tone);
                    setMessage(result.ok ? { ok: true, text: "Saved to the job's Cover Letter tab." } : { ok: false, text: result.error });
                  })
                }
                className={PRIMARY_BUTTON}
              >
                <Save className="size-4" aria-hidden />
                Save to job
              </button>
            </div>
          )}
          <AiNotice available={ai.available} remaining={remaining} />
        </section>
      )}

      <p aria-live="polite" className={`min-h-5 text-sm ${message?.ok ? "text-success" : "text-danger"}`}>
        {message?.text}
      </p>
    </div>
  );
}
