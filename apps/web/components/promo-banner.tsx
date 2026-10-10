"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X, Zap } from "lucide-react";

// remembers that the banner was closed
const STORAGE_KEY = "resumefit-hide-auto-apply-banner";

// banner on the dashboard that points at auto apply, stays gone once closed
export function PromoBanner() {
  // starts hidden so it does not flash for people who closed it
  const [visible, setVisible] = useState(false);

  // browser storage is only there after the page loads
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVisible(localStorage.getItem(STORAGE_KEY) !== "1");
  }, []);

  if (!visible) return null;
  return (
    <div className="flex animate-rise items-center gap-3 rounded-xl border border-primary/25 bg-primary-soft px-4 py-3 text-sm">
      <Zap className="size-4 shrink-0 text-primary" aria-hidden />
      <p className="flex-1">
        <strong>Auto Apply</strong> fills out applications for you. You review and press submit, or let it send the finished ones.{" "}
        <Link href="/auto-apply" className="font-semibold text-primary hover:underline">
          See how it works
        </Link>
      </p>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => {
          localStorage.setItem(STORAGE_KEY, "1");
          setVisible(false);
        }}
        className="rounded-lg p-1 text-muted hover:bg-surface hover:text-foreground"
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}
