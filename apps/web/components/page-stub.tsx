import type { LucideIcon } from "lucide-react";

type PageStubProps = {
  title: string;
  blurb: string;
  icon: LucideIcon;
};

// placeholder shown on pages that are not built yet
export function PageStub({ title, blurb, icon: Icon }: PageStubProps) {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-3xl font-semibold">{title}</h1>
      <p className="mt-1 text-muted">{blurb}</p>

      {/* empty state card */}
      <div className="mt-8 flex flex-col items-center rounded-2xl border border-dashed border-border bg-surface px-6 py-16 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-primary-soft text-primary">
          <Icon className="size-6" aria-hidden />
        </span>
        <p className="mt-4 font-medium">This page is on the way</p>
        <p className="mt-1 max-w-sm text-sm text-muted">The layout and navigation are in place. The feature itself lands in an upcoming build.</p>
      </div>
    </div>
  );
}
