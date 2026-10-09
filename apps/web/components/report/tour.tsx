"use client";

import { useEffect, useState } from "react";
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from "@/components/ui/buttons";

export type TourStep = {
  // the id of the part of the page this step points at
  target: string;
  title: string;
  text: string;
};

// a short walk through the report, one part at a time
export function Tour({ steps, onClose }: { steps: TourStep[]; onClose: () => void }) {
  // -1 is the welcome card before the first step
  const [index, setIndex] = useState(-1);
  const step = steps[index];

  // scrolls to the part being explained and puts a ring around it
  useEffect(() => {
    if (!step) return;
    const element = document.getElementById(step.target);
    if (!element) return;
    element.scrollIntoView({ behavior: "smooth", block: "start" });
    element.classList.add("tour-target");
    return () => element.classList.remove("tour-target");
  }, [step]);

  // escape closes the tour from anywhere
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div role="dialog" aria-label="Report tour" className="fixed bottom-24 right-4 z-40 w-[min(22rem,calc(100vw-2rem))] animate-pop rounded-2xl border border-border bg-surface p-5 shadow-xl print:hidden">
      {step ? (
        <>
          <p className="text-xs text-muted">
            Step {index + 1} of {steps.length}
          </p>
          <h2 className="mt-1 font-semibold">{step.title}</h2>
          <p className="mt-2 text-sm text-muted">{step.text}</p>
          <div className="mt-4 flex justify-between gap-2">
            <button type="button" onClick={onClose} className="text-sm text-muted hover:text-foreground">
              End tour
            </button>
            <div className="flex gap-2">
              {index > 0 && (
                <button type="button" onClick={() => setIndex(index - 1)} className={`${SECONDARY_BUTTON} px-3 py-1.5`}>
                  Back
                </button>
              )}
              <button type="button" onClick={() => (index === steps.length - 1 ? onClose() : setIndex(index + 1))} className={`${PRIMARY_BUTTON} px-3 py-1.5`}>
                {index === steps.length - 1 ? "Done" : "Next"}
              </button>
            </div>
          </div>
        </>
      ) : (
        <>
          <h2 className="font-semibold">A quick look around</h2>
          <p className="mt-2 text-sm text-muted">This report shows what we found in your resume and what to change so it fits this job. The tour takes about a minute.</p>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={onClose} className={`${SECONDARY_BUTTON} px-3 py-1.5`}>
              Dismiss
            </button>
            <button type="button" onClick={() => setIndex(0)} className={`${PRIMARY_BUTTON} px-3 py-1.5`}>
              Start tour
            </button>
          </div>
        </>
      )}
    </div>
  );
}
