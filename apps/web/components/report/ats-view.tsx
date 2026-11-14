import type { ParsedResume } from "@resumefit/scoring";
import { AlertTriangle } from "lucide-react";
import { CARD } from "@/components/ui/buttons";
import { atsView } from "@/lib/ats-view";

// the resume as an applicant system would type it into its own form, box by box.
// what it could not read, or read wrong, is marked, because that is what a recruiter's search will miss
export function AtsView({ resume }: { resume: ParsedResume }) {
  const view = atsView(resume);
  return (
    <section className={`${CARD} p-5 sm:p-6`}>
      <h2 className="text-xl font-semibold">What the applicant system sees</h2>
      <p className="mt-2 max-w-prose text-sm text-muted">
        When you apply, the system reads your resume and fills in a form like this one. Recruiters search and filter on these boxes, not on the page you designed. {view.problems === 0 ? "Everything here was read cleanly." : `${view.problems} ${view.problems === 1 ? "box needs" : "boxes need"} a look.`}
      </p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {view.groups.map((group) => (
          <div key={group.title} className="rounded-xl border border-border/70 p-4">
            <h3 className="text-sm font-semibold">{group.title}</h3>
            <dl className="mt-2 space-y-2 text-sm">
              {group.fields.map((field) => (
                <div key={field.label}>
                  <dt className="text-xs text-muted">{field.label}</dt>
                  <dd className={field.value ? "break-words" : "text-muted"}>{field.value ?? "Nothing read"}</dd>
                  {/* what looks wrong and how to fix it */}
                  {field.problem && (
                    <dd className="mt-1 flex items-start gap-1.5 text-xs text-warning">
                      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                      <span>{field.problem}</span>
                    </dd>
                  )}
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </section>
  );
}
