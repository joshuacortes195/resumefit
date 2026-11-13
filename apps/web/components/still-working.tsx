"use client";

import { useEffect, useState } from "react";

// how long a writing request can run before we say something. the first model gets 15 seconds before the next one is tried
export const SLOW_AFTER_MS = 8_000;

// a line that shows up when a writing request has been running a while, so a slow model does not look like a stuck button
export function StillWorking({ active }: { active: boolean }) {
  // which request the line is showing for. it only counts while that same request is still running
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    return () => {
      clearTimeout(timer);
      setSlow(false);
    };
  }, [active]);

  if (!active || !slow) return null;
  return (
    <p role="status" className="animate-fade text-xs font-medium text-foreground">
      Still working, trying another model...
    </p>
  );
}
