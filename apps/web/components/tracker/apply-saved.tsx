"use client";

import { useState } from "react";
import Link from "next/link";
import { Send } from "lucide-react";
import { LINK_BUTTON, SECONDARY_BUTTON } from "@/components/ui/buttons";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { startAutoApplyMany } from "@/lib/extension-client";

// hands every job in Saved to the extension, which fills each one in and sends it when the person's rules allow.
// only shown to someone who switched sending on in their application profile
export function ApplySaved({ jobs, cap }: { jobs: { jobId: string; url: string }[]; cap: number }) {
  const [asking, setAsking] = useState(false);
  const [state, setState] = useState<"idle" | "starting" | "started" | "unreachable">("idle");
  const [queued, setQueued] = useState(0);

  async function start() {
    setState("starting");
    const reply = await startAutoApplyMany(jobs);
    setQueued(reply.queued ?? jobs.length);
    setState(reply.ok ? "started" : "unreachable");
  }

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <button type="button" onClick={() => setAsking(true)} disabled={state === "starting"} className={SECONDARY_BUTTON}>
        <Send className="size-4" aria-hidden />
        {state === "starting" ? "Starting..." : `Auto Apply to all ${jobs.length} saved`}
      </button>
      {/* what happened, said out loud for screen readers too */}
      <p role="status" className="text-sm text-muted">
        {state === "started" && `${queued} ${queued === 1 ? "application is" : "applications are"} being worked through one at a time in background tabs. You get a notice for each one.`}
        {state === "unreachable" && (
          <>
            The extension did not take them. Make sure version 0.8 or newer is installed, connected and allowed onto pages on the{" "}
            <Link href="/extension" className={LINK_BUTTON}>
              Chrome Extension
            </Link>{" "}
            page, and that you have sends left today.
          </>
        )}
      </p>
      {/* sending cannot be undone, so this one always asks first */}
      <ConfirmDialog
        open={asking}
        title={`Apply to ${jobs.length} saved ${jobs.length === 1 ? "job" : "jobs"}?`}
        message={`Each one is filled in from your application profile and sent without you reading it first, up to ${cap} a day. A sent application cannot be taken back. Anything we are not sure about is left filled in for you instead.`}
        confirmLabel="Start applying"
        onConfirm={() => {
          setAsking(false);
          void start();
        }}
        onClose={() => setAsking(false)}
      />
    </div>
  );
}
