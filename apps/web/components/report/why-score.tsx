import { explainScore, type ScanResult } from "@resumefit/scoring";
import { GROUPS, SECTIONS } from "@/components/report/copy";
import { LINK_BUTTON } from "@/components/ui/buttons";

// a number of points the way a person would say it: "3" or "0.4"
const points = (value: number) => (value === 0 ? "0" : value >= 1 ? String(Math.round(value)) : value.toFixed(1));

// where the match rate comes from, and the changes that would raise it the most.
// every number is the scorer's own: each gain is the resume scored again with that one thing fixed
export function WhyScore({ report, onJump }: { report: ScanResult; onJump: () => void }) {
  const why = explainScore(report);
  const label = (key: string) => SECTIONS.find((section) => section.key === key)?.label ?? key;
  return (
    <details className="mt-5 rounded-xl border border-border/70 bg-background/60 px-3.5 py-3 text-sm print:hidden">
      <summary className="cursor-pointer font-medium">Why {report.matchRate}%?</summary>

      {/* each part: how much of the whole it is, and how many of those points the resume earned */}
      <table className="mt-3 w-full text-left">
        <caption className="sr-only">Where the match rate comes from</caption>
        <thead>
          <tr className="text-xs text-muted">
            <th scope="col" className="pb-1 font-normal">Part</th>
            <th scope="col" className="pb-1 text-right font-normal">Points</th>
          </tr>
        </thead>
        <tbody>
          {why.parts.map((part) => (
            <tr key={part.category}>
              <th scope="row" className="py-0.5 font-normal">{label(part.category)}</th>
              <td className="py-0.5 text-right tabular-nums">
                {points(part.earned)} <span className="text-muted">of {points(part.possible)}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {why.heldAt !== null && <p className="mt-3 text-muted">The score is held at {why.heldAt}% for now, so no single fix below moves it until that changes.</p>}

      {/* the single changes worth the most, biggest first */}
      {why.fixes.length > 0 ? (
        <>
          <p className="mt-3 font-medium">Worth the most</p>
          <ul className="mt-1.5 space-y-1.5">
            {why.fixes.map((fix) => (
              <li key={`${fix.category}-${fix.name}`} className="flex items-baseline gap-2">
                <span className="w-11 shrink-0 font-semibold tabular-nums text-success">+{points(fix.gain)}</span>
                <a href={`#${fix.category}`} onClick={onJump} className={LINK_BUTTON}>
                  {fix.kind === "skill" ? `Add ${fix.name}` : `Fix: ${fix.group ? GROUPS[fix.group].label : fix.name}`}
                </a>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted">Only add a skill you really have. Each number is your resume scored again with that one thing fixed.</p>
        </>
      ) : (
        why.heldAt === null && <p className="mt-3 text-muted">Nothing left that would move the score.</p>
      )}
    </details>
  );
}
