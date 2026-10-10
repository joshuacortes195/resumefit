import { fitLabel } from "@/lib/fit";

// how well a job suits the chosen resume, in words and as a number
export function FitBadge({ fit }: { fit: number | null }) {
  const label = fitLabel(fit);
  if (fit === null || !label) return null;
  // the strongest fits get the highlighter, the rest a quieter tint
  const look = fit >= 70 ? "bg-marker text-on-marker" : fit >= 50 ? "bg-primary-soft text-primary" : "border border-border text-muted";
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${look}`}>
      {label}
      <span className="font-normal tabular-nums">{fit}%</span>
    </span>
  );
}
