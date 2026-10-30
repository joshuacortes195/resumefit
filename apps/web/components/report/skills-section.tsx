"use client";

import { useState } from "react";
import { Check, Copy, Plus, X } from "lucide-react";
import type { SkillSpan } from "@resumefit/scoring";
import type { SkillMatch } from "@resumefit/shared";
import { HighlightedText, HighlightLegend } from "@/components/report/highlighted-text";
import { LINK_BUTTON } from "@/components/ui/buttons";
import { Tabs } from "@/components/ui/tabs";

// how many rows show before "show more"
const FIRST_ROWS = 10;

type SkillsSectionProps = {
  kind: "hard" | "soft";
  skills: SkillMatch[];
  resumeText: string;
  spans: SkillSpan[];
  // skills that were added by hand, these can be removed again
  customNames: string[];
  readOnly: boolean;
  onAdd: () => void;
  onRemove: (name: string) => void;
};

// the skills table with its two views, comparison and highlighted
export function SkillsSection({ kind, skills, resumeText, spans, customNames, readOnly, onAdd, onRemove }: SkillsSectionProps) {
  const [view, setView] = useState<"compare" | "highlight">("compare");
  const [showAll, setShowAll] = useState(false);
  const [copied, setCopied] = useState(false);
  const missing = skills.filter((skill) => skill.match === "missing");
  // hard skills are split into what the posting requires and what it would like, required first. soft skills stay one list
  const split = kind === "hard" && skills.some((skill) => skill.importance === "required") && skills.some((skill) => skill.importance === "preferred");
  const rows = split ? [...skills.filter((skill) => skill.importance === "required"), ...skills.filter((skill) => skill.importance === "preferred")] : skills;

  // copies the missing skills as one comma separated line
  async function copyMissing() {
    await navigator.clipboard.writeText(missing.map((skill) => skill.name).join(", "));
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  const tabs = [
    { key: "compare" as const, label: "Skills comparison" },
    { key: "highlight" as const, label: "Highlighted skills" },
  ];

  return (
    <div>
      {/* switch between the table and the marked up resume */}
      <Tabs label={`${kind} skills views`} size="sm" className="print:hidden" tabs={tabs} value={view} onChange={setView} />

      {view === "compare" &&
        (skills.length === 0 ? (
          <p className="mt-4 text-sm text-muted">We did not find any {kind} skills in this job description, so this part is left out of your match rate. If you can see one we missed, add it below.</p>
        ) : (
          <table className="mt-2 w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th className="py-2 font-medium">
                  <span className="flex items-center gap-3">
                    Skill
                    {/* copies every missing skill in one go */}
                    {missing.length > 0 && (
                      <button type="button" onClick={copyMissing} className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary-hover print:hidden">
                        {copied ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
                        <span aria-live="polite">{copied ? "Copied" : "Copy all missing"}</span>
                      </button>
                    )}
                  </span>
                </th>
                <th className="w-28 py-2 text-center font-medium">Resume / Job</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((skill, index) => {
                const hidden = !showAll && index >= FIRST_ROWS ? "hidden print:table-row" : "";
                // a heading row where the required skills start and where the preferred ones start
                const heading = split && (index === 0 || rows[index - 1]?.importance !== skill.importance) ? (skill.importance === "required" ? "Required skills" : "Preferred skills") : null;
                return [
                  heading && (
                    <tr key={`${heading}-heading`} className={hidden}>
                      <th colSpan={2} scope="colgroup" className="pt-4 pb-1 text-left text-xs font-semibold tracking-wide text-muted uppercase">
                        {heading}
                      </th>
                    </tr>
                  ),
                  // rows past the first ten stay hidden until asked for, but always print
                  <tr key={skill.name} className={`border-b border-border last:border-0 ${hidden}`}>
                    <td className="py-2.5">
                      <span className="font-medium">{skill.name}</span>
                      {/* under the Preferred heading this is only read out, so a row still says it on its own */}
                      {skill.importance === "preferred" && <span className={split ? "sr-only" : "ml-2 text-xs text-muted"}>nice to have</span>}
                      {/* any one skill from a list like "Java, Python, or Go" is enough */}
                      {skill.options && skill.options.length > 0 && (
                        <span className="ml-2 text-xs text-muted" title={`Any one of these is enough: ${[skill.name, ...skill.options].join(", ")}`}>
                          or {skill.options.slice(0, 3).join(", ")}
                          {skill.options.length > 3 && ` and ${skill.options.length - 3} more`}
                        </span>
                      )}
                      {skill.light && (
                        <span className="ml-2 text-xs text-muted" title="Only a nice to have or general wording in the posting, so it counts for less">
                          counts less
                        </span>
                      )}
                      {customNames.includes(skill.name) && !readOnly && (
                        <button type="button" onClick={() => onRemove(skill.name)} className="ml-2 text-xs text-muted underline hover:text-danger print:hidden">
                          remove
                        </button>
                      )}
                    </td>
                    {/* how many times the resume says it next to how many times the posting does, like 5/3 */}
                    <td className="py-2.5 text-center tabular-nums" title={`In your resume ${skill.resumeCount} ${skill.resumeCount === 1 ? "time" : "times"}, in the job description ${skill.jdCount}`}>
                      {skill.match === "exact" && (
                        <span className="inline-flex items-center gap-1 text-success">
                          <Check className="size-4" aria-hidden />
                          <span className="sr-only">In your resume </span>
                          {skill.resumeCount}/{skill.jdCount}
                        </span>
                      )}
                      {skill.match === "related" && (
                        <span className="inline-flex items-center gap-1 font-semibold text-warning" title="A similar term is in your resume. It counts for half.">
                          ~<span className="sr-only">Similar term found, counts for half. </span>
                          {skill.resumeCount}/{skill.jdCount}
                        </span>
                      )}
                      {skill.match === "missing" && (
                        <span className="inline-flex items-center gap-1 text-danger">
                          <X className="size-4" aria-hidden />
                          <span className="sr-only">Missing from your resume </span>
                          {skill.resumeCount}/{skill.jdCount}
                        </span>
                      )}
                    </td>
                  </tr>,
                ];
              })}
            </tbody>
          </table>
        ))}

      {view === "compare" && skills.length > FIRST_ROWS && (
        <button type="button" onClick={() => setShowAll((open) => !open)} className={`mt-3 text-sm print:hidden ${LINK_BUTTON}`}>
          {showAll ? "Show fewer" : `Show ${skills.length - FIRST_ROWS} more`}
        </button>
      )}

      {/* the resume with found skills marked, and the missing ones listed under it */}
      {view === "highlight" && (
        <div className="mt-4 space-y-4">
          <HighlightLegend only="found" />
          <div className="max-h-96 overflow-y-auto rounded-lg bg-background p-4">
            <HighlightedText text={resumeText} spans={spans} skills={skills} only="found" />
          </div>
          {missing.length > 0 && (
            <div>
              <p className="text-sm font-medium">Missing from your resume</p>
              <ul className="mt-2 flex flex-wrap gap-1.5 text-xs">
                {missing.map((skill) => (
                  <li key={skill.name} className="rounded-sm px-1.5 py-0.5 outline-1 outline-dashed outline-danger">
                    {skill.name}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* lets people add a skill our lists did not catch */}
      {!readOnly && (
        <p className="mt-4 text-sm text-muted print:hidden">
          Don&apos;t see a skill from the job description?{" "}
          <button type="button" onClick={onAdd} className={`inline-flex items-center gap-1 ${LINK_BUTTON}`}>
            <Plus className="size-3.5" aria-hidden />
            Add skill
          </button>
        </p>
      )}
    </div>
  );
}
