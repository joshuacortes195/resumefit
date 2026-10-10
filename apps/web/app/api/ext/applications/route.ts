import { z } from "zod";
import { webUrl } from "@/lib/scan-request";
import { APPLICATION_STATUSES } from "@resumefit/shared";
import { recordApplication } from "@/lib/data/applications";
import { getJob, updateJob } from "@/lib/data/jobs";
import { ExtError, extRoute, preflight } from "@/lib/ext-auth";

export const OPTIONS = preflight;

const reportSchema = z.object({
  jobId: z.uuid().nullable().default(null),
  ats: z.string().max(60).nullable().default(null),
  applyUrl: webUrl(),
  status: z.enum(APPLICATION_STATUSES),
  fieldsFilled: z.number().int().min(0).max(500).default(0),
  fieldsNeedingAttention: z.number().int().min(0).max(500).default(0),
  // the person's own date, so "date applied" matches their calendar
  today: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

// records how an autofill run went, and moves the job to applied once the person has submitted it
export const POST = extRoute(async (request, user) => {
  const parsed = reportSchema.safeParse(await request.json());
  if (!parsed.success) throw new ExtError("That application report could not be read.");
  const { today, ...report } = parsed.data;
  const job = report.jobId ? await getJob(user.id, report.jobId) : null;
  const id = await recordApplication(user.id, { ...report, jobId: job?.id ?? null });
  if (job && report.status === "applied") await updateJob(user.id, job.id, { status: "applied", dateApplied: job.dateApplied ?? today ?? new Date().toISOString().slice(0, 10) });
  return { id };
});
