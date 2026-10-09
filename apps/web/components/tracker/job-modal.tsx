"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, CalendarPlus, Check, Download, ScanSearch, Trash2 } from "lucide-react";
import type { JobStatus } from "@resumefit/shared";
import { addJobInterview, removeInterview, removeJob, saveJobCoverLetter, saveJobDetails, saveJobNotes, saveThankYouNote, setJobArchived, setJobResume, setJobStatus } from "@/app/actions/jobs";
import type { ActionResult } from "@/app/actions/scans";
import { ScoreRing } from "@/components/score-ring";
import { INPUT, LINK_BUTTON, PRIMARY_BUTTON, SECONDARY_BUTTON } from "@/components/ui/buttons";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Modal } from "@/components/ui/modal";
import { StatusSelect } from "@/components/ui/status-select";
import { googleCalendarUrl, icsFile } from "@/lib/calendar";
import { JOB_TABS, localToday, type JobTab } from "@/lib/job-tabs";


const TAB_LABELS: Record<JobTab, string> = { job: "Job", resume: "Resume", "cover-letter": "Cover Letter", interviews: "Interviews", notes: "Notes" };
const INTERVIEW_TYPES = ["Phone screen", "Technical", "Behavioral", "Onsite", "Final", "Other"] as const;

// everything the card needs, loaded on the server
export type JobModalData = {
  job: {
    id: string;
    title: string;
    company: string | null;
    location: string | null;
    url: string | null;
    salary: string | null;
    description: string | null;
    dateApplied: string | null;
    notes: string | null;
    status: JobStatus;
    archived: boolean;
  };
  score: { matchRate: number; scanId: string; scans: number } | null;
  resume: { id: string; name: string; text: string } | null;
  resumes: { id: string; name: string; isBase: boolean }[];
  coverLetter: string;
  interviews: {
    id: string;
    type: string;
    datetime: string | null;
    interviewerName: string | null;
    phone: string | null;
    email: string | null;
    meetingLink: string | null;
    description: string | null;
    thankYouNote: string | null;
  }[];
};

// date and time the way people read it
const WHEN = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

// the pop up for one job, with a tab for each part of the application
export function JobModal({ data, tab }: { data: JobModalData; tab: JobTab }) {
  const router = useRouter();
  const { job } = data;
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const close = () => router.push(job.archived ? "/tracker?archived=1" : "/tracker");

  // runs a save and shows a little "Saved" when it works
  function run(action: () => Promise<ActionResult>, onDone?: () => void) {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
      onDone?.();
    });
  }

  return (
    <Modal open onClose={close} title={job.title} size="wide">
      {/* score, company and the actions for the whole job */}
      <div className="-mt-2 flex flex-wrap items-center gap-3">
        {data.score ? <ScoreRing score={data.score.matchRate} size="sm" /> : null}
        <p className="min-w-0 flex-1 truncate text-sm text-muted">{job.company ?? "Company not set"}</p>
        <Link href={`/scans/new?job=${job.id}`} className={`${SECONDARY_BUTTON} px-3 py-1.5`}>
          <ScanSearch className="size-4" aria-hidden />
          Scan
        </Link>
        <StatusSelect label="Status" value={job.status} disabled={pending} onChange={(status) => run(() => setJobStatus(job.id, status, localToday()))} />
        <button type="button" disabled={pending} onClick={() => run(() => setJobArchived(job.id, !job.archived), close)} className={`${SECONDARY_BUTTON} px-3 py-1.5`}>
          {job.archived ? <ArchiveRestore className="size-4" aria-hidden /> : <Archive className="size-4" aria-hidden />}
          {job.archived ? "Restore" : "Archive"}
        </button>
        <button type="button" aria-label="Delete job" onClick={() => setConfirming(true)} className="rounded-lg p-2 text-muted hover:bg-danger/10 hover:text-danger">
          <Trash2 className="size-4" aria-hidden />
        </button>
      </div>

      {/* one tab per part of the application, each has its own address */}
      <nav aria-label="Job sections" className="mt-4 flex gap-5 overflow-x-auto border-b border-border text-sm font-medium">
        {JOB_TABS.map((key) => (
          <Link
            key={key}
            href={`/tracker/${job.id}/${key}`}
            replace
            aria-current={tab === key ? "page" : undefined}
            className={`-mb-px whitespace-nowrap border-b-2 pb-2.5 transition-colors duration-150 ${tab === key ? "border-primary text-foreground" : "border-transparent text-muted hover:text-foreground"}`}
          >
            {TAB_LABELS[key]}
          </Link>
        ))}
      </nav>

      <div className="mt-5 min-h-72">
        {tab === "job" && <JobTabPanel data={data} pending={pending} run={run} />}
        {tab === "resume" && <ResumeTabPanel data={data} pending={pending} run={run} />}
        {tab === "cover-letter" && <CoverLetterPanel data={data} pending={pending} run={run} />}
        {tab === "interviews" && <InterviewsPanel data={data} pending={pending} run={run} />}
        {tab === "notes" && <NotesPanel data={data} />}
      </div>

      {/* save messages for every tab */}
      <p aria-live="polite" className="mt-3 min-h-5 text-sm">
        {error && <span className="text-danger">{error}</span>}
        {saved && !error && (
          <span className="inline-flex items-center gap-1 text-success">
            <Check className="size-4" aria-hidden />
            Saved
          </span>
        )}
      </p>

      <ConfirmDialog
        open={confirming}
        title="Delete this job?"
        message="This removes the card with its interviews, notes and cover letter. Scans of this job stay in your history."
        confirmLabel="Delete"
        pending={pending}
        onConfirm={() => run(() => removeJob(job.id), close)}
        onClose={() => setConfirming(false)}
      />
    </Modal>
  );
}

type PanelProps = { data: JobModalData; pending: boolean; run: (action: () => Promise<ActionResult>, onDone?: () => void) => void };

// job tab: the description on the left, listing and application details on the right
function JobTabPanel({ data, pending, run }: PanelProps) {
  const { job } = data;
  const value = (form: FormData, name: string) => String(form.get(name) ?? "");
  return (
    <form
      action={(form) =>
        run(() =>
          saveJobDetails(job.id, {
            title: value(form, "title"),
            company: value(form, "company"),
            location: value(form, "location"),
            url: value(form, "url"),
            salary: value(form, "salary"),
            description: value(form, "description"),
            dateApplied: value(form, "dateApplied"),
          }),
        )
      }
      className="grid gap-6 md:grid-cols-[1fr_16rem]"
    >
      <label className="block text-sm font-semibold">
        Job description
        <textarea name="description" defaultValue={job.description ?? ""} placeholder="Paste the job description here." className={`${INPUT} mt-1 h-80 resize-y font-normal`} />
      </label>
      <div className="space-y-3">
        <p className="text-sm font-semibold">Listing</p>
        <label className="block text-sm">
          Job title
          <input name="title" required defaultValue={job.title} className={`${INPUT} mt-1`} />
        </label>
        <label className="block text-sm">
          Company name
          <input name="company" defaultValue={job.company ?? ""} className={`${INPUT} mt-1`} />
        </label>
        <label className="block text-sm">
          Location
          <input name="location" defaultValue={job.location ?? ""} className={`${INPUT} mt-1`} />
        </label>
        <label className="block text-sm">
          Job listing link
          <input name="url" type="url" defaultValue={job.url ?? ""} placeholder="https://" className={`${INPUT} mt-1`} />
        </label>
        <p className="pt-2 text-sm font-semibold">Application</p>
        <label className="block text-sm">
          Salary
          <input name="salary" defaultValue={job.salary ?? ""} className={`${INPUT} mt-1`} />
        </label>
        <label className="block text-sm">
          Date applied
          <input name="dateApplied" type="date" defaultValue={job.dateApplied ?? ""} className={`${INPUT} mt-1`} />
        </label>
        <button type="submit" disabled={pending} className={`${PRIMARY_BUTTON} w-full`}>
          {pending ? "Saving..." : "Save"}
        </button>
      </div>
    </form>
  );
}

// resume tab: the version used for this job, with a way to swap or download it
function ResumeTabPanel({ data, pending, run }: PanelProps) {
  const { job, resume, resumes, score } = data;
  if (resumes.length === 0) {
    return (
      <p className="text-sm text-muted">
        You have no saved resumes yet.{" "}
        <Link href={`/scans/new?job=${job.id}`} className={LINK_BUTTON}>
          Scan one against this job
        </Link>{" "}
        and it will show up here.
      </p>
    );
  }
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-52 flex-1 text-sm font-semibold">
          Resume used for this job
          <select value={resume?.id ?? ""} disabled={pending} onChange={(event) => run(() => setJobResume(job.id, event.target.value))} className={`${INPUT} mt-1 font-normal`}>
            {!resume && <option value="">Pick a resume</option>}
            {resumes.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
                {option.isBase ? " (base)" : ""}
              </option>
            ))}
          </select>
        </label>
        {resume && (
          <a href={`/api/resumes/${resume.id}/file`} className={SECONDARY_BUTTON}>
            <Download className="size-4" aria-hidden />
            Download
          </a>
        )}
      </div>
      {score && (
        <p className="text-sm text-muted">
          Scanned {score.scans} {score.scans === 1 ? "time" : "times"} for this job.{" "}
          <Link href={`/scans/${score.scanId}`} className={LINK_BUTTON}>
            Open the latest report
          </Link>
        </p>
      )}
      {resume && <div className="max-h-80 overflow-y-auto whitespace-pre-wrap rounded-lg bg-background p-4 text-sm leading-6">{resume.text}</div>}
    </div>
  );
}

// cover letter tab: a plain editor
function CoverLetterPanel({ data, pending, run }: PanelProps) {
  const [content, setContent] = useState(data.coverLetter);
  return (
    <div className="space-y-3">
      <textarea aria-label="Cover letter" value={content} onChange={(event) => setContent(event.target.value)} placeholder="Write or paste your cover letter for this job." className={`${INPUT} h-80 resize-y p-3 leading-6`} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted">{content.trim() ? `${content.trim().split(/\s+/).length} words` : "Most cover letters run 150 to 350 words."}</p>
        <button type="button" disabled={pending} onClick={() => run(() => saveJobCoverLetter(data.job.id, content))} className={PRIMARY_BUTTON}>
          {pending ? "Saving..." : "Save cover letter"}
        </button>
      </div>
    </div>
  );
}

// starts a download of some text as a file
function downloadText(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

// interviews tab: the list, plus a form for a new one
function InterviewsPanel({ data, pending, run }: PanelProps) {
  const { job, interviews } = data;
  const [adding, setAdding] = useState(interviews.length === 0);
  const value = (form: FormData, name: string) => String(form.get(name) ?? "");

  return (
    <div className="space-y-5">
      {interviews.length > 0 && (
        <ul className="space-y-3">
          {interviews.map((interview) => {
            // what goes on the calendar for this interview
            const event = interview.datetime
              ? {
                  title: `${interview.type} interview, ${job.company ?? job.title}`,
                  start: new Date(interview.datetime),
                  details: [interview.interviewerName && `With ${interview.interviewerName}`, interview.description].filter(Boolean).join("\n"),
                  location: interview.meetingLink ?? undefined,
                }
              : null;
            return (
              <li key={interview.id} className="rounded-xl border border-border p-4 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{interview.type}</p>
                    <p className="text-muted">{interview.datetime ? WHEN.format(new Date(interview.datetime)) : "No date set"}</p>
                  </div>
                  <button type="button" aria-label={`Delete ${interview.type} interview`} disabled={pending} onClick={() => run(() => removeInterview(job.id, interview.id))} className="rounded-lg p-1.5 text-muted hover:bg-danger/10 hover:text-danger">
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </div>
                {/* who to expect and how to reach them */}
                <dl className="mt-2 grid gap-x-6 gap-y-1 text-muted sm:grid-cols-2">
                  {interview.interviewerName && <div>Interviewer: {interview.interviewerName}</div>}
                  {interview.phone && <div>Phone: {interview.phone}</div>}
                  {interview.email && <div>Email: {interview.email}</div>}
                  {interview.meetingLink && (
                    <div className="truncate">
                      <a href={interview.meetingLink} target="_blank" rel="noreferrer" className={LINK_BUTTON}>
                        Meeting link
                      </a>
                    </div>
                  )}
                </dl>
                {interview.description && <p className="mt-2 whitespace-pre-wrap">{interview.description}</p>}
                {event && (
                  <div className="mt-3 flex flex-wrap gap-4">
                    <a href={googleCalendarUrl(event)} target="_blank" rel="noreferrer" className={`inline-flex items-center gap-1 ${LINK_BUTTON}`}>
                      <CalendarPlus className="size-4" aria-hidden />
                      Add to Google Calendar
                    </a>
                    <button type="button" onClick={() => downloadText("interview.ics", icsFile(event, interview.id), "text/calendar")} className={`inline-flex items-center gap-1 ${LINK_BUTTON}`}>
                      <Download className="size-4" aria-hidden />
                      Calendar file
                    </button>
                  </div>
                )}
                <ThankYouNote jobId={job.id} interviewId={interview.id} note={interview.thankYouNote ?? ""} pending={pending} run={run} />
              </li>
            );
          })}
        </ul>
      )}

      {adding ? (
        <form
          action={(form) =>
            run(
              () =>
                addJobInterview(job.id, {
                  type: value(form, "type") as (typeof INTERVIEW_TYPES)[number],
                  // the picker gives local time, so turn it into an exact moment before sending
                  datetime: value(form, "datetime") ? new Date(value(form, "datetime")).toISOString() : "",
                  interviewerName: value(form, "interviewerName"),
                  phone: value(form, "phone"),
                  email: value(form, "email"),
                  meetingLink: value(form, "meetingLink"),
                  description: value(form, "description"),
                }),
              () => setAdding(false),
            )
          }
          className="grid gap-3 rounded-xl border border-border p-4 sm:grid-cols-2"
        >
          <p className="font-semibold sm:col-span-2">New interview</p>
          <label className="block text-sm">
            Interview type
            <select name="type" className={`${INPUT} mt-1`}>
              {INTERVIEW_TYPES.map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            Date and time
            <input name="datetime" type="datetime-local" className={`${INPUT} mt-1`} />
          </label>
          <label className="block text-sm">
            Interviewer name
            <input name="interviewerName" className={`${INPUT} mt-1`} />
          </label>
          <label className="block text-sm">
            Phone
            <input name="phone" type="tel" className={`${INPUT} mt-1`} />
          </label>
          <label className="block text-sm">
            Email
            <input name="email" type="email" className={`${INPUT} mt-1`} />
          </label>
          <label className="block text-sm">
            Meeting link
            <input name="meetingLink" type="url" placeholder="https://" className={`${INPUT} mt-1`} />
          </label>
          <label className="block text-sm sm:col-span-2">
            Notes
            <textarea name="description" className={`${INPUT} mt-1 h-20 resize-y`} />
          </label>
          <div className="flex justify-end gap-2 sm:col-span-2">
            {interviews.length > 0 && (
              <button type="button" onClick={() => setAdding(false)} className={SECONDARY_BUTTON}>
                Cancel
              </button>
            )}
            <button type="submit" disabled={pending} className={PRIMARY_BUTTON}>
              {pending ? "Saving..." : "Save interview"}
            </button>
          </div>
        </form>
      ) : (
        <button type="button" onClick={() => setAdding(true)} className={SECONDARY_BUTTON}>
          <CalendarPlus className="size-4" aria-hidden />
          New interview
        </button>
      )}
    </div>
  );
}

// the thank you note for one interview, tucked away until it is wanted
function ThankYouNote({ jobId, interviewId, note, pending, run }: { jobId: string; interviewId: string; note: string; pending: boolean; run: PanelProps["run"] }) {
  const [open, setOpen] = useState(note !== "");
  const [text, setText] = useState(note);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={`mt-3 block text-sm ${LINK_BUTTON}`}>
        Thank-you note
      </button>
    );
  }
  return (
    <div className="mt-3 space-y-2">
      <textarea aria-label="Thank-you note" value={text} onChange={(event) => setText(event.target.value)} placeholder="Write a short thank you to send after the interview." className={`${INPUT} h-28 resize-y`} />
      <div className="flex gap-2">
        <button type="button" disabled={pending} onClick={() => run(() => saveThankYouNote(jobId, interviewId, text))} className={`${SECONDARY_BUTTON} px-3 py-1.5`}>
          Save note
        </button>
        <button type="button" onClick={() => navigator.clipboard.writeText(text)} className={`${SECONDARY_BUTTON} px-3 py-1.5`}>
          Copy
        </button>
      </div>
    </div>
  );
}

// notes tab: saves by itself a moment after typing stops
function NotesPanel({ data }: { data: JobModalData }) {
  const [notes, setNotes] = useState(data.job.notes ?? "");
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const lastSaved = useRef(data.job.notes ?? "");

  useEffect(() => {
    if (notes === lastSaved.current) return;
    const timer = setTimeout(async () => {
      setState("saving");
      const result = await saveJobNotes(data.job.id, notes);
      if (result.ok) lastSaved.current = notes;
      setState(result.ok ? "saved" : "error");
    }, 700);
    return () => clearTimeout(timer);
  }, [notes, data.job.id]);

  return (
    <div>
      <textarea aria-label="Notes" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Anything worth remembering about this job: who you talked to, what to follow up on, questions to ask." className={`${INPUT} h-80 resize-y p-3 leading-6`} />
      <p aria-live="polite" className="mt-2 min-h-4 text-xs text-muted">
        {state === "saving" && "Saving..."}
        {state === "saved" && "All changes saved"}
        {state === "error" && <span className="text-danger">Could not save. Check your connection and keep typing to try again.</span>}
      </p>
    </div>
  );
}
