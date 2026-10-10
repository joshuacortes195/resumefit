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
      <span className="flex size-12 items-center justify-center rounded-full bg-primary-soft text-primary">
        <Icon className="size-6" aria-hidden />
      </span>
      <p className="mt-4 font-medium">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-muted">{text}</p>
      {children && <div className="mt-5">{children}</div>}
    </div>
  );
}
