import { Suspense } from "react";
import Link from "next/link";
import { InterviewStart } from "@/components/interview-start";
import { CARD } from "@/components/ui/buttons";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUser } from "@/lib/auth";
import { listJobs } from "@/lib/data/jobs";
import { LocalTime } from "@/components/local-time";
import { listPracticeSessions, sessionScore } from "@/lib/data/practice";

export const metadata = { title: "Interview Practice" };


// pick a job, get eight questions and practice answering them
export default function InterviewPage({ searchParams }: { searchParams: Promise<{ job?: string }> }) {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Interview Practice</h1>
        <p className="mt-1 max-w-2xl text-muted">Eight questions written for one job: how you work, the skills it asks for, and what is on your resume. Answer by typing or out loud, and get feedback on each one.</p>
      </div>
      <section className={`${CARD} p-6`}>
        <Suspense fallback={<Skeleton className="h-40" />}>
          <StartLoader searchParams={searchParams} />
        </Suspense>
      </section>
      <Suspense fallback={null}>
        <PastSessions />
      </Suspense>
    </div>
  );
}

// the start form, with tracked jobs to pick from
async function StartLoader({ searchParams }: { searchParams: Promise<{ job?: string }> }) {
  const [{ job }, user] = await Promise.all([searchParams, getCurrentUser()]);
  const jobs = await listJobs(user.id);
  return <InterviewStart jobs={jobs.map((entry) => ({ id: entry.id, label: [entry.title, entry.company].filter(Boolean).join(", ") }))} preselected={jobs.some((entry) => entry.id === job) ? job : undefined} />;
}

// sessions you can go back to
async function PastSessions() {
  const user = await getCurrentUser();
  const sessions = await listPracticeSessions(user.id);
  if (sessions.length === 0) return null;
  return (
    <section className={`${CARD} p-6`}>
      <h2 className="text-lg font-semibold">Past sessions</h2>
      <ul className="mt-3 divide-y divide-border">
        {sessions.map((session) => {
          const score = sessionScore(session);
          const answered = session.answers.filter(Boolean).length;
          return (
            <li key={session.id}>
              <Link href={`/interview/${session.id}`} className="group flex items-center gap-4 py-3 text-sm">
                <span className="min-w-0 flex-1 truncate font-medium group-hover:text-primary">{[session.jobTitle ?? "Practice session", session.company].filter(Boolean).join(", ")}</span>
                <span className="shrink-0 text-muted">
                  {answered} of {session.questions.length} answered{score !== null ? `, average ${score} / 100` : ""}
                </span>
                <span className="shrink-0 text-muted"><LocalTime value={session.createdAt} style="day" /></span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
