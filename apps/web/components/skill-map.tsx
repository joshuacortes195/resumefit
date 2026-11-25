import type { CSSProperties } from "react";
import type { SkillMatch } from "@resumefit/shared";

// how many skills the sheet lists before it gets long
const MOST = 14;

// a delay in seconds for one part of the sheet
const at = (seconds: number) => ({ animationDelay: `${seconds}s` }) as CSSProperties;

// the job's skills as a graded inspection sheet: the score circled by hand in yellow, then every skill ticked or crossed one by one
export function SkillMap({ skills, score, title, kicker = "Inspection / skills" }: { skills: SkillMatch[]; score: number; title?: string; kicker?: string }) {
  // required skills first, then the nice to haves
  const shown = [...skills.filter((skill) => skill.importance === "required"), ...skills.filter((skill) => skill.importance === "preferred")].slice(0, MOST);
  if (shown.length === 0) return null;
  const found = shown.filter((skill) => skill.match !== "missing").length;

  return (
    <section aria-label="Skills checklist" className="blueprint blueprint-grid overflow-hidden rounded-2xl p-6 sm:p-8 print:hidden">
      {/* the top of the sheet: what it is, the job, and the score with a hand drawn circle around it */}
      <div className="flex items-center justify-between gap-6 border-b-[1.5px] border-[var(--bp-line)]/60 pb-5">
        <div className="min-w-0">
          <p className="font-drawing text-[11px] uppercase tracking-[0.1em] text-[var(--bp-hot)]">{kicker}</p>
          {title && <p className="mt-1 truncate font-display text-2xl font-bold text-[var(--bp-text)]">{title}</p>}
          <h2 className="mt-1 text-lg font-semibold">
            You have {found} of the {shown.length} skills this job names
          </h2>
        </div>
        <div className="relative grid size-24 shrink-0 place-items-center sm:size-28">
          <svg viewBox="0 0 118 118" className="absolute inset-0 size-full" aria-hidden>
            <path className="circle-grade" pathLength={420} d="M60 8 C95 6 112 34 110 62 C108 94 80 112 54 110 C24 108 6 86 8 58 C10 30 30 10 66 9" fill="none" stroke="var(--bp-hot)" strokeWidth="3" strokeLinecap="round" />
          </svg>
          <span className="text-center">
            <span className="block font-display text-4xl font-extrabold leading-none text-[var(--bp-text)]">
              <span aria-hidden className="count-up" style={{ "--to": score } as CSSProperties} />
              <span className="sr-only">{score}</span>
            </span>
            <span className="font-drawing text-[10px] uppercase tracking-[0.1em] text-[var(--bp-muted)]">match</span>
          </span>
        </div>
      </div>

      {/* the ledger: each skill with a dotted line to its mark, ticked or crossed in turn */}
      <ul className="mt-5 grid gap-x-10 gap-y-3 md:grid-cols-2">
        {shown.map((skill, index) => {
          const delay = 0.9 + index * 0.18;
          const missing = skill.match === "missing";
          return (
            <li key={skill.name} className="flex items-end gap-3 text-[15px]">
              <span className={missing ? "text-[var(--bp-muted)]" : "text-[var(--bp-text)]"}>{skill.name}</span>
              {skill.importance === "preferred" && <span className="font-drawing text-[10px] uppercase tracking-[0.08em] text-[var(--bp-muted)]">nice to have</span>}
              <span aria-hidden className="mb-1.5 min-w-6 flex-1 border-b-2 border-dotted border-[var(--bp-line)]/35" />
              {/* the mark and its tag in a box of fixed width, so every mark lines up down the column */}
              <span className="flex w-[4.5rem] shrink-0 items-center gap-2">
                {/* the hand drawn mark: a tick for found, a wavy tick for close, a cross and a tag for missing */}
                <svg viewBox="0 0 24 24" className="size-6 shrink-0" fill="none" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  {skill.match === "exact" && <path className="tick-draw" style={at(delay)} pathLength={100} d="M3 13 C6 15 8 18 9 20 C12 13 16 7 21 3" stroke="var(--bp-good)" />}
                  {skill.match === "related" && <path className="tick-draw" style={at(delay)} pathLength={100} d="M3 14 C5 15 7 17 8.5 19 C11 14 13 12 15 10 C17 8 19 6 21 5" stroke="var(--bp-hot)" />}
                  {missing && <path className="tick-draw" style={at(delay)} pathLength={100} d="M5 5 L19 19 M19 5 L5 19" stroke="#ff8a7a" />}
                </svg>
                <span className="sr-only">{missing ? "missing" : skill.match === "related" ? "close match" : "found"}</span>
                {missing && (
                  <span aria-hidden style={at(delay + 0.2)} className="pop-in rounded-full border border-dashed border-[#ff8a7a] px-2 py-0.5 font-drawing text-[10px] uppercase tracking-[0.08em] text-[#ffb3a8]">
                    add
                  </span>
                )}
                {skill.match === "related" && (
                  <span aria-hidden style={at(delay + 0.2)} className="pop-in font-drawing text-[10px] uppercase tracking-[0.08em] text-[var(--bp-hot)]">
                    close
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
