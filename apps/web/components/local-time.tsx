"use client";

import { useSyncExternalStore } from "react";

// the ways a date is written around the app
const STYLES = {
  // Oct 8, 2026
  date: { month: "short", day: "numeric", year: "numeric" },
  // Oct 8
  day: { month: "short", day: "numeric" },
  // Oct 8, 3:30 PM
  time: { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" },
  // Thu, Oct 8, 3:30 PM
  weekdayTime: { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" },
  // Thu, Oct 8, 2026, 3:30 PM
  full: { weekday: "short", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" },
} as const satisfies Record<string, Intl.DateTimeFormatOptions>;

// true once the page is running in the browser
const noChange = () => () => undefined;
export const useInBrowser = () => useSyncExternalStore(noChange, () => true, () => false);

// writes a date in a given style and timezone
export function formatWhen(value: Date | string, style: keyof typeof STYLES, timeZone?: string): string {
  return new Intl.DateTimeFormat("en-US", { ...STYLES[style], timeZone }).format(new Date(value));
}

// a date or time shown in the reader's own timezone.
// the server does not know that timezone, so it writes the date in UTC, and the browser's first pass writes exactly the same thing.
// that keeps the two in step, which react insists on. straight after, the browser swaps in the local date.
// without this, a date near midnight came out as one day on the server and another in the browser, and the page threw an error
export function LocalTime({ value, style = "date" }: { value: Date | string; style?: keyof typeof STYLES }) {
  const inBrowser = useInBrowser();
  const iso = new Date(value).toISOString();
  return <time dateTime={iso}>{formatWhen(iso, style, inBrowser ? undefined : "UTC")}</time>;
}
