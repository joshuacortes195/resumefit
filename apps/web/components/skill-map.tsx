import type { CSSProperties } from "react";
import type { SkillMatch } from "@resumefit/shared";

// how many skills fit around the map before it gets crowded
const MOST = 14;

// how each kind of match looks: its bubble, the mark in front of its name and its line
const LOOK = {
  exact: { chip: "clay bg-[var(--clay-mint)]", mark: "✓", line: "var(--bp-line)", dash: undefined },
  related: { chip: "clay bg-[var(--clay-butter)]", mark: "≈", line: "var(--bp-hot)", dash: "4 4" },
  missing: { chip: "missing-chip border-2 border-dashed border-[#ff8a7a] bg-[var(--bp-deep)]/80 text-[#ffd2cb]", mark: "+", line: "#ff8a7a", dash: "2 5" },
} as const;

// the job's skills drawn as a map around your score: found ones in green, close ones in yellow, missing ones as dashed red outlines.
// each one pops in on its own beat, yellow pulses run out to the ones you have, and the rings behind slowly turn
export function SkillMap({ skills, score, kicker = "Fig. 2 / skills map" }: { skills: SkillMatch[]; score: number; kicker?: string }) {
  // required skills first, then the nice to haves
  const shown = [...skills.filter((skill) => skill.importance === "required"), ...skills.filter((skill) => skill.importance === "preferred")].slice(0, MOST);
  if (shown.length === 0) return null;
  const found = shown.filter((skill) => skill.match !== "missing").length;

  // where each skill sits on the oval around the score, as a percent of the box
  const spots = shown.map((skill, index) => {
    const angle = -Math.PI / 2 + (index / shown.length) * Math.PI * 2;
    return { skill, x: 50 + 40 * Math.cos(angle), y: 50 + 38 * Math.sin(angle) };
  });

  return (
    <section aria-label="Skills map" className="blueprint blueprint-grid relative overflow-hidden rounded-2xl p-6 print:hidden">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-drawing text-[11px] uppercase tracking-[0.1em] text-[var(--bp-hot)]">{kicker}</p>
          <h2 className="mt-1 text-xl font-semibold">
            You have {found} of the {shown.length} skills this job names
          </h2>
        </div>
        {/* what the colors mean */}
        <p className="flex flex-wrap gap-4 font-drawing text-[11px] uppercase tracking-[0.08em] text-[var(--bp-muted)]">
          <span className="text-[var(--clay-mint)]">✓ found</span>
          <span className="text-[var(--clay-butter)]">≈ close</span>
          <span className="text-[#ff8a7a]">+ missing</span>
        </p>
      </div>

      {/* the map itself on wide screens */}
      <div className="relative mt-4 hidden aspect-[2.2/1] md:block" aria-hidden>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full" fill="none">
          {/* the rings behind, turning slowly */}
          <ellipse className="spin-slow" cx="50" cy="50" rx="40" ry="38" stroke="var(--bp-line)" strokeOpacity="0.35" strokeDasharray="1 2" vectorEffect="non-scaling-stroke" />
          <ellipse className="spin-slow-back" cx="50" cy="50" rx="24" ry="23" stroke="var(--bp-line)" strokeOpacity="0.25" strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />
          {/* a line from the score to every skill */}
          {spots.map(({ skill, x, y }, index) => {
            const look = LOOK[skill.match];
            const d = `M50 50 L${x} ${y}`;
            return (
              <g key={skill.name}>
                <path d={d} stroke={look.line} strokeOpacity={skill.match === "missing" ? 0.55 : 0.8} strokeWidth="1.2" strokeDasharray={look.dash} vectorEffect="non-scaling-stroke" />
                {/* a yellow pulse runs out to each skill you have */}
                {skill.match !== "missing" && <path d={d} pathLength={1000} className="pulse" stroke="var(--bp-hot)" strokeWidth="3" strokeLinecap="round" vectorEffect="non-scaling-stroke" style={{ animationDelay: `${0.6 + index * 0.22}s` }} />}
              </g>
            );
          })}
        </svg>

        {/* the score in the middle, counting up, with a ring that glows as the pulses leave */}
        <div className="absolute left-1/2 top-1/2 grid size-32 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-[var(--bp-line)] bg-[var(--bp-deep)] shadow-[0_0_0_8px_rgb(255_207_63/0.08)]">
          <span className="text-center">
            <span className="block font-display text-4xl font-extrabold text-[var(--bp-hot)]">
              <span className="count-up" style={{ "--to": score } as CSSProperties} />%
            </span>
            <span className="font-drawing text-[10px] uppercase tracking-[0.1em] text-[var(--bp-muted)]">match</span>
          </span>
        </div>

        {/* the skills, popping in one after another */}
        {spots.map(({ skill, x, y }, index) => {
          const look = LOOK[skill.match];
          return (
            <span
              key={skill.name}
              style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${0.2 + index * 0.12}s` }}
              className={`pop-in absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-bold ${look.chip}`}
            >
              {look.mark} {skill.name}
            </span>
          );
        })}
      </div>

      {/* on a phone the same skills as a list of chips */}
      <ul className="mt-4 flex flex-wrap gap-2 md:hidden">
        {shown.map((skill, index) => (
          <li key={skill.name} style={{ animationDelay: `${index * 0.08}s` }} className={`pop-in rounded-full px-3 py-1.5 text-xs font-bold ${LOOK[skill.match].chip}`}>
            {LOOK[skill.match].mark} {skill.name}
          </li>
        ))}
      </ul>
      {/* the same facts for screen readers */}
      <p className="sr-only">
        {shown.map((skill) => `${skill.name}: ${skill.match === "missing" ? "missing" : skill.match === "related" ? "close match" : "found"}`).join(". ")}
      </p>
    </section>
  );
}
