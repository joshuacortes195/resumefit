import { CircleHelp } from "lucide-react";

// a small question mark that explains something when you hover or tab onto it
export function Hint({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span className="group relative inline-flex print:hidden">
      <button type="button" aria-label={label} className="rounded-full text-muted hover:text-foreground">
        <CircleHelp className="size-4" aria-hidden />
      </button>
      {/* the bubble, hidden until hover or focus */}
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 w-60 -translate-x-1/2 rounded-lg border border-border bg-surface p-3 text-left text-xs font-normal leading-relaxed text-foreground opacity-0 shadow-lg transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100"
      >
        {children}
      </span>
    </span>
  );
}
