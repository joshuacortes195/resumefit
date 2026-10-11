import Link from "next/link";

// app logo, the mark is a little resume page with one line highlighted
export function Logo({ showName = true }: { showName?: boolean }) {
  return (
    <Link href="/dashboard" className="flex items-center gap-2 font-semibold tracking-tight">
      <svg viewBox="0 0 32 32" className="size-7 shrink-0" aria-hidden>
        {/* the page */}
        <rect x="5" y="2" width="22" height="28" rx="5" fill="var(--primary)" />
        {/* plain lines of the resume */}
        <rect x="10" y="8" width="8" height="2.5" rx="1.25" fill="#fff" opacity="0.85" />
        <rect x="10" y="21.5" width="10" height="2.5" rx="1.25" fill="#fff" opacity="0.85" />
        {/* the line that matched, marked in yellow */}
        <rect x="9" y="13" width="14" height="6" rx="2" fill="var(--marker)" />
      </svg>
      {showName && <span className="text-lg">ResumeFit</span>}
    </Link>
  );
}
