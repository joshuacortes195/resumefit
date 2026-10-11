import { Suspense } from "react";
import { notFound } from "next/navigation";
import { JobModal } from "@/components/tracker/job-modal";
import { getCurrentUser, type CurrentUser } from "@/lib/auth";
import { getCoverLetter, getJob, latestScores, listInterviews, type JobRow } from "@/lib/data/jobs";
import { listPracticeSessions, sessionScore } from "@/lib/data/practice";
import { getResume, listResumes } from "@/lib/data/resumes";
import { JOB_TABS, type JobTab } from "@/lib/job-tabs";

export const metadata = { title: "Job" };

type Params = Promise<{ jobId: string; tab: string }>;

// one job's card, opened on top of the board
export default async function JobPage({ params }: { params: Params }) {
  // looked up before anything is sent, so a job or tab that is not there answers with a real 404 and the not found page
  const { jobId, tab } = await params;
  if (!(JOB_TABS as readonly string[]).includes(tab)) notFound();
  const user = await getCurrentUser();
  const job = await getJob(user.id, jobId);
  if (!job) notFound();
  return (
    <Suspense fallback={null}>
      <JobModalLoader user={user} job={job} tab={tab as JobTab} />
    </Suspense>
  );
}

// loads everything the card's tabs show
async function JobModalLoader({ user, job, tab }: { user: CurrentUser; job: JobRow; tab: JobTab }) {

  const [scores, resumes, resume, coverLetter, interviews, practice] = await Promise.all([
    latestScores(user.id, [job.id]),
    listResumes(user.id),
    job.resumeId ? getResume(user.id, job.resumeId) : null,
    getCoverLetter(user.id, job.id),
    listInterviews(user.id, job.id),
    listPracticeSessions(user.id, job.id),
  ]);

  return (
    <JobModal
      // a new key per job so one card's half typed text never shows up in another
      key={job.id}
      tab={tab}
      data={{
        job: {
          id: job.id,
          title: job.title,
          company: job.company,
          location: job.location,
          url: job.url,
          salary: job.salary,
          description: job.description,
          dateApplied: job.dateApplied,
          notes: job.notes,
          status: job.status,
          archived: job.archived,
        },
        score: scores.get(job.id) ?? null,
        resume: resume ? { id: resume.id, name: resume.name, text: resume.rawText ?? "" } : null,
        resumes: resumes.map(({ id, name, isBase }) => ({ id, name, isBase })),
        coverLetter: coverLetter?.content ?? "",
        practice: practice.map((session) => ({ id: session.id, date: session.createdAt.toISOString(), answered: session.answers.filter(Boolean).length, score: sessionScore(session) })),
        interviews: interviews.map((interview) => ({
          id: interview.id,
          type: interview.type,
          datetime: interview.datetime?.toISOString() ?? null,
          interviewerName: interview.interviewerName,
          phone: interview.phone,
          email: interview.email,
          meetingLink: interview.meetingLink,
          description: interview.description,
          thankYouNote: interview.thankYouNote,
        })),
      }}
    />
  );
}
