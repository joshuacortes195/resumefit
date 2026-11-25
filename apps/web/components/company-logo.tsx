"use client";

import { useState } from "react";

// deep tints for the letter tile on the dark pages, picked by the company's name so each company always gets the same one
const TILES = ["var(--s-dashboard)", "var(--s-scans)", "var(--s-letter)", "var(--s-resumes)", "var(--s-tracker)", "var(--s-builder)", "var(--s-extension)", "var(--s-jobs)"];

// a company's logo from its own website, or a tile with its first letter when there is none
export function CompanyLogo({ company, domain, size = 36 }: { company: string; domain?: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const letter = (company.trim()[0] ?? "?").toUpperCase();
  const tile = TILES[[...company].reduce((total, char) => total + char.charCodeAt(0), 0) % TILES.length];

  if (!domain || failed) {
    return (
      <span aria-hidden className="flex shrink-0 items-center justify-center rounded-lg font-display font-semibold text-foreground" style={{ width: size, height: size, background: tile, fontSize: size * 0.45 }}>
        {letter}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://icons.duckduckgo.com/ip3/${domain}.ico`}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      // if the site has no icon, fall back to the letter tile
      onError={() => setFailed(true)}
      className="shrink-0 rounded-lg border border-border bg-white object-contain p-1"
      style={{ width: size, height: size }}
    />
  );
}
