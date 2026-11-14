"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Circle } from "lucide-react";
import { CARD, LINK_BUTTON } from "@/components/ui/buttons";
import { extensionState, type ExtensionState } from "@/lib/extension-client";

type SetupProps = {
  hasResume: boolean;
  profileReady: boolean;
  // true when the person chose to have applications sent for them
  sending: boolean;
  // what the app itself knows about the extension, used when the extension cannot be asked
  everConnected: boolean;
};

// the one time setup for Auto Apply as a short list, each step ticked off as it is done. it goes away when all four are
export function AutoApplySetup({ hasResume, profileReady, sending, everConnected }: SetupProps) {
  // what the extension says about itself, null until it has been asked
  const [extension, setExtension] = useState<ExtensionState | null>(null);
  useEffect(() => {
    let current = true;
    void extensionState().then((state) => current && setExtension(state));
    return () => {
      current = false;
    };
  }, []);

  // on a phone or another browser the extension cannot answer, so what the app knows stands in
  const connected = extension?.installed ? extension.connected && extension.allowed : everConnected;
  const steps: { done: boolean; text: string; href: string; action: string; note?: string }[] = [
    { done: hasResume, text: "Add your resume", href: "/scans/new", action: "Scan a resume" },
    { done: profileReady, text: "Check your application profile", href: "/settings/application", action: "Open the profile", note: "It starts filled in from your resume." },
    {
      done: connected,
      text: "Install and connect the Chrome extension",
      href: "/extension",
      action: extension?.installed && !extension.connected ? "Connect it" : extension?.installed && !extension.allowed ? "Allow it onto job pages" : "Get the extension",
      note: extension?.installed && extension.connected && !extension.allowed ? "Open its side panel on any job page and press Allow." : undefined,
    },
    { done: sending, text: "Choose who presses Submit", href: "/settings/application", action: "Choose", note: "Leave it on you, or let ResumeFit send them." },
  ];
  // the last step is a choice, and leaving it on "I do" is a fine one. so the list goes away once the first three are done
  const left = steps.filter((step) => !step.done);
  if (steps.slice(0, 3).every((step) => step.done)) return null;

  return (
    <section aria-label="Set up Auto Apply" className={`${CARD} mb-6 p-5`}>
      <h2 className="font-semibold">Set up Auto Apply, once</h2>
      <p className="mt-1 text-sm text-muted">
        {steps.length - left.length} of {steps.length} done. After this, applying is one press.
      </p>
      <ol className="mt-3 space-y-2">
        {steps.map((step) => (
          <li key={step.text} className="flex items-start gap-2.5 text-sm">
            {step.done ? <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden /> : <Circle className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />}
            <span className={step.done ? "text-muted" : ""}>
              <span className="sr-only">{step.done ? "Done: " : "To do: "}</span>
              {step.text}
              {!step.done && (
                <>
                  .{" "}
                  <Link href={step.href} className={LINK_BUTTON}>
                    {step.action}
                  </Link>
                  {step.note && <span className="text-muted"> {step.note}</span>}
                </>
              )}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
