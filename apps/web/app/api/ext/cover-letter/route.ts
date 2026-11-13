import { requireAutoApply } from "@/lib/auto-apply";
import { getCoverLetter, getJob } from "@/lib/data/jobs";
import { letterPdf } from "@/lib/export/pdf";
import { ExtError, extRoute, preflight } from "@/lib/ext-auth";
import { rateLimit } from "@/lib/rate-limit";

export const OPTIONS = preflight;

export const maxDuration = 30;

// hands the extension the cover letter saved on a tracker card as a pdf, to attach to that job's application
export const GET = extRoute(async (request, user) => {
  await requireAutoApply();
  await rateLimit(user.id, "ext-file");
  const jobId = new URL(request.url).searchParams.get("jobId") ?? "";
  // the job has to be the caller's own, and has to have a letter written for it
  const job = await getJob(user.id, jobId);
  const letter = job ? await getCoverLetter(user.id, job.id) : null;
  if (!job || !letter?.content.trim()) throw new ExtError("There is no cover letter saved for that job.", 404);
  const bytes = await letterPdf(letter.content);
  return { name: "Cover-Letter.pdf", type: "application/pdf", base64: Buffer.from(bytes).toString("base64") };
});
