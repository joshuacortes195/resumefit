"use client";

import { useState } from "react";
import Link from "next/link";
import { Send } from "lucide-react";
import { LINK_BUTTON, SECONDARY_BUTTON } from "@/components/ui/buttons";
import { tellExtension } from "@/lib/extension-client";

type AutoApplyButtonProps = {
  // the tracker card the application is for
  jobId: string;
  // the posting or the application form
  url: string | null;
  // the resume to attach, when the card already has one picked
  resumeId?: string | null;
  label?: string;
  className?: string;
};

// asks the extension to open one application in a new tab, where its side panel fills the form in for the person to check.
// nothing is sent from here or from there, pressing Submit is always the person's own click
export function AutoApplyButton({ jobId, url, resumeId = null, label = "Auto Apply", className = SECONDARY_BUTTON }: AutoApplyButtonProps) {
  const [state, setState] = useState<"idle" | "asking" | "opened" | "unreachable">("idle");
  // only a real, secure address is ever handed to the extension
  const usable = url !== null && /^https:\/\//.test(url);

  async function start() {
    if (!usable) return;
    setState("asking");
    const opened = await tellExtension({ type: "resumefit-apply", url, jobId, resumeId });
    setState(opened ? "opened" : "unreachable");
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <button type="button" onClick={start} disabled={!usable || state === "asking"} title={usable ? undefined : "Add the job's link to the card first"} className={className}>
        <Send className="size-4" aria-hidden />
        {state === "asking" ? "Opening..." : label}
      </button>
      {/* what happened, said out loud for screen readers too */}
      <span role="status" className="max-w-64 text-xs text-muted">
        {!usable && "Add the job's link to this card first."}
        {state === "opened" && "Opened in a new tab. Click the ResumeFit icon there, then Fill this application. You press Submit yourself."}
        {state === "unreachable" && (
          <>
            We could not reach the extension. Make sure version 0.7 or newer is installed and connected on the{" "}
            <Link href="/extension" className={LINK_BUTTON}>
              Chrome Extension
            </Link>{" "}
            page.
          </>
        )}
      </span>
    </span>
  );
}
