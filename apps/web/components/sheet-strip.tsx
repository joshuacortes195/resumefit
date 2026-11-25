"use client";

import type { CSSProperties } from "react";
import { usePathname } from "next/navigation";
import { sheetOf, type DrawingKey } from "@/lib/sheets";

// the blue title strip at the top of every page in the app: its sheet number, a line drawing of what the page does and a floating tip
export function SheetStrip() {
  const sheet = sheetOf(usePathname());
  if (!sheet) return null;
  // the bubble wears the page's own soft color
  const bubble = { background: sheet.section ? `var(--s-${sheet.section})` : "var(--clay-cloud)" } as CSSProperties;
  return (
    // keyed on the sheet so the drawing traces in again when you move to another page
    <div key={sheet.no} className="blueprint blueprint-grid relative overflow-hidden border-y border-[var(--bp-deep)] bg-[var(--bp-deep)]! print:hidden" aria-hidden>
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 md:px-8">
        {/* sheet number and the small print, like the corner of a drawing */}
        <div className="min-w-0 font-drawing text-[11px] uppercase leading-5 tracking-[0.1em]">
          <p className="text-[var(--bp-hot)]">Sheet {sheet.no}</p>
          <p className="truncate text-[var(--bp-muted)]">{sheet.spec}</p>
        </div>

        {/* the tip, a clay bubble that bobs a little */}
        <span style={bubble} className="clay float ml-auto shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold max-[420px]:hidden">
          {sheet.tip}
        </span>

        {/* the drawing for this page, wide screens only */}
        <svg viewBox="0 0 240 72" className="hidden h-[72px] w-[240px] shrink-0 md:block" fill="none" stroke="var(--bp-line)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <Drawing name={sheet.drawing} />
        </svg>
      </div>
    </div>
  );
}

// a shape that traces itself in, the length is fixed so every line takes the same time
function T(props: React.SVGProps<SVGPathElement>) {
  return <path pathLength={1000} className="trace" {...props} />;
}

// a yellow callout: a lettered circle with a leader line to what it points at
function Callout({ x, y, toX, toY, letter }: { x: number; y: number; toX: number; toY: number; letter: string }) {
  return (
    <g stroke="var(--bp-hot)">
      <line x1={x} y1={y} x2={toX} y2={toY} strokeDasharray="3 3" />
      <circle cx={x} cy={y} r="8" fill="var(--bp-deep)" />
      <text x={x} y={y + 3.5} textAnchor="middle" fontSize="10" fill="var(--bp-hot)" stroke="none" fontFamily="var(--font-drawing)">
        {letter}
      </text>
    </g>
  );
}

// a dimension line with arrow ticks at both ends and a size written in the middle
function Dim({ x1, x2, y, label }: { x1: number; x2: number; y: number; label: string }) {
  return (
    <g strokeWidth="1" opacity="0.7">
      <line x1={x1} y1={y} x2={x2} y2={y} />
      <line x1={x1} y1={y - 4} x2={x1} y2={y + 4} />
      <line x1={x2} y1={y - 4} x2={x2} y2={y + 4} />
      <text x={(x1 + x2) / 2} y={y - 4} textAnchor="middle" fontSize="8" fill="var(--bp-muted)" stroke="none" fontFamily="var(--font-drawing)">
        {label}
      </text>
    </g>
  );
}

// one drawing per kind of page
function Drawing({ name }: { name: DrawingKey }) {
  switch (name) {
    // the dashboard: a scan card next to a little board
    case "dashboard":
      return (
        <>
          <T d="M20 8h70v52H20z" />
          <T d="M30 20h40M30 30h50M30 40h30" />
          <T d="M110 8h110v52H110zM146 8v52M183 8v52" />
          <T d="M116 16h24v10h-24zM152 16h24v10h-24zM152 30h24v10h-24zM189 16h24v10h-24z" />
          <Dim x1={20} x2={90} y={68} label="scan" />
          <Callout x={232} y={64} toX={213} toY={26} letter="A" />
        </>
      );
    // scans: a resume page under a magnifier
    case "scan":
      return (
        <>
          <T d="M60 6h56l12 12v48H60z" />
          <T d="M116 6v12h12" />
          <T d="M70 22h30M70 32h46M70 42h40M70 52h36" />
          <T d="M152 30a20 20 0 1 0 40 0a20 20 0 1 0-40 0M186 44l18 18" />
          <T d="M172 18v24M160 30h24" opacity="0.6" />
          <Dim x1={60} x2={128} y={70} label="1 page" />
          <Callout x={30} y={22} toX={70} toY={32} letter="B" />
        </>
      );
    // new scan: a resume and a job posting feeding into one score
    case "newscan":
      return (
        <>
          <T d="M20 6h44v58H20zM28 18h28M28 28h22M28 38h28" />
          <T d="M84 6h44v58H84zM92 18h28M92 28h28M92 38h18" />
          <T d="M64 36h20" />
          <T d="M128 36h30M150 30l8 6-8 6" />
          <T d="M170 36a22 22 0 1 0 44 0a22 22 0 1 0-44 0" />
          <text x="192" y="41" textAnchor="middle" fontSize="14" fill="var(--bp-hot)" stroke="none" fontFamily="var(--font-drawing)">
            ?
          </text>
          <Dim x1={20} x2={128} y={70} label="resume + job" />
        </>
      );
    // application profile: an id card with the fields filled once
    case "profile":
      return (
        <>
          <T d="M50 8h140v56H50z" />
          <T d="M62 20h36v32H62zM80 30a6 6 0 1 0 0.1 0M68 50c2-8 22-8 24 0" />
          <T d="M110 22h66M110 32h50M110 42h66M110 52h40" />
          <Callout x={218} y={20} toX={176} toY={22} letter="1" />
        </>
      );
    // optimize: rev a, an arrow, rev b
    case "optimize":
      return (
        <>
          <T d="M20 8h60v56H20z" />
          <T d="M30 20h40M30 30h30M30 40h40M30 50h26" />
          <T d="M96 36h40M128 28l8 8-8 8" />
          <T d="M152 8h60v56h-60z" />
          <T d="M162 20h40M162 30h40M162 40h40M162 50h40" />
          <Callout x={228} y={14} toX={202} toY={30} letter="+" />
        </>
      );
    // cover letter: an envelope with the letter half out
    case "letter":
      return (
        <>
          <T d="M74 10h76v34H74z" />
          <T d="M84 20h40M84 28h56M84 36h30" />
          <T d="M60 30h104v38H60z" />
          <T d="M60 30l52 22 52-22" />
          <Dim x1={60} x2={164} y={4} label="1 page" />
          <Callout x={196} y={54} toX={164} toY={50} letter="C" />
        </>
      );
    // linkedin: a profile card with a headline line marked
    case "linkedin":
      return (
        <>
          <T d="M40 6h150v60H40z" />
          <T d="M40 26h150" />
          <T d="M58 26a14 14 0 1 0 28 0a14 14 0 1 0-28 0" />
          <T d="M98 34h74M58 48h110M58 56h80" />
          <Callout x={214} y={34} toX={172} toY={34} letter="A" />
        </>
      );
    // tracker: four columns with cards that move right
    case "tracker":
      return (
        <>
          <T d="M10 6h220v60H10zM65 6v60M120 6v60M175 6v60" />
          <T d="M18 14h40v12H18zM18 30h40v12H18zM73 14h40v12H73zM128 14h40v12h-40zM183 14h40v12h-40z" />
          <T d="M60 52h50M104 48l6 4-6 4" stroke="var(--bp-hot)" />
        </>
      );
    // auto apply: a form with a paper plane taking off
    case "apply":
      return (
        <>
          <T d="M20 8h80v56H20z" />
          <T d="M30 18h60v8H30zM30 32h60v8H30zM30 46h36v8H30z" />
          <T d="M140 46l80-34-26 50-14-16zM180 46l40-34" />
          {/* dashed flight path, left out of the trace so it keeps its dashes */}
          <path d="M100 50c14 0 22-4 40-4" strokeDasharray="4 4" />
          <Callout x={110} y={14} toX={90} toY={22} letter="?" />
        </>
      );
    // results: bars with a dimension on the tallest
    case "stats":
      return (
        <>
          <T d="M20 64h200" />
          <T d="M36 64V44h22v20M76 64V30h22v20M116 64V18h22v46M156 64V38h22v26" />
          <path d="M200 18v46" strokeDasharray="3 3" />
          <Dim x1={116} x2={138} y={10} label="offer" />
        </>
      );
    // find jobs: a grid of postings with one picked out
    case "jobs":
      return (
        <>
          <T d="M20 8h50v24H20zM80 8h50v24H80zM140 8h50v24h-50zM20 40h50v24H20zM80 40h50v24H80zM140 40h50v24h-50z" />
          <T d="M76 36a29 32 0 1 0 58 0a29 32 0 1 0-58 0" stroke="var(--bp-hot)" />
          <Callout x={222} y={20} toX={190} toY={20} letter="1" />
        </>
      );
    // builder: a page, a ruler along it and a pencil
    case "builder":
      return (
        <>
          <T d="M60 6h64v62H60z" />
          <T d="M70 18h44M70 28h30M70 38h44M70 48h36" />
          <T d="M40 6v62M36 14h4M36 26h4M36 38h4M36 50h4M36 62h4" />
          <T d="M150 60l50-50 10 10-50 50h-10z M190 20l10 10" />
          <Dim x1={60} x2={124} y={2} label="8.5 in" />
        </>
      );
    // resume manager: a stack of versions, the top one marked as base
    case "resumes":
      return (
        <>
          <T d="M80 20h56v48H80z" opacity="0.5" />
          <T d="M90 12h56v48H90z" opacity="0.75" />
          <T d="M100 4h56v48h-56z" />
          <T d="M110 16h34M110 26h26M110 36h34" />
          <Callout x={190} y={16} toX={156} toY={16} letter="B" />
        </>
      );
    // extension: a browser window with a puzzle piece in the corner
    case "extension":
      return (
        <>
          <T d="M30 6h180v60H30zM30 18h180" />
          <T d="M38 12h1M46 12h1M54 12h1" />
          <T d="M190 22h12v4a4 4 0 1 1 0 8v4h-12v-4a4 4 0 1 0 0-8z" stroke="var(--bp-hot)" />
          <T d="M44 30h80M44 40h110M44 50h70" />
        </>
      );
    // interview: two speech bubbles going back and forth
    case "interview":
      return (
        <>
          <T d="M30 8h90v30H54l-12 10v-10H30z" />
          <T d="M120 34h90v26h-12v10l-12-10h-66z" />
          <T d="M40 18h60M40 26h40M132 44h66M132 52h44" />
          <Callout x={20} y={60} toX={42} toY={48} letter="Q" />
        </>
      );
    // settings: a gear drawn as a ring with teeth
    case "settings":
      return (
        <>
          <T d="M96 36a24 24 0 1 0 48 0a24 24 0 1 0-48 0" />
          <T d="M110 36a10 10 0 1 0 20 0a10 10 0 1 0-20 0" />
          <T d="M120 4v8M120 60v8M88 36h8M144 36h8M97 13l6 6M137 53l6 6M143 13l-6 6M103 53l-6 6" />
          <Dim x1={96} x2={144} y={70} label="ø 48" />
        </>
      );
    // help: a life ring
    case "help":
      return (
        <>
          <T d="M90 36a30 30 0 1 0 60 0a30 30 0 1 0-60 0" />
          <T d="M106 36a14 14 0 1 0 28 0a14 14 0 1 0-28 0" />
          <T d="M120 6v16M120 50v16M90 36h16M134 36h16" stroke="var(--bp-hot)" />
        </>
      );
    // admin: a key
    case "admin":
      return (
        <>
          <T d="M60 36a16 16 0 1 0 32 0a16 16 0 1 0-32 0" />
          <T d="M92 36h90v12M162 36v10M146 36v8" />
          <Dim x1={60} x2={182} y={66} label="master" />
        </>
      );
  }
}
