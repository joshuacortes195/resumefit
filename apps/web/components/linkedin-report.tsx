"use client";

import { useState, useTransition } from "react";
import { Check, Copy, Sparkles } from "lucide-react";
import type { LinkedinReport, LinkedinSectionKey } from "@resumefit/scoring";
import { rewriteLinkedin } from "@/app/actions/practice";
import { AiNotice } from "@/components/ai-notice";
import { ScoreRing } from "@/components/score-ring";
import { CARD, LINK_BUTTON, SECONDARY_BUTTON } from "@/components/ui/buttons";
import { StatusIcon } from "@/components/ui/status-icon";

// the four parts of the profile, in report order
const SECTIONS: { key: LinkedinSectionKey; label: string; blurb: string }[] = [
  { key: "headline", label: "Headline", blurb: "The line under your name. It shows next to your face in every search result, so it does the most work." },
  { key: "about", label: "About", blurb: "Your own words on what you do. Recruiters skim the first three lines, the search reads all of it." },
  { key: "experience", label: "Experience", blurb: "Where the proof is. Descriptions under each role are searched just like a resume." },
  { key: "skills", label: "Skills", blurb: "Recruiters filter candidates by the skills listed here, so the exact names matter." },
];

type ReportProps = { id: string; score: number; report: LinkedinReport; ai: { available: boolean; remaining: number | null } };

// the linkedin report: overall score, a card per part, the keyword table and the rewrite helpers
export function LinkedinReportView({ id, score, report, ai }: ReportProps) {
  const [drafts, setDrafts] = useState<Partial<Record<"headline" | "about", string[]>>>({});
  const [remaining, setRemaining] = useState(ai.remaining);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [busy, setBusy] = useState<"headline" | "about" | null>(null);
  const [, startTransition] = useTransition();

  // asks for new wording for the headline or the about section
  function rewrite(part: "headline" | "about") {
    setBusy(part);
    setError(null);
    startTransition(async () => {
      const result = await rewriteLinkedin(id, part);
      if (result.ok) {
        setDrafts((all) => ({ ...all, [part]: result.options }));
        setRemaining(result.remaining);
      } else setError(result.error);
      setBusy(null);
    });
  }

  const missing = report.keywords.filter((keyword) => keyword.match === "missing");
  const sorted = [...report.keywords].sort((a, b) => Number(a.match !== "missing") - Number(b.match !== "missing") || b.jdCount - a.jdCount);

  return (
    <div className="space-y-6">
      {/* overall score and one bar per part */}
      <section className={`${CARD} grid gap-6 p-6 md:grid-cols-[auto_1fr] md:items-center`}>
        <div className="flex flex-col items-center gap-2">
          <ScoreRing score={score} size="lg" label="LinkedIn score" />
          <p className="text-sm text-muted">{report.jobTitles.length > 0 ? `Against ${report.jobTitles.join(" and ")}` : "Against the jobs you added"}</p>
        </div>
        <ul className="space-y-3.5">
          {SECTIONS.map(({ key, label }) => (
            <li key={key}>
              <div className="flex justify-between text-sm">
                <a href={`#${key}`} className="font-medium hover:text-primary">
                  {label}
                </a>
                <span className="tabular-nums text-muted">{report.sections[key].score}%</span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-border">
                <div className="h-full origin-left animate-bar rounded-full bg-primary" style={{ width: `${report.sections[key].score}%` }} />
              </div>
            </li>
          ))}
        </ul>
      </section>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      {SECTIONS.map(({ key, label, blurb }) => (
        <section key={key} id={key} className={`${CARD} scroll-mt-20 p-6`}>
          <h2 className="text-xl font-semibold">{label}</h2>
          <p className="mt-1 max-w-prose text-sm text-muted">{blurb}</p>
          <ul className="mt-4 space-y-2.5">
            {report.sections[key].tips.map((tip) => (
              <li key={tip.id} className="flex gap-2.5 text-sm">
                <StatusIcon status={tip.passed ? "pass" : "fail"} />
                <span>{tip.message}</span>
              </li>
            ))}
          </ul>

          {/* new wording for the headline and the about section */}
          {(key === "headline" || key === "about") && (
            <div className="mt-5 space-y-3 border-t border-border pt-4">
              <button type="button" disabled={busy !== null || !ai.available} onClick={() => rewrite(key)} className={SECONDARY_BUTTON}>
                <Sparkles className="size-4" aria-hidden />
                {busy === key ? "Writing..." : key === "headline" ? "Suggest 3 headlines" : "Rewrite my About section"}
              </button>
              {(drafts[key] ?? []).map((option) => (
                <div key={option} className="rounded-xl border border-border p-3 text-sm">
                  <p className="whitespace-pre-wrap">{option}</p>
                  <button
                    type="button"
                    onClick={async () => {
                      await navigator.clipboard.writeText(option);
                      setCopied(option);
                      setTimeout(() => setCopied(null), 1500);
                    }}
                    className={`mt-2 inline-flex items-center gap-1 ${LINK_BUTTON}`}
                  >
                    {copied === option ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
                    {copied === option ? "Copied" : "Copy"}
                  </button>
                </div>
              ))}
              <AiNotice available={ai.available} remaining={remaining} />
            </div>
          )}
        </section>
      ))}

      {/* every keyword from the jobs, missing ones first */}
      <section className={`${CARD} p-6`}>
        <h2 className="text-xl font-semibold">Keywords from your target jobs</h2>
        <p className="mt-1 text-sm text-muted">{missing.length === 0 ? "Your profile mentions every skill we found in these jobs." : `${missing.length} of ${report.keywords.length} are missing from your profile. Add the ones you really have, to your skills list first.`}</p>
        {sorted.length > 0 && (
          <table className="mt-4 w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th className="py-2 font-medium">Skill</th>
                <th className="w-24 py-2 text-center font-medium">Your profile</th>
                <th className="w-24 py-2 text-center font-medium">Target jobs</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((keyword) => (
                <tr key={keyword.name} className="border-b border-border last:border-0">
                  <td className="py-2.5 font-medium">
                    {keyword.name}
                    {keyword.category === "soft" && <span className="ml-2 text-xs font-normal text-muted">soft skill</span>}
                  </td>
                  <td className="py-2.5 text-center">
                    <span className="inline-flex items-center gap-1 tabular-nums">
                      <StatusIcon status={keyword.match === "missing" ? "fail" : "pass"} />
                      {keyword.resumeCount > 0 ? keyword.resumeCount : ""}
                    </span>
                  </td>
                  <td className="py-2.5 text-center tabular-nums">{keyword.jdCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
