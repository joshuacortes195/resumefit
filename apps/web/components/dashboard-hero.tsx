import type { CSSProperties } from "react";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { statJobs } from "@/lib/data/jobs";
import { latestScan } from "@/lib/data/scans";
import { summarize } from "@/lib/stats";

// the stages of the pipeline drawing, left to right, and where each one sits in it
const STAGES = [
  { key: "saved", label: "SAVED", x: 60, y: 150 },
  { key: "applied", label: "APPLIED", x: 190, y: 90 },
  { key: "interview", label: "INTERVIEW", x: 320, y: 150 },
  { key: "offer", label: "OFFER", x: 450, y: 90 },
] as const;

// a soft curve from one stage to the next, leaving and arriving level
function segment(from: (typeof STAGES)[number], to: (typeof STAGES)[number]) {
  const mid = (from.x + to.x) / 2;
  return `M${from.x + 30} ${from.y} C ${mid} ${from.y}, ${mid} ${to.y}, ${to.x - 30} ${to.y}`;
}

// a number that counts up from zero when the page opens, with the real number kept for screen readers
function Count({ value, suffix = "" }: { value: number; suffix?: string }) {
  return (
    <>
      <span aria-hidden className="count-up" style={{ "--to": value } as CSSProperties} />
      {suffix && <span aria-hidden>{suffix}</span>}
      <span className="sr-only">
        {value}
        {suffix}
      </span>
    </>
  );
}

// the top of the dashboard: a greeting, your numbers counting up, and your job hunt drawn as a pipeline with pulses running through it
export async function DashboardHero() {
  const user = await getCurrentUser();
  const [jobs, scan] = await Promise.all([statJobs(user.id), latestScan(user.id)]);
  const live = jobs.filter((job) => !job.archived);
  const stats = summarize(jobs);
  // how many cards are sitting in each stage right now
  const inStage = (status: string) => live.filter((job) => job.status === status).length;
  const first = user.name?.trim().split(/\s+/)[0];

  // the tiles under the greeting
  const tiles = [
    { label: "Jobs tracked", value: live.length },
    { label: "Applications sent", value: stats.applied },
    { label: "Interviews", value: stats.interviews },
    { label: "Latest match", value: scan?.matchRate ?? 0, suffix: "%" },
  ];

  // the tips floating over the drawing, picked from where things stand
  const tips = [
    live.length === 0 ? { text: "save your first job", href: "/jobs" } : { text: `${inStage("saved")} saved, ready to send`, href: "/tracker" },
    stats.followUps.length > 0 ? { text: `${stats.followUps.length} follow up${stats.followUps.length === 1 ? "" : "s"} due`, href: "/stats" } : { text: "scan before you apply", href: "/scans/new" },
    scan && scan.matchRate < 75 ? { text: "aim for 75% or more", href: `/scans/${scan.id}` } : { text: "practice an interview", href: "/interview" },
  ];
  const tipLooks = ["left-[4%] top-[7%] bg-[var(--clay-butter)]", "right-[3%] bottom-[12%] bg-[var(--clay-mint)]", "left-[22%] bottom-[3%] bg-[var(--clay-peach)]"];

  return (
    <section className="blueprint blueprint-grid relative overflow-hidden rounded-2xl p-6 sm:p-8">
      <div className="grid items-center gap-8 lg:grid-cols-[1fr_1.05fr]">
        {/* the greeting and the numbers */}
        <div>
          <p className="font-drawing text-[11px] uppercase tracking-[0.1em] text-[var(--bp-hot)]">Your job hunt, today</p>
          <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">{first && first !== "You" ? `Welcome back, ${first}` : "Welcome to ResumeFit"}</h1>
          <p className="mt-2 max-w-md text-[var(--bp-muted)]">See how well your resume fits a job, fix what is missing and keep every application in one place.</p>

          {/* the four numbers, counting up as the page opens */}
          <dl className="stagger mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {tiles.map((tile) => (
              <div key={tile.label} className="rounded-xl border border-[var(--bp-line)]/25 bg-[var(--bp-deep)]/70 px-3 py-3">
                <dd className="font-display text-3xl font-extrabold tabular-nums text-[var(--bp-hot)]">
                  <Count value={tile.value} suffix={tile.suffix} />
                </dd>
                <dt className="mt-1 font-drawing text-[10px] uppercase tracking-[0.08em] text-[var(--bp-muted)]">{tile.label}</dt>
              </div>
            ))}
          </dl>
        </div>

        {/* the pipeline: four stages with your counts, pulses running from saved through to offer */}
        <div className="relative" aria-hidden>
          <svg viewBox="0 0 510 230" className="w-full" fill="none">
            {STAGES.slice(1).map((stage, index) => {
              const d = segment(STAGES[index], stage);
              return (
                <g key={stage.key}>
                  <path d={d} pathLength={1000} className="trace" stroke="var(--bp-line)" strokeWidth="1.5" />
                  {/* each pulse leaves a beat after the one before, so it looks like one job moving down the line */}
                  <path d={d} pathLength={1000} className="pulse" stroke="var(--bp-hot)" strokeWidth="3" strokeLinecap="round" style={{ animationDelay: `${index * 0.6}s` }} />
                </g>
              );
            })}
            {STAGES.map((stage) => (
              <g key={stage.key}>
                <circle cx={stage.x} cy={stage.y} r="30" fill="var(--bp-deep)" stroke="var(--bp-line)" strokeWidth="1.5" />
                {/* the offer ring lights up when the pulse gets there */}
                {stage.key === "offer" && <circle cx={stage.x} cy={stage.y} r="37" className="core-glow" stroke="var(--bp-hot)" strokeWidth="2" style={{ animationDelay: "1.2s" }} />}
                <text x={stage.x} y={stage.y + 8} textAnchor="middle" fontSize="22" fontWeight="800" fill="var(--bp-text)" fontFamily="var(--font-display)">
                  {inStage(stage.key)}
                </text>
                <text x={stage.x} y={stage.y + 52} textAnchor="middle" fontSize="9" fill="var(--bp-muted)" fontFamily="var(--font-drawing)" letterSpacing="1.5">
                  {stage.label}
                </text>
              </g>
            ))}
          </svg>
        </div>
      </div>

      {/* the clay tips, floating over the drawing on wide screens */}
      <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[48%] lg:block">
        {tips.map((tip, index) => (
          <Link key={tip.text} href={tip.href} className={`clay float pointer-events-auto absolute rounded-full px-3.5 py-1.5 text-xs font-semibold transition-transform duration-200 hover:scale-105 ${tipLooks[index]}`}>
            {tip.text}
          </Link>
        ))}
      </div>
    </section>
  );
}
