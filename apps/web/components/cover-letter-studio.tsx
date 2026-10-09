"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Check, Copy, Download, RefreshCw, Save, Sparkles } from "lucide-react";
import { generateCoverLetter, saveLetterToJob } from "@/app/actions/writing";
import { AiNotice } from "@/components/ai-notice";
import { CARD, INPUT, LINK_BUTTON, PRIMARY_BUTTON, SECONDARY_BUTTON } from "@/components/ui/buttons";
import { LENGTHS, TONES, type Length, type Tone } from "@/lib/ai/prompts/letters";
import { downloadExport } from "@/lib/download";

type StudioProps = {
  resumes: { id: string; name: string; isBase: boolean }[];
  // recent scans, picking one fills in the resume and the job
  scans: { id: string; label: string; jobId: string | null }[];
  // tracked jobs the finished letter can be saved to
  jobs: { id: string; label: string }[];
  ai: { available: boolean; remaining: number | null };
};

// the two steps of the cover letter page: what to write from, then the letter itself
export function CoverLetterStudio({ resumes, scans, jobs, ai }: StudioProps) {
  const base = resumes.find((resume) => resume.isBase) ?? resumes[0];
  const [step, setStep] = useState<1 | 2>(1);
  const [scanId, setScanId] = useState(scans[0]?.id ?? "");
  const [resumeId, setResumeId] = useState(base?.id ?? "");
  const [jdText, setJdText] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [company, setCompany] = useState("");
  const [tone, setTone] = useState<Tone>("Professional");
  const [length, setLength] = useState<Length>("Standard");
  const [why, setWhy] = useState("");
  const [manager, setManager] = useState("");
  const [letter, setLetter] = useState("");
  const [jobId, setJobId] = useState(scans[0]?.jobId ?? jobs[0]?.id ?? "");
  const [remaining, setRemaining] = useState(ai.remaining);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  // a scan brings its own resume and job, otherwise both have to be given here
  const fromScan = scanId !== "";
  const ready = fromScan || (resumeId !== "" && jdText.trim().length >= 50);

  // writes the letter, the first time and every time after
  function generate() {
    setMessage(null);
    startTransition(async () => {
      const result = await generateCoverLetter(fromScan ? { scanId, tone, length, why, manager } : { resumeId, jdText, jobTitle, company, tone, length, why, manager });
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
        {["Resume and job description", "Your cover letter"].map((label, index) => (
          <li key={label} aria-current={step === index + 1 ? "step" : undefined} className={`flex items-center gap-2 ${step === index + 1 ? "text-foreground" : "text-muted"}`}>
            <span className={`flex size-6 items-center justify-center rounded-full text-xs ${step === index + 1 ? "bg-primary text-on-primary" : "bg-border"}`}>{index + 1}</span>
            {label}
          </li>
        ))}
      </ol>

      {step === 1 && (
        <section className={`${CARD} space-y-5 p-6`}>
          {/* what the letter is written from */}
          {scans.length > 0 && (
            <label className="block text-sm font-semibold">
              Write it for
              <select value={scanId} onChange={(event) => setScanId(event.target.value)} className={`${INPUT} mt-1 font-normal`}>
                {scans.map((scan) => (
                  <option key={scan.id} value={scan.id}>
                    {scan.label}
                  </option>
                ))}
                <option value="">A different job (paste the description)</option>
              </select>
            </label>
          )}

          {!fromScan && (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-4">
                {resumes.length === 0 ? (
                  <p className="text-sm text-muted">
                    You have no saved resumes yet.{" "}
                    <Link href="/resumes" className={LINK_BUTTON}>
                      Upload one in the Resume Manager
                    </Link>{" "}
                    first.
                  </p>
                ) : (
                  <label className="block text-sm font-semibold">
                    Resume
                    <select value={resumeId} onChange={(event) => setResumeId(event.target.value)} className={`${INPUT} mt-1 font-normal`}>
                      {resumes.map((resume) => (
                        <option key={resume.id} value={resume.id}>
                          {resume.name}
                          {resume.isBase ? " (base)" : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label className="block text-sm font-semibold">
                  Job title
                  <input value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} className={`${INPUT} mt-1 font-normal`} />
                </label>
                <label className="block text-sm font-semibold">
                  Company
                  <input value={company} onChange={(event) => setCompany(event.target.value)} className={`${INPUT} mt-1 font-normal`} />
                </label>
              </div>
              <label className="block text-sm font-semibold">
                Job description
                <textarea value={jdText} onChange={(event) => setJdText(event.target.value)} placeholder="Copy and paste the job description here." className={`${INPUT} mt-1 h-52 resize-y font-normal`} />
              </label>
            </div>
          )}

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
