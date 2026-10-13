import { z } from "zod";
import { jdHints } from "@/lib/ai/jd";
import { getCurrentUser } from "@/lib/auth";
import { getJob, updateJob } from "@/lib/data/jobs";
import { createScan, DAILY_SCAN_LIMIT, getScan, scansToday } from "@/lib/data/scans";
import { rateLimit } from "@/lib/rate-limit";
import { errorResponse, field, readForm, RequestError, resolveResume, webUrl } from "@/lib/scan-request";

// the job side of a new scan
const jobSchema = z.object({
  jdText: z.string({ error: "Paste the job description first." }).min(50, "Paste the full job description, this one looks too short.").max(60_000, "That job description is too long to scan."),
  jobTitle: z.string().max(200).optional(),
  company: z.string().max(200).optional(),
  jobUrl: webUrl("That job link does not look right. Paste the full address, starting with https://").optional(),
});

// reading a file is the heaviest thing the app does, so the host stops a request that is still going after this many seconds
export const maxDuration = 30;

// runs a new scan from the form: a resume (file, text or saved) plus a job description
export async function POST(request: Request): Promise<Response> {
  try {
    const user = await getCurrentUser();
    const form = await readForm(request);

    const job = jobSchema.safeParse({ jdText: field(form, "jdText"), jobTitle: field(form, "jobTitle"), company: field(form, "company"), jobUrl: field(form, "jobUrl") });
    if (!job.success) throw new RequestError(job.error.issues[0]?.message ?? "Check the job description.");
    await rateLimit(user.id, "scan");
    if ((await scansToday(user.id)) >= DAILY_SCAN_LIMIT) throw new RequestError(`You have run ${DAILY_SCAN_LIMIT} scans in the last day. Give it a rest and try again tomorrow.`, 429);

    // a rescan carries over the title, company and tracker job of the scan it came from
    const previousId = field(form, "previousScanId");
    const previous = previousId ? await getScan(user.id, previousId) : null;

    // a scan started from a tracker card stays attached to that card
    const jobId = field(form, "jobId");
    const card = jobId ? await getJob(user.id, jobId) : null;

    const resume = await resolveResume(user.id, form);
    // an optional smarter read of the posting, the scan carries on without it when it is not there
    const hints = await jdHints(user.id, job.data.jdText);
    const scan = await createScan(user.id, {
      hints,
      resumeId: resume.resumeId,
      resumeText: resume.text,
      layout: resume.layout,
      jdText: job.data.jdText,
      jobTitle: job.data.jobTitle ?? previous?.jobTitle,
      company: job.data.company ?? previous?.company,
      jobUrl: job.data.jobUrl ?? previous?.jobUrl,
      jobId: card?.id ?? previous?.jobId,
    });
    // the card remembers the resume it was last scanned with
    if (card) await updateJob(user.id, card.id, { resumeId: resume.resumeId, description: card.description || scan.jdText });
    return Response.json({ id: scan.id });
  } catch (error) {
    return errorResponse(error);
  }
}
