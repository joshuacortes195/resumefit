"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

type TabsProps<Key extends string> = {
  // what the row of tabs is for, read out by screen readers
  label: string;
  tabs: readonly { key: Key; label: string }[];
  value: Key;
  onChange: (key: Key) => void;
  // line: words with a bar under the current one. pill: a small switch with a white pill behind the current one
  look?: "line" | "pill";
  size?: "md" | "sm";
  className?: string;
  // anything else that sits at the end of the row, like a button
  children?: React.ReactNode;
};

// the browser only, so the server render does not complain about measuring
const useMeasure = typeof window === "undefined" ? useEffect : useLayoutEffect;

// a row of tabs. the marker under the current tab slides across to the one you pick
export function Tabs<Key extends string>({ label, tabs, value, onChange, look = "line", size = "md", className = "", children }: TabsProps<Key>) {
  const list = useRef<HTMLDivElement>(null);
  // where the marker sits: how far from the left and how wide. null until it has been measured
  const [marker, setMarker] = useState<{ left: number; width: number } | null>(null);
  // the first placement is instant, every move after that slides
  const [slides, setSlides] = useState(false);

  // puts the marker under the current tab, again whenever the row changes size
  useMeasure(() => {
    const row = list.current;
    if (!row) return;
    const place = () => {
      const current = row.querySelector<HTMLElement>('[aria-selected="true"]');
      if (current) setMarker({ left: current.offsetLeft, width: current.offsetWidth });
    };
    place();
    const watcher = new ResizeObserver(place);
    watcher.observe(row);
    return () => watcher.disconnect();
  }, [value, tabs.length]);

  // turn the slide on one frame after the marker first shows
  useEffect(() => {
    if (!marker || slides) return;
    const frame = requestAnimationFrame(() => setSlides(true));
    return () => cancelAnimationFrame(frame);
  }, [marker, slides]);

  const line = look === "line";
  return (
    <div ref={list} role="tablist" aria-label={label} className={`relative flex font-medium ${line ? `border-b border-border ${size === "md" ? "gap-6" : "gap-5 text-sm"}` : "gap-1 rounded-lg bg-background p-1 text-xs"} ${className}`}>
      {/* the marker: a bar under the tab, or a white pill behind it */}
      {marker && (
        <span
          aria-hidden
          style={{ width: marker.width, transform: `translateX(${marker.left}px)` }}
          className={`pointer-events-none absolute left-0 ${line ? "-bottom-px h-0.5 rounded-full bg-primary" : "inset-y-1 rounded-md bg-surface shadow-sm"} ${slides ? "transition-[transform,width] duration-250 ease-settle" : ""}`}
        />
      )}
      {tabs.map((tab) => {
        const current = tab.key === value;
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={current}
            onClick={() => onChange(tab.key)}
            // until the marker has been measured, the current tab draws its own bar or pill so nothing flickers
            className={`relative transition-colors duration-150 ${current ? "text-foreground" : "text-muted hover:text-foreground"} ${
              line ? `-mb-px border-b-2 ${size === "md" ? "pb-3" : "pb-2"} ${current && !marker ? "border-primary" : "border-transparent"}` : `rounded-md px-2.5 py-1 ${current && !marker ? "bg-surface shadow-sm" : ""}`
            }`}
          >
            {tab.label}
          </button>
        );
      })}
      {children}
    </div>
  );
}
