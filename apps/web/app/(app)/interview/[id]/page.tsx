import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { InterviewSession } from "@/components/interview-session";
import { LINK_BUTTON } from "@/components/ui/buttons";
import { ReportSkeleton } from "@/components/ui/skeleton";
import { getCurrentUser } from "@/lib/auth";
import { getPracticeSession } from "@/lib/data/practice";

export const metadata = { title: "Interview Practice" };

// one practice interview
export default function InterviewSessionPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <div className="mx-auto max-w-3xl">
      <Suspense fallback={<ReportSkeleton />}>
        <SessionLoader params={params} />
      </Suspense>
    </div>
  );
}

async function SessionLoader({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  const session = await getPracticeSession(user.id, id);
  if (!session) notFound();
  const title = [session.jobTitle ?? "this job", session.company].filter(Boolean).join(" at ");
  return (
    <>
      <p className="text-sm">
        <Link href="/interview" className={LINK_BUTTON}>
          Interview Practice
        </Link>
      </p>
      <h1 className="mt-1 mb-6 text-3xl font-semibold">{title}</h1>
      <InterviewSession key={session.id} id={session.id} title={title} questions={session.questions} answers={session.questions.map((_, index) => session.answers[index] ?? null)} />
    </>
  );
}
