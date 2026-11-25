import Image from "next/image";
import Link from "next/link";
import { Briefcase, FileSearch, PenLine, Puzzle, Sparkles, UserSearch } from "lucide-react";
import { Logo } from "@/components/logo";
import dashboardShot from "@/public/landing/dashboard.png";
import trackerShot from "@/public/landing/tracker.png";

// the landing page's own buttons: square cornered like a drawing, yellow for the main one
const BUTTON = "inline-flex items-center justify-center gap-2 px-5 py-3 font-display text-base font-bold transition duration-200 ease-settle hover:-translate-y-0.5 active:translate-y-0";
const BUTTON_HOT = `${BUTTON} bg-[var(--bp-hot)] text-[var(--clay-ink)]`;
const BUTTON_LINE = `${BUTTON} border-[1.5px] border-[var(--bp-line)] text-[var(--bp-text)]`;

// small print labels in the drawing font
const LABEL = "font-drawing text-xs uppercase tracking-[0.1em]";

// the floating tips around the drawing in the hero: what it says, its clay color and where it floats
const BUBBLES = [
  { text: "✓ Python, SQL, AWS", color: "var(--clay-mint)", place: "left-[2%] top-[4%]" },
  { text: "+ add Docker", color: "var(--clay-cloud)", place: "right-[0%] top-[30%]" },
  { text: "rename “Things I Did”", color: "var(--clay-butter)", place: "left-[0%] top-[58%]" },
  { text: "add a number", color: "var(--clay-peach)", place: "right-[4%] bottom-[6%]" },
];

// the graded report in the middle of the page: each check, its result, and whether it passed
const GRADES = [
  { group: "Hard skills", rows: [
    { check: "Python, SQL, AWS, REST APIs, PostgreSQL", result: "found", pass: true },
    { check: "Docker", result: "missing", pass: false },
    { check: "CI/CD", result: "missing", pass: false },
  ] },
  { group: "Searchability", rows: [
    { check: "Contact lines and dates", result: "pass", pass: true },
    { check: "Work section heading “Things I Did”", result: "rename", pass: false },
  ] },
  { group: "Recruiter tips", rows: [{ check: "Bullets with measurable results", result: "1 of 4", pass: false }] },
];

// the two pictures of the app itself, running on made up data
const SHOWN = [
  {
    title: "Every application in one place",
    text: "Save a job from its posting and it lands on a board that runs from Saved to Offer. Each card keeps the match rate from its scan, the resume you used, your cover letter, interview details and notes.",
    shot: trackerShot,
    alt: "The application tracker board with columns for Saved, Applied, Interview, Offer and Rejected, and a job card in most of them showing its match rate",
  },
  {
    title: "Scan from the dashboard",
    text: "Upload a PDF or Word file, paste the text, or pick a resume you saved earlier. The dashboard shows where every application stands with the scan form right under it, so starting a scan for the next job takes a few seconds.",
    shot: dashboardShot,
    alt: "The dashboard with a count of jobs tracked, applications sent, interviews and the latest match rate, a path from Saved to Offer, and the new scan form below",
  },
];

// the rest of what it does, laid out like the title block in the corner of a drawing
const ALSO = [
  { icon: Sparkles, title: "Rewrite suggestions", text: "Line by line edits you accept or reject, with the match rate updating as you go." },
  { icon: PenLine, title: "Resume builder", text: "Single column templates that scanners read cleanly, with PDF and Word export." },
  { icon: FileSearch, title: "Find Jobs", text: "Open roles from company job boards, with an estimate of how well each fits your resume." },
  { icon: UserSearch, title: "LinkedIn check", text: "Scores your profile against the jobs you want and lists the keywords it is missing." },
  { icon: Briefcase, title: "Interview practice", text: "Questions for a specific job and feedback on your answers." },
  { icon: Puzzle, title: "Chrome extension", text: "Scan or save the posting you are looking at, and have application forms filled in for you to check. Pressing Submit stays with you unless you hand it over." },
];

// the page signed out visitors land on: what the app is, what it looks like, a sample to try and the way in
export function Landing({ inviteOnly }: { inviteOnly: boolean }) {
  return (
    <div className="blueprint blueprint-grid min-h-screen overflow-x-hidden">
      {/* top bar: the logo, the sample and the way in */}
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-5 sm:px-6">
        <span className="[--logo-line:var(--bp)] [--logo-page:var(--bp-text)] [&_a]:text-[var(--bp-text)]">
          <Logo />
        </span>
        <nav className="flex items-center gap-5 text-sm">
          <Link href="/scans/sample" className="hidden text-[var(--bp-muted)] hover:text-[var(--bp-text)] sm:inline">
            Sample scan
          </Link>
          <Link href="/sign-in" className={`${BUTTON_LINE} px-4 py-2 text-sm`}>
            Sign in
          </Link>
        </nav>
      </header>

      <main>
        {/* the hero: the promise on the left, the resume drawn as a part with clay tips floating around it */}
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-20 pt-8 sm:px-6 lg:grid-cols-[1fr_1.1fr] lg:pt-12">
          <div className="stagger">
            <p className={`${LABEL} text-[var(--bp-hot)]`}>Dwg no. RF-062 / free / no credits</p>
            <h1 className="mt-4 text-5xl font-extrabold leading-[0.98] tracking-tight sm:text-7xl">
              Your resume, <span className="text-[var(--bp-hot)]">built to spec.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-[var(--bp-muted)]">
              ResumeFit checks your resume against a job description the way an inspector checks a part: every required skill, every heading, every date. You get a match rate out of 100 and a callout on
              everything that is off.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/sign-in" className={BUTTON_HOT}>
                Scan my resume
              </Link>
              <Link href="/scans/sample" className={BUTTON_LINE}>
                See a sample scan
              </Link>
            </div>
            <p className="mt-4 text-sm text-[var(--bp-muted)]">
              Same resume and job, same answer every time. The sample opens without an account.{inviteOnly ? " Signing in needs an invite code for now." : ""}
            </p>
          </div>
          <HeroDrawing />
        </section>

        {/* before and after: the same made up resume as a draft and after taking the rewrites */}
        <section className="mx-auto max-w-6xl px-4 sm:px-6">
          <p className={`${LABEL} text-[var(--bp-hot)]`}>Revisions</p>
          <h2 className="mt-2 text-4xl font-extrabold sm:text-5xl">See it marked up, then see it fixed.</h2>
          <div className="mt-10 grid items-center gap-8 lg:grid-cols-[1fr_auto_1fr]">
            <RevisionSheet
              rev="Rev A · your draft"
              score={62}
              lines={[
                { text: "Things I Did", heading: true, note: "wrong heading" },
                { text: "Software Engineer, Northwind" },
                { text: "Worked with the team on releases", note: "no numbers" },
                { text: "Built APIs for the orders service" },
                { text: "Skills", heading: true },
                { text: "Python, SQL, Git, AWS", note: "missing Docker" },
              ]}
            />
            <span className="text-center font-display text-4xl font-bold text-[var(--bp-hot)] max-lg:rotate-90" aria-hidden>
              →
            </span>
            <RevisionSheet
              rev="Rev B · after rewrites"
              score={80}
              fixed
              lines={[
                { text: "Experience", heading: true, changed: true },
                { text: "Software Engineer, Northwind" },
                { text: "Shipped 40 releases with a team of 6", changed: true },
                { text: "Built APIs for the orders service" },
                { text: "Skills", heading: true },
                { text: "Python, SQL, Git, AWS, Docker", changed: true },
              ]}
            />
          </div>
          <p className="mt-4 text-center text-sm text-[var(--bp-muted)]">A made up example. Only add skills you really have: ResumeFit asks you to confirm any rewrite that would add one.</p>
        </section>

        {/* the graded report: a circled score and a ledger of every check */}
        <section className="mx-auto mt-28 grid max-w-6xl items-start gap-12 px-4 sm:px-6 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <p className={`${LABEL} text-[var(--bp-hot)]`}>Inspection report</p>
            <h2 className="mt-2 text-4xl font-extrabold sm:text-5xl">Graded against the job, line by line.</h2>
            <p className="mt-5 max-w-lg text-[var(--bp-muted)]">
              Every finding is marked pass or fail: missing skills, section headings a scanner will not recognize, dates it cannot read, bullets with no numbers. The score is plain code, so the same resume
              and job always give the same grade.
            </p>
          </div>
          <GradedReport />
        </section>

        {/* what the rest of the app looks like, with real pictures */}
        <div className="mx-auto mt-28 max-w-6xl space-y-20 px-4 sm:px-6">
          {SHOWN.map((item, index) => (
            // the picture swaps sides from one row to the next, and always gets the wider column
            <section key={item.title} className={`reveal grid items-center gap-10 ${index % 2 === 1 ? "lg:grid-cols-[1.5fr_1fr]" : "lg:grid-cols-[1fr_1.5fr]"}`}>
              <div className={index % 2 === 1 ? "lg:order-2" : ""}>
                <h2 className="text-3xl font-extrabold sm:text-4xl">{item.title}</h2>
                <p className="mt-4 text-[var(--bp-muted)]">{item.text}</p>
              </div>
              {/* the picture pinned to the drawing with a thin frame */}
              <div className="overflow-hidden border-[1.5px] border-[var(--bp-line)] bg-white p-1 shadow-[12px_16px_30px_rgb(5_20_50/0.35)]">
                <Image src={item.shot} alt={item.alt} sizes="(min-width: 1024px) 660px, 100vw" className="h-auto w-full" />
              </div>
            </section>
          ))}
        </div>

        {/* the rest of it, as a title block grid */}
        <section className="mx-auto mt-28 max-w-6xl px-4 sm:px-6">
          <h2 className="text-3xl font-extrabold sm:text-4xl">What else is in it</h2>
          <ul className="mt-8 grid border-[1.5px] border-[var(--bp-line)] sm:grid-cols-2 lg:grid-cols-3">
            {ALSO.map(({ icon: Icon, title, text }) => (
              <li key={title} className="reveal -mb-px -mr-px flex gap-4 border-b border-r border-[var(--bp-line)]/60 p-6">
                <Icon className="mt-1 size-5 shrink-0 text-[var(--bp-hot)]" aria-hidden />
                <div>
                  <h3 className="font-display text-lg font-bold">{title}</h3>
                  <p className="mt-1 text-sm text-[var(--bp-muted)]">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* one more way in at the bottom, on a darker band */}
        <section className="mt-28 bg-[var(--bp-deep)]">
          <div className="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-8 px-4 py-20 sm:px-6">
            <div className="max-w-xl">
              <h2 className="text-4xl font-extrabold leading-tight sm:text-5xl">
                Try it on <span className="text-[var(--bp-hot)]">your own resume.</span>
              </h2>
              <p className="mt-4 text-[var(--bp-muted)]">Start with the sample if you want to look around first. It is free, with no paywalls or credits.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/scans/sample" className={BUTTON_LINE}>
                See a sample scan
              </Link>
              <Link href="/sign-in" className={BUTTON_HOT}>
                Sign in
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-8 font-drawing text-xs text-[var(--bp-muted)] sm:px-6">
        <p>ResumeFit is a free tool, built for me and my friends.</p>
        <p className="flex gap-4">
          <Link href="/privacy" className="hover:text-[var(--bp-text)]">
            Privacy Policy
          </Link>
          <Link href="/terms" className="hover:text-[var(--bp-text)]">
            Terms of Service
          </Link>
        </p>
      </footer>
    </div>
  );
}

// the made up resume drawn as a technical part, with yellow callouts and clay tips floating around it
function HeroDrawing() {
  return (
    <figure className="relative mx-auto w-full max-w-[560px] px-6 py-10">
      <figcaption className="sr-only">A made up resume drawn like a technical part with a match rate of 62. Callouts point at a heading to rename, a bullet with no numbers and missing skills.</figcaption>
      <svg viewBox="0 0 400 470" className="h-auto w-full" aria-hidden>
        {/* the page outline and its lines of text */}
        <rect className="trace" pathLength={1000} x="60" y="30" width="280" height="400" fill="none" stroke="var(--bp-line)" strokeWidth="2" />
        <g stroke="var(--bp-line)" strokeWidth="1.5">
          <line className="trace" pathLength={1000} x1="90" y1="70" x2="220" y2="70" />
          <line className="trace" pathLength={1000} x1="90" y1="115" x2="310" y2="115" />
          <line className="trace" pathLength={1000} x1="90" y1="135" x2="280" y2="135" />
          <line className="trace" pathLength={1000} x1="90" y1="155" x2="250" y2="155" />
          <line className="trace" pathLength={1000} x1="90" y1="215" x2="310" y2="215" />
          <line className="trace" pathLength={1000} x1="90" y1="235" x2="270" y2="235" />
          <line className="trace" pathLength={1000} x1="90" y1="300" x2="310" y2="300" />
          <line className="trace" pathLength={1000} x1="90" y1="320" x2="230" y2="320" />
        </g>
        {/* measurements along the top and the side */}
        <g stroke="var(--bp-muted)" strokeWidth="1">
          <line x1="60" y1="12" x2="340" y2="12" />
          <line x1="60" y1="6" x2="60" y2="18" />
          <line x1="340" y1="6" x2="340" y2="18" />
          <line x1="356" y1="30" x2="356" y2="430" />
          <line x1="350" y1="30" x2="362" y2="30" />
          <line x1="350" y1="430" x2="362" y2="430" />
        </g>
        <text x="180" y="8" fontSize="10" fill="var(--bp-muted)" className="font-drawing">
          1 PAGE
        </text>
        {/* the three callouts, circled in yellow */}
        <g stroke="var(--bp-hot)" strokeWidth="2" fill="none">
          <circle cx="92" cy="95" r="12" />
          <circle cx="262" cy="155" r="12" />
          <circle cx="222" cy="320" r="12" />
        </g>
        <g fill="var(--bp-hot)" className="font-drawing" fontSize="11">
          <text x="110" y="99">A</text>
          <text x="280" y="159">B</text>
          <text x="240" y="324">C</text>
        </g>
        {/* the title block with the match rate */}
        <rect x="220" y="370" width="110" height="50" fill="var(--bp-deep)" stroke="var(--bp-line)" />
        <text x="232" y="388" fontSize="9" fill="var(--bp-muted)" className="font-drawing">
          MATCH RATE
        </text>
        <text x="232" y="410" fontSize="19" fill="var(--bp-text)" className="font-drawing">
          62 / 100
        </text>
      </svg>
      {/* the clay tips that float around the drawing */}
      {BUBBLES.map((bubble) => (
        <span key={bubble.text} className={`float clay absolute whitespace-nowrap rounded-full px-3.5 py-2 font-display text-xs font-bold sm:px-4 sm:text-sm ${bubble.place}`} style={{ background: bubble.color }} aria-hidden>
          {bubble.text}
        </span>
      ))}
    </figure>
  );
}

// one revision of the made up resume, as a sheet on the drawing
function RevisionSheet({ rev, score, lines, fixed = false }: { rev: string; score: number; fixed?: boolean; lines: { text: string; heading?: boolean; note?: string; changed?: boolean }[] }) {
  return (
    <div className="relative border-[1.5px] border-[var(--bp-line)] bg-[var(--bp-deep)]/70 p-6 pt-8 sm:p-8">
      <span className={`${LABEL} absolute -top-3 left-5 bg-[var(--bp-text)] px-2.5 py-1 text-[var(--clay-ink)]`}>{rev}</span>
      {/* the score in the corner, green once it is fixed */}
      <p className={`-mt-2 text-right font-display text-4xl font-extrabold leading-none ${fixed ? "text-[var(--bp-good)]" : "text-[var(--bp-hot)]"}`}>
        {score}
        <span className={`${LABEL} block text-[10px] text-[var(--bp-muted)]`}>match</span>
      </p>
      <ul className="space-y-2 pr-2">
        {lines.map((line) => (
          <li key={line.text} className={`flex flex-wrap items-baseline justify-between gap-x-4 ${line.heading ? `${LABEL} mt-4 border-b border-[var(--bp-line)]/40 pb-1 text-[var(--bp-muted)]` : "text-[15px]"}`}>
            {/* a broken line is struck through, a changed one is marked in yellow */}
            <span className={line.changed ? "bg-[var(--bp-hot)] px-1 text-[var(--clay-ink)]" : line.note && line.heading ? "line-through decoration-[var(--bp-hot)] decoration-2" : ""}>{line.text}</span>
            {line.note && <span className="font-drawing text-xs normal-case tracking-normal text-[var(--bp-hot)]">← {line.note}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

// the report as an inspection sheet: the grade circled in yellow and a ledger of checks
function GradedReport() {
  return (
    <div className="border-[1.5px] border-[var(--bp-line)] bg-[var(--bp-deep)]/70 p-6 sm:p-8">
      <div className="flex items-center justify-between gap-4 border-b-[1.5px] border-[var(--bp-line)] pb-5">
        <div>
          <p className="font-display text-xl font-bold">Backend Engineer</p>
          <p className="text-sm text-[var(--bp-muted)]">Northwind · made up sample</p>
        </div>
        {/* the grade with a hand drawn circle around it */}
        <div className="relative grid size-24 shrink-0 place-items-center sm:size-28">
          <svg viewBox="0 0 118 118" className="absolute inset-0 size-full" aria-hidden>
            <path className="circle-grade" pathLength={420} d="M60 8 C95 6 112 34 110 62 C108 94 80 112 54 110 C24 108 6 86 8 58 C10 30 30 10 66 9" fill="none" stroke="var(--bp-hot)" strokeWidth="3" strokeLinecap="round" />
          </svg>
          <span className="font-display text-5xl font-extrabold text-[var(--bp-hot)]">62</span>
        </div>
      </div>
      <table className="mt-2 w-full text-sm">
        {GRADES.map((group) => (
          <tbody key={group.group}>
            <tr>
              <th colSpan={2} className={`${LABEL} pb-2 pt-5 text-left font-normal text-[var(--bp-muted)]`}>
                {group.group}
              </th>
            </tr>
            {group.rows.map((row) => (
              <tr key={row.check} className="border-b border-[var(--bp-line)]/25">
                <td className="py-2.5 pr-4">{row.check}</td>
                <td className={`whitespace-nowrap py-2.5 text-right font-drawing text-xs ${row.pass ? "text-[var(--bp-good)]" : "text-[var(--bp-hot)]"}`}>
                  {row.pass ? "✓" : "✕"} {row.result}
                </td>
              </tr>
            ))}
          </tbody>
        ))}
      </table>
    </div>
  );
}
