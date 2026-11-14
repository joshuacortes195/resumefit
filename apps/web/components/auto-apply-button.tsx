"use client";

import { useState } from "react";
import Link from "next/link";
import { Send } from "lucide-react";
import { LINK_BUTTON, SECONDARY_BUTTON } from "@/components/ui/buttons";
import { startAutoApply } from "@/lib/extension-client";

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
// pressing Submit stays the person's own click, unless they switched sending on in their application profile. then the extension works through it alone
export function AutoApplyButton({ jobId, url, resumeId = null, label = "Auto Apply", className = SECONDARY_BUTTON }: AutoApplyButtonProps) {
  const [state, setState] = useState<"idle" | "asking" | "opened" | "alone" | "unreachable">("idle");
  // only a real, secure address is ever handed to the extension
  const usable = url !== null && /^https:\/\//.test(url);

  async function start() {
    if (!usable) return;
    setState("asking");
    const reply = await startAutoApply({ jobId, url, resumeId });
    setState(!reply.ok ? "unreachable" : reply.auto ? "alone" : "opened");
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
        {state === "alone" && "Working on it in a background tab. It is filled in and sent if your rules allow, and you get a notice either way."}
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
