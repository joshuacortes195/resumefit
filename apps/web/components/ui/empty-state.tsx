import type { LucideIcon } from "lucide-react";

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  text: string;
  // a button or link that gets the person started
  children?: React.ReactNode;
};

// what a page shows when there is nothing in it yet
export function EmptyState({ icon: Icon, title, text, children }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-border bg-transparent px-6 py-14 text-center">
      {/* a little blueprint tile: a dashed ring turning slowly and the icon floating in a clay bubble */}
      <span aria-hidden className="blueprint blueprint-grid relative grid size-28 place-items-center rounded-2xl">
        <svg viewBox="0 0 100 100" className="absolute inset-0 size-full" fill="none">
          <circle className="spin-slow" cx="50" cy="50" r="38" stroke="var(--bp-line)" strokeOpacity="0.5" strokeDasharray="3 5" />
          <circle className="spin-slow-back" cx="50" cy="50" r="28" stroke="var(--bp-hot)" strokeOpacity="0.6" strokeDasharray="10 8" />
        </svg>
        <span className="clay float relative flex size-12 items-center justify-center rounded-full bg-[var(--clay-cloud)]">
          <Icon className="size-6" />
        </span>
      </span>
      <p className="mt-4 font-medium">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-muted">{text}</p>
      {children && <div className="mt-5">{children}</div>}
    </div>
  );
}
