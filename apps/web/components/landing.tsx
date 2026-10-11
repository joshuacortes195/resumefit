import Image from "next/image";
import Link from "next/link";
import { Briefcase, FileSearch, PenLine, Puzzle, Sparkles, UserSearch } from "lucide-react";
import { Logo } from "@/components/logo";
import { CARD, LINK_BUTTON, PRIMARY_BUTTON, SECONDARY_BUTTON } from "@/components/ui/buttons";
import dashboardShot from "@/public/landing/dashboard.png";
import reportShot from "@/public/landing/report.png";
import trackerShot from "@/public/landing/tracker.png";

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
  { icon: Puzzle, title: "Chrome extension", text: "Scan or save the posting you are looking at. It reads job pages and never fills in or sends an application." },
];

// the page signed out visitors land on: what the app is, what it looks like, a sample to try and the way in
export function Landing({ inviteOnly }: { inviteOnly: boolean }) {
  return (
    <div className="min-h-screen bg-background">
      {/* top bar: the logo and the way in */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Logo />
        <Link href="/sign-in" className={SECONDARY_BUTTON}>
          Sign in
        </Link>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        {/* what it is, in one breath */}
        <section className="max-w-3xl py-12 sm:py-16">
          <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">
            See how well your resume fits a job <span className="rounded bg-marker px-1.5 text-on-marker">before you apply</span>
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-muted">
            ResumeFit compares your resume with a job description, shows what is missing and what a resume scanner will trip over, and keeps track of every job you apply to. It is free, with no paywalls or credits.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/sign-in" className={PRIMARY_BUTTON}>
              Sign in
            </Link>
            <Link href="/scans/sample" className={SECONDARY_BUTTON}>
              See a sample scan
            </Link>
          </div>
          <p className="mt-3 text-sm text-muted">
            The sample is a full report on a made up resume, and you can open it without an account.{inviteOnly ? " Signing in needs an invite code for now." : ""}
          </p>
        </section>

        {/* what it looks like */}
        <div className="space-y-16">
          {SHOWN.map((item, index) => (
            // the picture swaps sides from one row to the next, and always gets the wider column
            <section key={item.title} className={`grid items-center gap-8 ${index % 2 === 1 ? "lg:grid-cols-[1.5fr_1fr]" : "lg:grid-cols-[1fr_1.5fr]"}`}>
              <div className={index % 2 === 1 ? "lg:order-2" : ""}>
                <h2 className="text-2xl font-semibold">{item.title}</h2>
                <p className="mt-3 text-muted">{item.text}</p>
              </div>
              <div className={`${CARD} overflow-hidden`}>
                <Image src={item.shot} alt={item.alt} sizes="(min-width: 1024px) 660px, 100vw" priority={index === 0} className="h-auto w-full" />
              </div>
            </section>
          ))}
        </div>

        {/* the rest of it */}
        <section className="mt-20">
          <h2 className="text-2xl font-semibold">What else is in it</h2>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ALSO.map(({ icon: Icon, title, text }) => (
              <li key={title} className={`${CARD} p-5`}>
                <span className="flex size-9 items-center justify-center rounded-full bg-primary-soft text-primary">
                  <Icon className="size-4" aria-hidden />
                </span>
                <h3 className="mt-3 font-semibold">{title}</h3>
                <p className="mt-1 text-sm text-muted">{text}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* one more way in at the bottom */}
        <section className={`${CARD} mt-16 flex flex-wrap items-center justify-between gap-4 p-6`}>
          <div>
            <h2 className="text-xl font-semibold">Try it on your own resume</h2>
            <p className="mt-1 text-sm text-muted">Start with the sample if you want to look around first.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/scans/sample" className={SECONDARY_BUTTON}>
              See a sample scan
            </Link>
            <Link href="/sign-in" className={PRIMARY_BUTTON}>
              Sign in
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-muted sm:px-6">
          <p>ResumeFit is a free tool, built for me and my friends.</p>
          <p className="flex gap-4">
            <Link href="/privacy" className={LINK_BUTTON}>
              Privacy
            </Link>
            <Link href="/terms" className={LINK_BUTTON}>
              Terms
            </Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
