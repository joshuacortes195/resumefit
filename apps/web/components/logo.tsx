import Link from "next/link";

// app logo, the mark is a little score ring
export function Logo({ showName = true }: { showName?: boolean }) {
  return (
    <Link href="/dashboard" className="flex items-center gap-2 font-semibold tracking-tight">
      <svg viewBox="0 0 32 32" className="size-7 shrink-0" aria-hidden>
        <circle cx="16" cy="16" r="12" fill="none" stroke="var(--marker)" strokeWidth="4" />
        <circle
          cx="16"
          cy="16"
          r="12"
          fill="none"
          stroke="var(--foreground)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray="57 76"
          transform="rotate(-90 16 16)"
        />
      </svg>
      {showName && <span className="text-lg">ResumeFit</span>}
    </Link>
  );
}
