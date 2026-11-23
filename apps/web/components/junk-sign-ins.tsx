"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteJunkSignInsAction } from "@/app/actions/admin-cleanup";
import { CARD, SECONDARY_BUTTON } from "@/components/ui/buttons";

// the admin card for sign in records that never got into the app, with a button that clears them out
export function JunkSignIns({ count, days, perRun }: { count: number | null; days: number; perRun: number }) {
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  // asks first, then deletes one run's worth and says how it went
  function clean() {
    if (!count) return;
    const now = Math.min(count, perRun);
    if (!window.confirm(`Delete ${now} sign in record${now === 1 ? "" : "s"} that never got into the app? This cannot be undone.`)) return;
    setMessage(null);
    startTransition(async () => {
      const result = await deleteJunkSignInsAction();
      if (!result.ok) setMessage({ ok: false, text: result.error });
      else setMessage({ ok: result.failed === 0, text: `Deleted ${result.deleted}.${result.failed ? ` ${result.failed} could not be deleted.` : ""}` });
    });
  }

  return (
    <section className={`${CARD} p-6`}>
      <h2 className="text-xl font-semibold">Unused sign ins</h2>
      <p className="mt-1 text-sm text-muted">
        Sign in records older than {days} days that never got past the invite code, so they have no account in the app. Anyone in the app and you are never touched. Up to {perRun} are deleted each time.
      </p>
      {count === null ? (
        <p className="mt-3 text-sm text-muted">Only available with sign in and the service key set up.</p>
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className="text-sm tabular-nums">{count === 0 ? "None right now." : `${count} found.`}</span>
          <button type="button" disabled={pending || count === 0} onClick={clean} className={SECONDARY_BUTTON}>
            <Trash2 className="size-4" aria-hidden />
            {pending ? "Deleting..." : "Delete them"}
          </button>
        </div>
      )}
      <p aria-live="polite" className={`mt-2 min-h-5 text-sm ${message?.ok ? "text-success" : "text-danger"}`}>
        {message?.text}
      </p>
    </section>
  );
}
