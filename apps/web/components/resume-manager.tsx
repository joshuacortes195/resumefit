"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Copy, Download, Eye, Files, PenLine, Search, Star, Trash2, Upload } from "lucide-react";
import { deleteResumeAction, duplicateResumeAction, makeBaseResume, renameResumeAction } from "@/app/actions/resumes";
import type { ActionResult } from "@/app/actions/scans";
import { Dropzone } from "@/components/scan/dropzone";
import { CARD, INPUT, PRIMARY_BUTTON, SECONDARY_BUTTON } from "@/components/ui/buttons";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Modal } from "@/components/ui/modal";
import type { ManagedResume } from "@/lib/data/resumes";

// rows per page
const PAGE_SIZE = 10;

// short date like "Oct 8, 2026"
const DATE = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });

// shared look for the small icon buttons in the actions column
const ICON_BUTTON = "rounded-lg p-2 text-muted transition-colors duration-150 hover:bg-primary-soft hover:text-foreground disabled:opacity-40";

// the table of every saved resume, with search, upload and per resume actions
export function ResumeManager({ resumes }: { resumes: ManagedResume[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<ManagedResume | null>(null);
  const [preview, setPreview] = useState<{ name: string; text: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // runs an action and shows its message when it fails
  function run(action: () => Promise<ActionResult>, onDone?: () => void) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.ok) onDone?.();
      else setError(result.error);
    });
  }

  // loads a resume's text and shows it
  async function openPreview(id: string) {
    const response = await fetch(`/api/resumes/${id}/text`);
    if (response.ok) setPreview((await response.json()) as { name: string; text: string });
    else setError("We could not open that resume.");
  }

  const found = resumes.filter((resume) => `${resume.name} ${resume.jobTitle ?? ""} ${resume.jobCompany ?? ""}`.toLowerCase().includes(query.trim().toLowerCase()));
  const pages = Math.max(1, Math.ceil(found.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const shown = found.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  return (
    <div className="space-y-4">
      {/* search and upload */}
      <div className="flex flex-wrap items-center gap-3">
        <label className="relative min-w-52 flex-1 sm:max-w-sm">
          <span className="sr-only">Search resumes</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            placeholder="Search resumes"
            className={`${INPUT} bg-surface pl-9`}
          />
        </label>
        <button type="button" onClick={() => setUploading(true)} className={`${PRIMARY_BUTTON} ml-auto`}>
          <Upload className="size-4" aria-hidden />
          Upload resume
        </button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      {resumes.length === 0 ? (
        <EmptyState icon={Files} title="No resumes yet" text="Upload a resume here, or run a scan and the resume you use is saved automatically.">
          <button type="button" onClick={() => setUploading(true)} className={PRIMARY_BUTTON}>
            Upload your first resume
          </button>
        </EmptyState>
      ) : shown.length === 0 ? (
        <EmptyState icon={Search} title="No resumes match that search" text="Try part of the resume name or the job it was made for." />
      ) : (
        <div className={`${CARD} overflow-x-auto`}>
          <table className="w-full min-w-[48rem] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th className="w-14 py-3 pl-4 font-medium">Base</th>
                <th className="py-3 font-medium">Resume</th>
                <th className="py-3 font-medium">Job opportunity</th>
                <th className="py-3 font-medium">Created</th>
                <th className="py-3 font-medium">Last modified</th>
                <th className="py-3 pr-4 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((resume) => (
                <tr key={resume.id} className="border-b border-border transition-colors duration-150 last:border-0 hover:bg-background/60">
                  {/* the star picks the base resume, the one new scans start from */}
                  <td className="py-2 pl-4">
                    <button
                      type="button"
                      aria-pressed={resume.isBase}
                      aria-label={resume.isBase ? `${resume.name} is your base resume` : `Make ${resume.name} your base resume`}
                      disabled={pending || resume.isBase}
                      onClick={() => run(() => makeBaseResume(resume.id))}
                      className="rounded-lg p-2 transition-transform duration-150 hover:scale-110 disabled:hover:scale-100"
                    >
                      <Star className={`size-4 ${resume.isBase ? "fill-current text-warning" : "text-muted"}`} aria-hidden />
                    </button>
                  </td>
                  <td className="max-w-64 py-2 pr-4">
                    {renaming === resume.id ? (
                      // rename in place, enter saves and escape cancels
                      <form
                        action={(form) => run(() => renameResumeAction(resume.id, String(form.get("name") ?? "")), () => setRenaming(null))}
                        onKeyDown={(event) => event.key === "Escape" && setRenaming(null)}
                      >
                        <input name="name" aria-label="Resume name" defaultValue={resume.name} autoFocus onBlur={(event) => event.currentTarget.form?.requestSubmit()} className={`${INPUT} py-1`} />
                      </form>
                    ) : (
                      <button type="button" onClick={() => setRenaming(resume.id)} title="Click to rename" className="block max-w-full truncate text-left font-semibold hover:text-primary">
                        {resume.name}
                      </button>
                    )}
                    <span className="text-xs text-muted">
                      {resume.fileType ? resume.fileType.toUpperCase() : "Text"}, {resume.words} words
                    </span>
                  </td>
                  <td className="max-w-56 py-2 pr-4">
                    {resume.linkedJobId && resume.jobTitle ? (
                      <Link href={`/tracker/${resume.linkedJobId}/resume`} className="block truncate italic hover:text-primary">
                        {[resume.jobCompany, resume.jobTitle].filter(Boolean).join(", ")}
                      </Link>
                    ) : (
                      <span className="text-muted">None</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap py-2 pr-4 text-muted">{DATE.format(new Date(resume.createdAt))}</td>
                  <td className="whitespace-nowrap py-2 pr-4 text-muted">{DATE.format(new Date(resume.updatedAt))}</td>
                  <td className="whitespace-nowrap py-2 pr-3 text-right">
                    <button type="button" aria-label={`Preview ${resume.name}`} onClick={() => openPreview(resume.id)} className={ICON_BUTTON}>
                      <Eye className="size-4" aria-hidden />
                    </button>
                    <Link href={`/builder?resume=${resume.id}`} aria-label={`Edit ${resume.name} in the builder`} className={`inline-flex ${ICON_BUTTON}`}>
                      <PenLine className="size-4" aria-hidden />
                    </Link>
                    <button type="button" aria-label={`Duplicate ${resume.name}`} disabled={pending} onClick={() => run(() => duplicateResumeAction(resume.id))} className={ICON_BUTTON}>
                      <Copy className="size-4" aria-hidden />
                    </button>
                    <a href={`/api/resumes/${resume.id}/file`} aria-label={`Download ${resume.name}`} className={`inline-flex ${ICON_BUTTON}`}>
                      <Download className="size-4" aria-hidden />
                    </a>
                    <button type="button" aria-label={`Delete ${resume.name}`} onClick={() => setDeleting(resume)} className={`${ICON_BUTTON} hover:bg-danger/10 hover:text-danger`}>
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* paging */}
      {found.length > PAGE_SIZE && (
        <div className="flex items-center justify-between text-sm text-muted">
          <p>
            Showing {(current - 1) * PAGE_SIZE + 1}-{Math.min(found.length, current * PAGE_SIZE)} of {found.length}
          </p>
          <div className="flex gap-1">
            <button type="button" aria-label="Previous page" disabled={current <= 1} onClick={() => setPage(current - 1)} className="rounded-lg p-2 hover:bg-primary-soft disabled:opacity-40">
              <ChevronLeft className="size-4" aria-hidden />
            </button>
            <button type="button" aria-label="Next page" disabled={current >= pages} onClick={() => setPage(current + 1)} className="rounded-lg p-2 hover:bg-primary-soft disabled:opacity-40">
              <ChevronRight className="size-4" aria-hidden />
            </button>
          </div>
        </div>
      )}

      <Modal open={preview !== null} onClose={() => setPreview(null)} title={preview?.name ?? "Resume"} size="wide">
        <div className="max-h-[60vh] overflow-y-auto whitespace-pre-wrap rounded-lg bg-background p-4 text-sm leading-6">{preview?.text}</div>
      </Modal>

      <UploadModal
        open={uploading}
        onClose={() => setUploading(false)}
        onDone={() => {
          setUploading(false);
          router.refresh();
        }}
      />

      <ConfirmDialog
        open={deleting !== null}
        title={`Delete ${deleting?.name ?? "this resume"}?`}
        message="The resume and its file are removed for good. Scans you already ran with it keep their reports."
        confirmLabel="Delete"
        pending={pending}
        onConfirm={() => deleting && run(() => deleteResumeAction(deleting.id), () => setDeleting(null))}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}

// pop up for adding a resume file to the manager
function UploadModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // sends the file to the server to be read and saved
  async function upload() {
    if (!file) return;
    setPending(true);
    setError(null);
    const form = new FormData();
    form.set("file", file);
    try {
      const response = await fetch("/api/resumes", { method: "POST", body: form });
      const result = (await response.json()) as { id?: string; error?: string };
      if (!response.ok) throw new Error(result.error ?? "The upload did not work. Try again.");
      setFile(null);
      onDone();
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "The upload did not work. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Upload resume">
      <Dropzone file={file} onFile={setFile} />
      {error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      )}
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onClose} className={SECONDARY_BUTTON}>
          Cancel
        </button>
        <button type="button" disabled={!file || pending} onClick={upload} className={PRIMARY_BUTTON}>
          {pending ? "Reading your resume..." : "Save resume"}
        </button>
      </div>
    </Modal>
  );
}
