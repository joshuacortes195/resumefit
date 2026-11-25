import type { CSSProperties, ReactNode } from "react";

// little blueprint drawings that play on a loop beside a page's title, in the same style as the landing page:
// a resume drawn like a part, yellow callouts and clay bubbles that pop in one after another.
// with reduced motion every part just sits there, all shown at once

// a delay for one part of the loop, in seconds
const at = (seconds: number) => ({ animationDelay: `${seconds}s` }) as CSSProperties;

// the blueprint panel a drawing sits in, with the page's own words beside it on wide screens
export function DrawingPanel({ children, drawing }: { children: ReactNode; drawing: ReactNode }) {
  return (
    <section className="blueprint blueprint-grid relative overflow-hidden rounded-2xl p-6 sm:p-8">
      <div className="grid items-center gap-6 md:grid-cols-[1fr_minmax(0,22rem)]">
        <div>{children}</div>
        {/* the drawing, a picture only, so screen readers skip it */}
        <div className="relative hidden md:block" aria-hidden>
          {drawing}
        </div>
      </div>
    </section>
  );
}

// a clay bubble placed over a drawing, popping in on its beat
function Pop({ text, color, place, delay }: { text: string; color: string; place: string; delay: number }) {
  return (
    <span style={{ background: color, ...at(delay) }} className={`clay pop-loop absolute whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-bold ${place}`}>
      {text}
    </span>
  );
}

// new scan: a resume page, a yellow scan line sweeping down it, and critiques popping up as it passes each one
export function InspectDrawing() {
  return (
    <div className="relative mx-auto w-full max-w-[22rem]">
      <svg viewBox="0 0 300 330" className="h-auto w-full" fill="none">
        {/* the page and its lines */}
        <rect x="60" y="14" width="180" height="290" stroke="var(--bp-line)" strokeWidth="1.5" fill="var(--bp-deep)" />
        <g stroke="var(--bp-muted)" strokeWidth="1.5" strokeLinecap="round">
          <path d="M80 40h80M80 70h130M80 84h110M80 98h96M80 140h130M80 154h90M80 196h130M80 210h70M80 252h120M80 266h100" />
        </g>
        {/* the yellow line of the scan running down the page */}
        <g className="sweep-loop">
          <rect x="60" y="14" width="180" height="22" fill="url(#sweep-glow)" />
          <line x1="60" y1="36" x2="240" y2="36" stroke="var(--bp-hot)" strokeWidth="2" />
        </g>
        <defs>
          <linearGradient id="sweep-glow" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--bp-hot)" stopOpacity="0" />
            <stop offset="1" stopColor="var(--bp-hot)" stopOpacity="0.3" />
          </linearGradient>
        </defs>
        {/* yellow circles on the lines that need work, each popping in as the line reaches it */}
        <g stroke="var(--bp-hot)" strokeWidth="2">
          <circle className="pop-loop" style={at(0.9)} cx="210" cy="70" r="9" />
          <circle className="pop-loop" style={at(1.9)} cx="170" cy="154" r="9" />
          <circle className="pop-loop" style={at(2.9)} cx="150" cy="210" r="9" />
        </g>
        {/* the score lands in the title block at the end */}
        <g className="pop-loop" style={at(3.8)}>
          <rect x="160" y="276" width="72" height="22" fill="var(--bp)" stroke="var(--bp-line)" />
          <text x="196" y="291" textAnchor="middle" fontSize="11" fill="var(--bp-hot)" fontFamily="var(--font-drawing)">
            62 / 100
          </text>
        </g>
      </svg>
      <Pop text="rename this heading" color="var(--clay-butter)" place="left-0 top-[16%]" delay={0.9} />
      <Pop text="+ add Docker" color="var(--clay-mint)" place="right-0 top-[42%]" delay={1.9} />
      <Pop text="add a number" color="var(--clay-peach)" place="left-[2%] top-[60%]" delay={2.9} />
    </div>
  );
}

// optimize: the same lines rewritten one at a time, each marked in yellow, and the score going from 62 to 80
export function RewriteDrawing() {
  return (
    <div className="relative mx-auto w-full max-w-[22rem]">
      <svg viewBox="0 0 300 300" className="h-auto w-full" fill="none">
        <rect x="50" y="14" width="200" height="270" stroke="var(--bp-line)" strokeWidth="1.5" fill="var(--bp-deep)" />
        {/* the yellow marks that sweep over the lines being rewritten */}
        <g fill="var(--bp-hot)" opacity="0.85">
          <rect className="mark-loop" style={at(0.6)} x="68" y="58" width="150" height="14" rx="2" />
          <rect className="mark-loop" style={at(1.6)} x="68" y="118" width="128" height="14" rx="2" />
          <rect className="mark-loop" style={at(2.6)} x="68" y="178" width="140" height="14" rx="2" />
        </g>
        <g stroke="var(--bp-muted)" strokeWidth="1.5" strokeLinecap="round">
          <path d="M70 36h90M70 65h146M70 85h120M70 125h124M70 145h100M70 185h136M70 205h110M70 240h130M70 254h90" />
        </g>
        {/* the score before and after, one fading into the other */}
        <text className="fade-out-loop" x="236" y="270" textAnchor="end" fontSize="26" fontWeight="800" fill="var(--bp-hot)" fontFamily="var(--font-display)">
          62
        </text>
        <text className="fade-in-loop" x="236" y="270" textAnchor="end" fontSize="26" fontWeight="800" fill="var(--bp-good)" fontFamily="var(--font-display)">
          80
        </text>
      </svg>
      <Pop text="+ shipped 40 releases" color="var(--clay-mint)" place="right-0 top-[18%]" delay={0.6} />
      <Pop text="Things I Did → Experience" color="var(--clay-butter)" place="left-0 top-[38%]" delay={1.6} />
      <Pop text="+ Docker" color="var(--clay-cloud)" place="right-[4%] top-[58%]" delay={2.6} />
    </div>
  );
}

// interview: a question pops up, the answer is typed, then the feedback lands
export function TalkDrawing() {
  return (
    <div className="relative mx-auto h-60 w-full max-w-[22rem] font-display text-sm">
      {/* the question */}
      <p style={at(0.3)} className="pop-loop absolute left-0 top-2 max-w-[80%] rounded-2xl rounded-bl-sm border border-[var(--bp-line)]/50 bg-[var(--bp-deep)] px-4 py-3 text-[var(--bp-text)]">
        Tell me about a time you shipped under a deadline.
      </p>
      {/* the dots while the answer is being typed */}
      <p style={at(1.2)} className="blink-loop absolute right-6 top-[5.5rem] flex gap-1" aria-hidden>
        <span className="size-2 rounded-full bg-[var(--bp-muted)]" />
        <span className="size-2 rounded-full bg-[var(--bp-muted)]" />
        <span className="size-2 rounded-full bg-[var(--bp-muted)]" />
      </p>
      {/* the answer */}
      <p style={at(2.2)} className="pop-loop clay absolute right-0 top-[5.5rem] max-w-[80%] rounded-2xl rounded-br-sm bg-[var(--clay-cloud)] px-4 py-3">
        We had two weeks, so I cut scope to the checkout and shipped in nine days.
      </p>
      {/* the feedback */}
      <span style={at(3.3)} className="pop-loop clay absolute bottom-2 left-4 rounded-full bg-[var(--clay-mint)] px-3 py-1.5 text-xs font-bold">
        ✓ clear result, add a number
      </span>
      <span style={at(3.6)} className="pop-loop absolute bottom-2 right-2 font-drawing text-2xl font-bold text-[var(--bp-hot)]">
        84%
      </span>
    </div>
  );
}
