import Image from "next/image";
import Link from "next/link";
import { Briefcase, FileSearch, PenLine, Puzzle, Sparkles, UserSearch } from "lucide-react";
import { Logo } from "@/components/logo";
import dashboardShot from "@/public/landing/dashboard.png";
import reportShot from "@/public/landing/report.png";
import trackerShot from "@/public/landing/tracker.png";

// the landing page's own buttons: round pills in ink, and an outlined one next to them
const PILL = "inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-[15px] font-semibold transition duration-200 ease-settle hover:-translate-y-0.5 active:translate-y-0";
const PILL_INK = `${PILL} bg-foreground text-background`;
const PILL_LINE = `${PILL} border-[1.5px] border-foreground text-foreground`;

// what the report checks, shown in a strip under the hero
const CHECKS = [
  { title: "Hard skills", text: "Required and preferred skills from the posting, checked one by one against your resume." },
  { title: "Searchability", text: "Headings, contact lines and dates a scanner needs to file you correctly." },
  { title: "Recruiter tips", text: "Measurable results, a matching job title and the small things people notice." },
  { title: "Rewrites", text: "Line by line edits you accept or reject, with the match rate moving as you go." },
];

// the three things worth a picture. the pictures are of the app itself, running on made up data
const SHOWN = [
  {
    title: "A match report you can act on",
    text: "Add your resume and a job description and get a match rate out of 100, with every finding marked pass or fail: missing skills, section headings a scanner will not recognize, dates it cannot read, bullets with no numbers. The score is plain code, so the same resume and job always give the same answer.",
    shot: reportShot,
    alt: "A match report showing a 62 percent match rate, with searchability, hard skills, soft skills, recruiter tips and formatting each listed with the issues to fix",
  },
  {
    title: "Every application in one place",
    text: "Save a job from its posting and it lands on a board that runs from Saved to Offer. Each card keeps the match rate from its scan, the resume you used, your cover letter, interview details and notes.",
    shot: trackerShot,
    alt: "The application tracker board with columns for Saved, Applied, Interview, Offer and Rejected, and a job card in most of them showing its match rate",
  },
  {
    title: "Scan from the dashboard",
    text: "Upload a PDF or Word file, paste the text, or pick a resume you saved earlier. The dashboard has the scan form and your board together, so starting a scan for the next job takes a few seconds.",
    shot: dashboardShot,
    alt: "The dashboard with the new scan form at the top and the application tracker below it",
  },
];

// the rest of what it does, one line each
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
    <div className="brand min-h-screen bg-background">
      {/* top bar: the logo, the sample and the way in */}
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-5 sm:px-6">
        <Logo />
        <nav className="flex items-center gap-6 text-sm text-muted">
          <Link href="/scans/sample" className="hidden hover:text-foreground sm:inline">
            Sample scan
          </Link>
          <Link href="/sign-in" className={`${PILL_LINE} px-4 py-2 text-sm`}>
            Sign in
          </Link>
        </nav>
      </header>

      <main>
        {/* the hero: the promise on the left, a resume being marked up on the right */}
        <section className="mx-auto grid max-w-6xl items-center gap-14 px-4 pb-20 pt-8 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:pt-14">
          <div className="stagger">
            <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-pen">Free resume scanner · no credits</p>
            <h1 className="mt-4 text-5xl font-normal leading-[0.98] sm:text-[4.6rem]">
              Get your resume <span className="pen-underline font-semibold">marked up</span> <span className="marker-swipe">before</span> the recruiter does.
            </h1>
            <p className="mt-6 max-w-xl text-lg text-muted">
              Paste a job description, add your resume, and get a match rate out of 100 with every problem circled: missing skills, headings a scanner will not read, dates it trips on, bullets with no
              numbers.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/sign-in" className={PILL_INK}>
                Scan my resume
              </Link>
              <Link href="/scans/sample" className={PILL_LINE}>
                See a sample scan
              </Link>
            </div>
            <p className="mt-4 text-sm text-muted">
              Same resume and job, same answer every time. The sample opens without an account.{inviteOnly ? " Signing in needs an invite code for now." : ""}
            </p>
          </div>
          <MarkedSheet />
        </section>

        {/* what the report checks, as a ruled strip */}
        <section className="mx-auto max-w-6xl px-4 sm:px-6" aria-labelledby="checks">
          <h2 id="checks" className="sr-only">
            What the report checks
          </h2>
          <ul className="grid border-t-[1.5px] border-foreground sm:grid-cols-2 lg:grid-cols-4">
            {CHECKS.map((check) => (
              <li key={check.title} className="border-b border-border py-7 sm:pr-6 lg:border-b-0 lg:border-r lg:px-6 lg:first:pl-0 lg:last:border-r-0">
                <h3 className="font-display text-[1.3rem] font-semibold">{check.title}</h3>
                <p className="mt-2 text-[15px] text-muted">{check.text}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* what it looks like, with real pictures of the app */}
        <div className="mx-auto mt-24 max-w-6xl space-y-20 px-4 sm:px-6">
          {SHOWN.map((item, index) => (
            // the picture swaps sides from one row to the next, and always gets the wider column
            <section key={item.title} className={`reveal grid items-center gap-10 ${index % 2 === 1 ? "lg:grid-cols-[1.5fr_1fr]" : "lg:grid-cols-[1fr_1.5fr]"}`}>
              <div className={index % 2 === 1 ? "lg:order-2" : ""}>
                <h2 className="text-3xl font-semibold leading-tight sm:text-4xl">{item.title}</h2>
                <p className="mt-4 text-muted">{item.text}</p>
              </div>
              {/* the picture sits on a sheet of paper like the hero */}
              <div className="overflow-hidden rounded border border-border bg-surface shadow-[0_1px_0_var(--border),0_30px_60px_-30px_rgb(60_40_10/0.3)]">
                <Image src={item.shot} alt={item.alt} sizes="(min-width: 1024px) 660px, 100vw" priority={index === 0} className="h-auto w-full" />
              </div>
            </section>
          ))}
        </div>

        {/* the rest of it, a plain ruled list */}
        <section className="mx-auto mt-28 max-w-6xl px-4 sm:px-6">
          <h2 className="text-3xl font-semibold sm:text-4xl">What else is in it</h2>
          <ul className="mt-8 grid border-t-[1.5px] border-foreground sm:grid-cols-2 lg:grid-cols-3">
            {ALSO.map(({ icon: Icon, title, text }) => (
              <li key={title} className="reveal flex gap-4 border-b border-border py-6 sm:pr-8">
                <Icon className="mt-1 size-5 shrink-0 text-pen" aria-hidden />
                <div>
                  <h3 className="font-semibold">{title}</h3>
                  <p className="mt-1 text-sm text-muted">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* one more way in at the bottom, on an ink band */}
        <section className="mt-28 bg-foreground text-background">
          <div className="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-8 px-4 py-20 sm:px-6">
            <div className="max-w-xl">
              <h2 className="text-4xl font-normal leading-[1.05] sm:text-5xl">
                Try it on <span className="marker-static">your own resume.</span>
              </h2>
              <p className="mt-4 text-background/70">Start with the sample if you want to look around first. It is free, with no paywalls or credits.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/scans/sample" className={`${PILL} border-[1.5px] border-background/60 text-background`}>
                See a sample scan
              </Link>
              <Link href="/sign-in" className={`${PILL} bg-background text-foreground`}>
                Sign in
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-8 text-sm text-muted sm:px-6">
        <p>ResumeFit is a free tool, built for me and my friends.</p>
        <p className="flex gap-4">
          <Link href="/privacy" className="hover:text-foreground">
            Privacy Policy
          </Link>
          <Link href="/terms" className="hover:text-foreground">
            Terms of Service
          </Link>
        </p>
      </footer>
    </div>
  );
}

// the made up resume in the hero, with the match stamp and the red pen notes a scan would leave
function MarkedSheet() {
  return (
    <figure className="relative mx-auto w-full max-w-[520px] rounded border border-border bg-surface px-6 pb-14 pt-8 shadow-[0_1px_0_var(--border),0_30px_60px_-30px_rgb(60_40_10/0.35)] sm:px-10 lg:rotate-[1.2deg]">
      <figcaption className="sr-only">A made up resume with a match rate of 62 and three notes: say Experience, no numbers, missing Docker and CI/CD</figcaption>
      {/* the match stamp in the corner */}
      <div className="absolute -top-8 right-4 grid size-24 -rotate-[10deg] place-items-center rounded-full bg-foreground text-center text-background shadow-[0_10px_24px_-8px_rgb(0_0_0/0.4)] sm:size-28" aria-hidden>
        <div>
          <b className="block font-display text-4xl font-bold leading-none">62</b>
          <span className="text-[10px] uppercase tracking-[0.16em]">match</span>
        </div>
      </div>
      <div aria-hidden>
        <p className="font-display text-[22px] font-semibold">Jordan Avery</p>
        <p className="text-[13px] text-muted">Software Engineer · jordan@example.com</p>
        <SheetHeading>Work history</SheetHeading>
        {/* the heading a scanner would not recognize, struck through */}
        <p className="strike-through relative inline-block text-sm">Things I Did</p>
        <Lines widths={["82%", "100%", "62%"]} />
        <SheetHeading>Experience</SheetHeading>
        <Lines widths={["100%", "82%", "62%"]} />
        <SheetHeading>Skills</SheetHeading>
        <Lines widths={["82%", "62%"]} />
      </div>
      {/* the handwritten notes */}
      <p className="pen-note right-4 top-28 -rotate-6 [animation-delay:1.9s] lg:-right-8 lg:top-20" aria-hidden>
        say &quot;Experience&quot;!
      </p>
      <p className="pen-note right-4 top-[15rem] -rotate-[8deg] [animation-delay:2.3s] lg:-left-14 lg:right-auto lg:top-52" aria-hidden>
        no numbers →
      </p>
      <p className="pen-note bottom-3 right-4 rotate-[4deg] [animation-delay:2.7s] lg:-right-5 lg:bottom-10" aria-hidden>
        missing: Docker, CI/CD
      </p>
    </figure>
  );
}

// a section heading on the made up resume
function SheetHeading({ children }: { children: React.ReactNode }) {
  return <p className="mb-2 mt-5 border-b border-border pb-1 text-[11px] font-semibold uppercase tracking-[0.16em]">{children}</p>;
}

// grey bars standing in for lines of resume text
function Lines({ widths }: { widths: string[] }) {
  return (
    <div className="mt-2 space-y-2">
      {widths.map((width, index) => (
        <div key={index} className="h-2 rounded bg-border/70" style={{ width }} />
      ))}
    </div>
  );
}
