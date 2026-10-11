import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { InterviewSession } from "@/components/interview-session";
import { LINK_BUTTON } from "@/components/ui/buttons";
import { ReportSkeleton } from "@/components/ui/skeleton";
import { getCurrentUser } from "@/lib/auth";
import { getPracticeSession, type PracticeSession } from "@/lib/data/practice";
import { featureFlags } from "@/lib/data/settings";

export const metadata = { title: "Interview Practice" };

// one practice interview
export default async function InterviewSessionPage({ params }: { params: Promise<{ id: string }> }) {
  // looked up before anything is sent, so a session that is not there answers with a real 404 and the not found page
  const { id } = await params;
  const user = await getCurrentUser();
  const session = await getPracticeSession(user.id, id);
  if (!session) notFound();
  return (
    <div className="mx-auto max-w-3xl">
      <Suspense fallback={<ReportSkeleton />}>
        <SessionLoader session={session} />
      </Suspense>
    </div>
  );
}

async function SessionLoader({ session }: { session: PracticeSession }) {
  const title = [session.jobTitle ?? "this job", session.company].filter(Boolean).join(" at ");
  return (
    <>
      <p className="text-sm">
        <Link href="/interview" className={LINK_BUTTON}>
          Interview Practice
        </Link>
      </p>
      <h1 className="mt-1 mb-6 text-3xl font-semibold">{title}</h1>
      <InterviewSession key={session.id} voice={(await featureFlags()).interviewVoice} id={session.id} title={title} questions={session.questions} answers={session.questions.map((_, index) => session.answers[index] ?? null)} />
    </>
  );
}
