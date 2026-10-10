import { Suspense } from "react";
import { CoverLetterStudio } from "@/components/cover-letter-studio";
import { Skeleton } from "@/components/ui/skeleton";
import { remainingToday } from "@/lib/ai/limits";
import { aiAvailable } from "@/lib/ai/router";
import { getCurrentUser } from "@/lib/auth";
import { listJobs } from "@/lib/data/jobs";
import { listResumes } from "@/lib/data/resumes";
import { listScans } from "@/lib/data/scans";

export const metadata = { title: "AI Cover Letter" };

// cover letter page: pick what to write from, then edit and export the letter
export default function CoverLetterPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-3xl font-semibold">AI Cover Letter</h1>
      <p className="mt-1 mb-6 max-w-2xl text-muted">Pick a resume, say which job it is for and get a first draft. It only uses what is in your resume, so check it and add the parts only you know.</p>
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Studio />
      </Suspense>
    </div>
  );
}

// loads the resumes, scans and jobs the form offers
async function Studio() {
  const user = await getCurrentUser();
  const [resumes, scans, jobs, available, remaining] = await Promise.all([listResumes(user.id), listScans(user.id, { pageSize: 12 }), listJobs(user.id), aiAvailable(user.id), remainingToday(user.id, "cover-letter")]);
  const label = (title: string | null, company: string | null) => [title ?? "Untitled", company].filter(Boolean).join(" for ");
  return (
    <CoverLetterStudio
      resumes={resumes.map(({ id, name, isBase }) => ({ id, name, isBase }))}
      scans={scans.items.map((scan) => ({ id: scan.id, label: label(scan.jobTitle, scan.company), jobId: scan.jobId, resumeId: scan.resumeId }))}
      jobs={jobs.map((job) => ({ id: job.id, label: label(job.title, job.company) }))}
      ai={{ available, remaining }}
    />
  );
}
