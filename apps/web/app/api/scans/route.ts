import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { createScan, DAILY_SCAN_LIMIT, getScan, scansToday } from "@/lib/data/scans";
import { errorResponse, field, RequestError, resolveResume } from "@/lib/scan-request";

// the job side of a new scan
const jobSchema = z.object({
  jdText: z.string({ error: "Paste the job description first." }).min(50, "Paste the full job description, this one looks too short.").max(60_000, "That job description is too long to scan."),
  jobTitle: z.string().max(200).optional(),
  company: z.string().max(200).optional(),
  jobUrl: z.url("That job link does not look right. Paste the full address, starting with https://").max(2000).optional(),
});

// runs a new scan from the form: a resume (file, text or saved) plus a job description
export async function POST(request: Request): Promise<Response> {
  try {
    const user = await getCurrentUser();
    const form = await request.formData();

    const job = jobSchema.safeParse({ jdText: field(form, "jdText"), jobTitle: field(form, "jobTitle"), company: field(form, "company"), jobUrl: field(form, "jobUrl") });
    if (!job.success) throw new RequestError(job.error.issues[0]?.message ?? "Check the job description.");
    if ((await scansToday(user.id)) >= DAILY_SCAN_LIMIT) throw new RequestError(`You have run ${DAILY_SCAN_LIMIT} scans in the last day. Give it a rest and try again tomorrow.`, 429);

    // a rescan carries over the title, company and tracker job of the scan it came from
    const previousId = field(form, "previousScanId");
    const previous = previousId ? await getScan(user.id, previousId) : null;

    const resume = await resolveResume(user.id, form);
    const scan = await createScan(user.id, {
      resumeId: resume.resumeId,
      resumeText: resume.text,
      layout: resume.layout,
      jdText: job.data.jdText,
      jobTitle: job.data.jobTitle ?? previous?.jobTitle,
      company: job.data.company ?? previous?.company,
      jobUrl: job.data.jobUrl ?? previous?.jobUrl,
      jobId: previous?.jobId,
    });
    return Response.json({ id: scan.id });
  } catch (error) {
    return errorResponse(error);
  }
}
