"use client";

import { useState } from "react";
import { Check, Copy, Plus, X } from "lucide-react";
import type { SkillSpan } from "@resumefit/scoring";
import type { SkillMatch } from "@resumefit/shared";
import { HighlightedText, HighlightLegend } from "@/components/report/highlighted-text";
import { LINK_BUTTON } from "@/components/ui/buttons";

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
      <div role="tablist" aria-label={`${kind} skills views`} className="flex gap-5 border-b border-border text-sm font-medium print:hidden">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={view === tab.key}
            onClick={() => setView(tab.key)}
            className={`-mb-px border-b-2 pb-2 transition-colors duration-150 ${view === tab.key ? "border-primary text-foreground" : "border-transparent text-muted hover:text-foreground"}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {view === "compare" &&
        (skills.length === 0 ? (
          <p className="mt-4 text-sm text-muted">We did not find any {kind} skills in this job description. If you can see one we missed, add it below.</p>
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
                <th className="w-20 py-2 text-center font-medium">Resume</th>
                <th className="w-28 py-2 text-center font-medium">Job description</th>
              </tr>
            </thead>
            <tbody>
              {skills.map((skill, index) => (
                // rows past the first ten stay hidden until asked for, but always print
                <tr key={skill.name} className={`border-b border-border last:border-0 ${!showAll && index >= FIRST_ROWS ? "hidden print:table-row" : ""}`}>
                  <td className="py-2.5">
                    <span className="font-medium">{skill.name}</span>
                    {skill.importance === "preferred" && <span className="ml-2 text-xs text-muted">nice to have</span>}
                    {customNames.includes(skill.name) && !readOnly && (
                      <button type="button" onClick={() => onRemove(skill.name)} className="ml-2 text-xs text-muted underline hover:text-danger print:hidden">
                        remove
                      </button>
                    )}
                  </td>
                  <td className="py-2.5 text-center tabular-nums">
                    {skill.match === "exact" && (
                      <span className="inline-flex items-center gap-1 text-success">
                        <Check className="size-4" aria-hidden />
                        {skill.resumeCount}
                        <span className="sr-only"> in your resume</span>
                      </span>
                    )}
                    {skill.match === "related" && (
                      <span className="font-semibold text-warning" title="A similar term is in your resume. It counts for half.">
                        ~<span className="sr-only">Similar term found, counts for half</span>
                      </span>
                    )}
                    {skill.match === "missing" && (
                      <span className="inline-flex text-danger">
                        <X className="size-4" aria-hidden />
                        <span className="sr-only">Missing from your resume</span>
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 text-center tabular-nums">{skill.jdCount}</td>
                </tr>
              ))}
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
