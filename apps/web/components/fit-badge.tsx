import { fitLabel } from "@/lib/fit";

// how well a job suits the chosen resume, in words and as a number.
// this is a quick estimate, not a scan score, so it is a flat pill with "est." on it and never a score ring
export function FitBadge({ fit }: { fit: number | null }) {
  // nothing to show until a resume has been picked to compare with
  if (fit === null) return null;
  const label = fitLabel(fit) ?? "Low fit";
  // the strongest fits get the highlighter, the rest a quieter tint
  const look = fit >= 70 ? "bg-marker text-on-marker" : fit >= 50 ? "bg-primary-soft text-primary" : "border border-border text-muted";
  return (
    <span title="An estimate from the job title and the skills the posting names. Scan the job for its real match rate." className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${look}`}>
      {label}
      <span className="font-normal tabular-nums">est. {fit}%</span>
    </span>
  );
}
