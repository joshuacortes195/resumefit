import { Suspense } from "react";
import { notFound } from "next/navigation";
import { JobModal } from "@/components/tracker/job-modal";
import { getCurrentUser } from "@/lib/auth";
import { getCoverLetter, getJob, latestScores, listInterviews } from "@/lib/data/jobs";
import { getResume, listResumes } from "@/lib/data/resumes";
import { JOB_TABS, type JobTab } from "@/lib/job-tabs";

export const metadata = { title: "Job" };

type Params = Promise<{ jobId: string; tab: string }>;

// one job's card, opened on top of the board
export default function JobPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={null}>
      <JobModalLoader params={params} />
    </Suspense>
  );
}

// loads everything the card's tabs show
async function JobModalLoader({ params }: { params: Params }) {
  const { jobId, tab } = await params;
  if (!(JOB_TABS as readonly string[]).includes(tab)) notFound();
  const user = await getCurrentUser();
  const job = await getJob(user.id, jobId);
  if (!job) notFound();

  const [scores, resumes, resume, coverLetter, interviews] = await Promise.all([
    latestScores(user.id, [job.id]),
    listResumes(user.id),
    job.resumeId ? getResume(user.id, job.resumeId) : null,
    getCoverLetter(user.id, job.id),
    listInterviews(user.id, job.id),
  ]);

  return (
    <JobModal
      // a new key per job so one card's half typed text never shows up in another
      key={job.id}
      tab={tab as JobTab}
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
