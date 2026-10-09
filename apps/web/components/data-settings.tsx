"use client";

import { useState, useTransition } from "react";
import { Download, Trash2 } from "lucide-react";
import { deleteMyAccount } from "@/app/actions/admin";
import { CARD, INPUT, SECONDARY_BUTTON } from "@/components/ui/buttons";
import { Modal } from "@/components/ui/modal";

// download everything, or delete the account for good
export function DataSettings() {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <section id="data" className={`${CARD} scroll-mt-20 space-y-5 p-6`}>
      <div>
        <h2 className="text-xl font-semibold">Your data</h2>
        <p className="mt-1 max-w-prose text-sm text-muted">It is yours. Take a copy whenever you like, or remove all of it.</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <a href="/api/account/export" className={SECONDARY_BUTTON}>
          <Download className="size-4" aria-hidden />
          Download everything
        </a>
        <p className="text-sm text-muted">A zip with your profile, resumes, scans, jobs and notes as JSON, plus the resume files you uploaded.</p>
      </div>
      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-5">
        <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-lg border border-danger/40 px-4 py-2.5 text-sm font-semibold text-danger transition duration-150 hover:bg-danger/10">
          <Trash2 className="size-4" aria-hidden />
          Delete my account
        </button>
        <p className="text-sm text-muted">Removes your account, every resume, scan, job and file. This cannot be undone.</p>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Delete your account?">
        <p className="text-sm text-muted">Everything you have stored will be removed for good: resumes and their files, scans, tracked jobs, interviews, cover letters and your profile. Download a copy first if you might want it.</p>
        <label className="mt-4 block text-sm font-medium">
          Type <span className="font-semibold">delete my account</span> to confirm
          <input value={typed} onChange={(event) => setTyped(event.target.value)} autoComplete="off" className={`${INPUT} mt-1 font-normal`} />
        </label>
        {error && (
          <p role="alert" className="mt-2 text-sm text-danger">
            {error}
          </p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={() => setOpen(false)} className={SECONDARY_BUTTON}>
            Cancel
          </button>
          <button
            type="button"
            disabled={pending || typed.trim().toLowerCase() !== "delete my account"}
            onClick={() =>
              startTransition(async () => {
                const result = await deleteMyAccount(typed);
                // on success the page moves on by itself, so only a failure comes back here
                if (result && !result.ok) setError(result.error);
              })
            }
            className="inline-flex items-center justify-center rounded-lg bg-danger px-4 py-2.5 text-sm font-semibold text-white transition duration-150 hover:opacity-90 disabled:opacity-50 dark:text-background"
          >
            {pending ? "Deleting..." : "Delete everything"}
          </button>
        </div>
      </Modal>
    </section>
  );
}
