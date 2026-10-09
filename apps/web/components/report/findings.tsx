"use client";

import { useState } from "react";
import type { Check, CheckGroup } from "@resumefit/scoring";
import { GROUPS } from "@/components/report/copy";
import { LINK_BUTTON } from "@/components/ui/buttons";
import { Hint } from "@/components/ui/hint";
import { StatusIcon } from "@/components/ui/status-icon";

type FindingsProps = {
  checks: Check[];
  // links shown under a row, like "Update scan information"
  actions?: Partial<Record<CheckGroup, { label: string; onClick: () => void }>>;
};

// the card of pass and fail findings, grouped into rows by what they check
export function Findings({ checks, actions = {} }: FindingsProps) {
  // keep the groups in the order their first check shows up
  const groups = [...new Set(checks.map((check) => check.group))];

  return (
    <dl className="divide-y divide-border rounded-xl border border-border">
      {groups.map((group) => (
        <div key={group} className="grid gap-2 p-4 sm:grid-cols-[11rem_1fr] sm:gap-6">
          {/* row name with its explanation */}
          <dt className="flex items-start gap-1.5 text-sm font-semibold">
            {GROUPS[group].label}
            <Hint label={`About ${GROUPS[group].label.toLowerCase()}`}>{GROUPS[group].hint}</Hint>
          </dt>
          <dd className="space-y-2.5">
            {checks
              .filter((check) => check.group === group)
              .map((check) => (
                <Finding key={check.id} check={check} />
              ))}
            {actions[group] && (
              <button type="button" onClick={actions[group].onClick} className={`text-sm print:hidden ${LINK_BUTTON}`}>
                {actions[group].label}
              </button>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

// one finding, with a list that opens when there is more to show
function Finding({ check }: { check: Check }) {
  const [open, setOpen] = useState(false);
  const details = check.details ?? [];
  // what the button says depends on which finding it is
  const label = check.id === "measurable-results" ? (check.passed ? "View measurable results" : "View bullets that could use a number") : "View details";

  return (
    <div className="text-sm">
      <p className="flex gap-2.5">
        <StatusIcon status={check.info ? "info" : check.passed ? "pass" : "fail"} />
        <span>{check.message}</span>
      </p>
      {details.length > 0 && (
        <div className="ml-6.5 mt-1">
          <button type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)} className={`print:hidden ${LINK_BUTTON}`}>
            {open ? "Hide" : label}
          </button>
          <ul className={`mt-2 list-disc space-y-1 pl-5 text-muted ${open ? "animate-rise" : "hidden print:block"}`}>
            {details.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
