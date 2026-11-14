import { z } from "zod";
import { APPLICATION_STATUSES } from "@resumefit/shared";
import { requireAutoApply } from "@/lib/auto-apply";
import { recordApplication } from "@/lib/data/applications";
import { getJob, updateJob } from "@/lib/data/jobs";
import { getResume } from "@/lib/data/resumes";
import { ExtError, extRoute, preflight } from "@/lib/ext-auth";
import { rateLimit } from "@/lib/rate-limit";
import { webUrl } from "@/lib/scan-request";

export const OPTIONS = preflight;

const reportSchema = z.object({
  jobId: z.uuid().nullable().default(null),
  ats: z.string().max(60).nullable().default(null),
  applyUrl: webUrl(),
  status: z.enum(APPLICATION_STATUSES),
  fieldsFilled: z.number().int().min(0).max(500).default(0),
  fieldsNeedingAttention: z.number().int().min(0).max(500).default(0),
  // what was put on the form, kept so the person can look back at what they sent
  answers: z
    .array(z.object({ label: z.string().max(300), value: z.string().max(3000), status: z.enum(["filled", "review", "missing", "skipped"]) }))
    .max(120)
    .optional(),
  resumeId: z.uuid().nullable().default(null),
  coverLetter: z.boolean().default(false),
  // auto when the extension pressed Submit because the person asked it to
  sentBy: z.enum(["me", "auto"]).default("me"),
  // what the form still needs from the person, so they can answer it in the app
  waiting: z
    .array(z.object({ label: z.string().min(1).max(300), written: z.boolean(), options: z.array(z.string().max(200)).max(40).optional() }))
    .max(40)
    .default([]),
  // why the form can never be sent for the person, when that is so
  stuck: z.string().max(200).nullable().default(null),
  // the person's own date, so "date applied" matches their calendar
  today: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

// records how one auto apply run went. when the person says they submitted it, the tracker card moves to Applied
export const POST = extRoute(async (request, user) => {
  await requireAutoApply();
  await rateLimit(user.id, "save-job");
  const parsed = reportSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) throw new ExtError("That application report could not be read.");
  const { today, answers, resumeId, coverLetter, sentBy, waiting, stuck, ...report } = parsed.data;
  // a job or resume id that is not the caller's own is dropped, never trusted
  const job = report.jobId ? await getJob(user.id, report.jobId) : null;
  const resume = resumeId ? await getResume(user.id, resumeId) : null;
  const applied = report.status === "applied";
  const day = today ?? new Date().toISOString().slice(0, 10);
  const details = answers ? { answers, resumeId: resume?.id ?? null, resumeName: resume?.name ?? null, coverLetter, appliedAt: applied ? day : null, waiting: applied ? [] : waiting, stuck: applied ? null : stuck, ...(applied ? { sentBy, sentAt: new Date().toISOString() } : {}) } : undefined;
  const id = await recordApplication(user.id, { ...report, jobId: job?.id ?? null, details });
  // the card remembers when it was sent and which resume went with it
  if (job && applied) await updateJob(user.id, job.id, { status: "applied", dateApplied: job.dateApplied ?? day, ...(resume ? { resumeId: resume.id } : {}) });
  return { id };
});
