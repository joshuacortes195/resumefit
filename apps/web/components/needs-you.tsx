"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Send } from "lucide-react";
import { answerApplication } from "@/app/actions/applications";
import { CARD, INPUT, LINK_BUTTON, PRIMARY_BUTTON } from "@/components/ui/buttons";
import { startAutoApply } from "@/lib/extension-client";
import type { WaitingRun } from "@/lib/data/applications";

// a question the way a person would write it, without the star forms put on required fields
const tidy = (label: string) => label.replace(/\s*[*\u2731]+\s*$/, "");

// the applications that are filled in and only waiting on an answer from the person.
// they answer here, and the extension goes back and sends it. nothing has to be done on the job site
export function NeedsYou({ runs }: { runs: WaitingRun[] }) {
  if (runs.length === 0) return null;
  return (
    <section aria-label="Applications that need you" className="mb-6 space-y-3">
      <h2 className="text-lg font-semibold">
        {runs.length} {runs.length === 1 ? "application needs" : "applications need"} you
      </h2>
      <p className="max-w-2xl text-sm text-muted">Everything else on these is filled in. Answer what is left and we send it. Tick the box and the same question is never asked again.</p>
      {runs.map((run) => (
        <RunCard key={run.id} run={run} />
      ))}
    </section>
  );
}

// one waiting application: its questions, and the button that saves the answers and sends it
function RunCard({ run }: { run: WaitingRun }) {
  const [values, setValues] = useState<Record<string, string>>({});
  // an answer picked from a list is the same everywhere, so it is remembered unless the person says no. a written one is theirs to decide
  const [remember, setRemember] = useState<Record<string, boolean>>(() => Object.fromEntries(run.questions.map((question) => [question.label, !question.written])));
  const [state, setState] = useState<"idle" | "sent" | "unreachable">("idle");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    setError(null);
    startTransition(async () => {
      const answers = run.questions.map((question) => ({ label: question.label, value: values[question.label] ?? "", remember: remember[question.label] ?? false }));
      if (answers.length > 0) {
        const result = await answerApplication({ applicationId: run.id, answers });
        if (!result.ok) return setError(result.error);
      }
      // the answers are kept either way. the extension picks them up when it fills the form again
      const reply = await startAutoApply({ jobId: run.jobId, url: run.applyUrl });
      setState(reply.ok ? "sent" : "unreachable");
    });
  }

  return (
    <div className={`${CARD} p-5`}>
      <p className="font-semibold">
        <Link href={`/tracker/${run.jobId}/application`} className="hover:text-primary">
          {run.jobTitle ?? "Untitled job"}
        </Link>
        {run.company && <span className="font-normal text-muted">, {run.company}</span>}
      </p>
      {state === "idle" ? (
        <form
          className="mt-3 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
        >
          {run.questions.length === 0 && <p className="text-sm text-muted">Your answers are saved. It is ready to go.</p>}
          {run.questions.map((question, index) => (
            <div key={question.label}>
              <label htmlFor={`${run.id}-${index}`} className="block text-sm font-medium">
                {tidy(question.label)}
              </label>
              {/* a list of choices when the form had one, otherwise a box to write in */}
              {question.options?.length ? (
                <select id={`${run.id}-${index}`} required value={values[question.label] ?? ""} onChange={(event) => setValues((all) => ({ ...all, [question.label]: event.target.value }))} className={`${INPUT} mt-1 font-normal`}>
                  <option value="">Choose one</option>
                  {question.options.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              ) : (
                <textarea id={`${run.id}-${index}`} required maxLength={3000} value={values[question.label] ?? ""} onChange={(event) => setValues((all) => ({ ...all, [question.label]: event.target.value }))} className={`${INPUT} mt-1 h-24 resize-y font-normal`} />
              )}
              <label className="mt-1.5 flex items-center gap-2 text-sm text-muted">
                <input type="checkbox" checked={remember[question.label] ?? false} onChange={(event) => setRemember((all) => ({ ...all, [question.label]: event.target.checked }))} className="size-4 accent-(--primary)" />
                Use this answer on other applications too
              </label>
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" disabled={pending} className={PRIMARY_BUTTON}>
              <Send className="size-4" aria-hidden />
              {pending ? "Working..." : run.questions.length > 0 ? "Save and send" : "Send it"}
            </button>
            {error && (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            )}
          </div>
        </form>
      ) : (
        <p role="status" className="mt-3 text-sm text-muted">
          {state === "sent" ? (
            "Saved. The extension is filling it in again with your answers and sending it. You get a notice when it is done."
          ) : (
            <>
              Your answers are saved, but we could not reach the extension to send it. Check it on the{" "}
              <Link href="/extension" className={LINK_BUTTON}>
                Chrome Extension
              </Link>{" "}
              page, then come back and press Send it.
            </>
          )}
        </p>
      )}
    </div>
  );
}
