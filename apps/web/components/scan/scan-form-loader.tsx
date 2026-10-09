import { ScanForm } from "@/components/scan-form";
import { getCurrentUser } from "@/lib/auth";
import { getJob } from "@/lib/data/jobs";
import { listResumes } from "@/lib/data/resumes";

// the scan form, filled with the user's saved resumes and, when asked, a job from the tracker
export async function ScanFormLoader({ searchParams }: { searchParams?: Promise<{ job?: string }> }) {
  const user = await getCurrentUser();
  const jobId = (await searchParams)?.job;
  const [resumes, job] = await Promise.all([listResumes(user.id), jobId ? getJob(user.id, jobId) : null]);
  return (
    <ScanForm
      resumes={resumes.map(({ id, name, isBase }) => ({ id, name, isBase }))}
      job={job ? { id: job.id, jdText: job.description ?? "", title: job.title, company: job.company ?? "", url: job.url ?? "" } : undefined}
    />
  );
}
