import Link from "next/link";
import { CARD, LINK_BUTTON } from "@/components/ui/buttons";

export const metadata = { title: "Help" };

// questions people ask, grouped by the part of the app they are about
const TOPICS: { title: string; questions: { q: string; a: React.ReactNode }[] }[] = [
  {
    title: "Scans and the match rate",
    questions: [
      {
        q: "How is the match rate worked out?",
        a: "Half of it is hard skills: the tools and know-how the job description asks for. Soft skills and searchability count for 15% each, recruiter tips and formatting for 10% each. Skills the posting repeats count more, required skills count more than nice to haves, and a similar term gets half credit. No AI is involved, so the same resume and posting always give the same score.",
      },
      { q: "What score should I aim for?", a: "75% or more. Past that you are usually better off applying than polishing. A score under 40% means the resume was not written for this kind of job." },
      { q: "A skill I have is marked missing. Why?", a: "The scanner looks for the words. If the posting says Kubernetes and your resume says container orchestration, a person would connect the two but a scanner may not. Use the posting's spelling, as long as it is true." },
      { q: "The report missed a skill that is in the job description.", a: "Use Add skill under the skills table. You can also tick the box to have it looked for in all your future scans." },
      { q: "Why does pasted text get fewer formatting checks?", a: "Layout, fonts, margins and page count only exist in a file. Upload the PDF or DOCX you actually send out to get those checks." },
      { q: "It read the wrong job title from the posting.", a: "Press the pencil next to the title to rename the scan, or Update scan information under Job title match to change the title we look for in your resume." },
    ],
  },
  {
    title: "AI features",
    questions: [
      { q: "Why does it say AI is not set up?", a: <>The writing helpers run on free tiers that need a key. Add your own free Gemini key under <Link href="/settings#ai" className={LINK_BUTTON}>AI settings</Link>. Everything else in the app works without it.</> },
      { q: "Why does it say AI is busy?", a: "The free tiers have limits per minute and per day. When all of them are busy, wait a little and try again. Your work is not lost." },
      { q: "Will it make things up about me?", a: "It is told not to, and we check its work: suggestions can only change one existing line, and anything that adds a skill your resume never mentions has to be confirmed by you first. Still, read every suggestion. You are the one who has to stand behind your resume in an interview." },
      { q: "What is sent to the AI?", a: <>Your resume and the job text, with your name, email, phone, address and links swapped for placeholders first. See the <Link href="/privacy" className={LINK_BUTTON}>privacy page</Link> for the details.</> },
    ],
  },
  {
    title: "Tracker, resumes and the builder",
    questions: [
      { q: "What is a base resume?", a: "The one new scans start from, marked with a star in the Resume Manager. Click another resume's star to switch." },
      { q: "How do I get a job onto the tracker?", a: "Press Track on a scan report, Add Job on the tracker, or Save job in the extension while you are looking at a posting." },
      { q: "Can I edit an uploaded resume in the builder?", a: "Yes. Press the pencil next to it in the Resume Manager. We fill in the builder from what we read, and from then on the builder's version is the one that gets downloaded." },
      { q: "Are the builder's templates safe for applicant tracking systems?", a: "Yes. Every one is a single column with standard headings, real text and common fonts. We run each template's PDF and Word file back through our own scanner as part of our tests." },
    ],
  },
  {
    title: "Chrome extension",
    questions: [
      { q: "What does the extension do?", a: "It scans the job posting you are looking at against your resume and shows your match rate and the top missing skills, right on the page. It can also save the job to your tracker and read your own LinkedIn profile into the LinkedIn Optimizer." },
      { q: "Does it fill in applications for me?", a: "No. It reads job postings, it does not fill in or send anything." },
      { q: "It says there is no job posting on the page.", a: "Highlight the job description, right click it and choose Scan this job description with ResumeFit. That works on any page." },
      { q: "How do I connect it?", a: <>Follow the steps on the <Link href="/extension" className={LINK_BUTTON}>Chrome Extension</Link> page. A connection lasts 90 days.</> },
    ],
  },
  {
    title: "Your account",
    questions: [
      { q: "Is it really free?", a: "Yes. There are no paid plans, no credits and nothing locked. It is a personal project shared with friends." },
      { q: "How do I get my data out, or delete it?", a: <>Both are under <Link href="/settings#data" className={LINK_BUTTON}>Your data</Link> in Settings.</> },
    ],
  },
];

// answers to common questions
export default function HelpPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Help</h1>
        <p className="mt-1 text-muted">Answers to the questions that come up most.</p>
      </div>
      {TOPICS.map((topic) => (
        <section key={topic.title} className={`${CARD} p-6`}>
          <h2 className="text-xl font-semibold">{topic.title}</h2>
          <div className="mt-3 divide-y divide-border">
            {topic.questions.map((entry) => (
              // each question opens to show its answer
              <details key={entry.q} className="group py-3">
                <summary className="cursor-pointer list-none font-medium marker:hidden hover:text-primary">
                  <span className="mr-2 inline-block text-muted transition-transform duration-200 group-open:rotate-90" aria-hidden>
                    ›
                  </span>
                  {entry.q}
                </summary>
                <p className="mt-2 pl-5 text-sm leading-6 text-muted">{entry.a}</p>
              </details>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
