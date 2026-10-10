"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { JOB_STATUSES } from "@resumefit/shared";
import type { ActionResult } from "@/app/actions/scans";
import { getCurrentUser } from "@/lib/auth";
import { addInterview, createJob, deleteInterview, deleteJob, getJob, moveJob, saveCoverLetter, updateInterview, updateJob } from "@/lib/data/jobs";
import { getResume } from "@/lib/data/resumes";
import { ImportError, importJob, type ImportedJob } from "@/lib/job-import";

const id = z.uuid();
// the user's own date, sent from the browser so "date applied" matches their calendar
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const fail = (error: string): ActionResult => ({ ok: false, error });

// short optional text, empty becomes null
const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || null);

// a link that may be left empty
const link = z
  .string()
  .trim()
  .max(2000)
  .refine((value) => value === "" || /^https?:\/\/\S+$/i.test(value), "Links need to start with http:// or https://")
  .transform((value) => value || null);

// refreshes the pages that show jobs
function refresh(jobId?: string) {
  revalidatePath("/tracker", "layout");
  revalidatePath("/dashboard");
  revalidatePath("/scans");
  if (jobId) revalidatePath(`/tracker/${jobId}`, "layout");
}

const newJobSchema = z.object({
  title: z.string().trim().min(1, "Give the job a title.").max(200),
  company: text(200),
  location: text(200).default(null),
  url: link,
  description: text(60_000),
  status: z.enum(JOB_STATUSES),
});

// adds a job to the tracker by hand
export async function addJob(input: z.input<typeof newJobSchema>): Promise<ActionResult & { jobId?: string }> {
  const parsed = newJobSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the job details.");
  const user = await getCurrentUser();
  const job = await createJob(user.id, parsed.data);
  refresh();
  return { ok: true, jobId: job.id };
}

// reads the title, company and description off a job posting's link, so nobody has to type them out
export async function importJobFromLink(url: string): Promise<({ ok: true } & ImportedJob) | { ok: false; error: string }> {
  await getCurrentUser();
  const parsed = z.string().trim().min(1).max(2000).safeParse(url);
  if (!parsed.success) return { ok: false, error: "Paste the link to the job posting first." };
  try {
    return { ok: true, ...(await importJob(parsed.data)) };
  } catch (error) {
    // our own messages are safe to show, anything else gets a plain one
    return { ok: false, error: error instanceof ImportError ? error.message : "We could not read that page. Paste the details in instead." };
  }
}

// drops a card into a column at a spot, orderedIds is the column from top to bottom
export async function moveJobCard(jobId: string, status: string, orderedIds: string[], today: string): Promise<ActionResult> {
  const parsed = z.object({ jobId: id, status: z.enum(JOB_STATUSES), orderedIds: z.array(id).max(500), today: day }).safeParse({ jobId, status, orderedIds, today });
  if (!parsed.success) return fail("That move did not work. Try again.");
  const user = await getCurrentUser();
  await moveJob(user.id, parsed.data.jobId, parsed.data.status, parsed.data.orderedIds, parsed.data.today);
  refresh(jobId);
  return { ok: true };
}

const jobDetailsSchema = z.object({
  title: z.string().trim().min(1, "Give the job a title.").max(200),
  company: text(200),
  location: text(200),
  url: link,
  salary: text(100),
  description: text(60_000),
  dateApplied: z
    .string()
    .trim()
    .refine((value) => value === "" || /^\d{4}-\d{2}-\d{2}$/.test(value), "Pick a date from the calendar.")
    .transform((value) => value || null),
});

// saves the job tab of a card
export async function saveJobDetails(jobId: string, input: z.input<typeof jobDetailsSchema>): Promise<ActionResult> {
  const parsed = jobDetailsSchema.safeParse(input);
  if (!id.safeParse(jobId).success || !parsed.success) return fail(parsed.success ? "We could not find that job." : (parsed.error.issues[0]?.message ?? "Check the job details."));
  const user = await getCurrentUser();
  if (!(await updateJob(user.id, jobId, parsed.data))) return fail("We could not find that job.");
  refresh(jobId);
  return { ok: true };
}

// changes the stage a job is in from its card
export async function setJobStatus(jobId: string, status: string, today: string): Promise<ActionResult> {
  const parsed = z.object({ jobId: id, status: z.enum(JOB_STATUSES), today: day }).safeParse({ jobId, status, today });
  if (!parsed.success) return fail("Pick a status from the list.");
  const user = await getCurrentUser();
  const job = await getJob(user.id, parsed.data.jobId);
  if (!job) return fail("We could not find that job.");
  const dateApplied = parsed.data.status === "applied" && !job.dateApplied ? parsed.data.today : job.dateApplied;
  await updateJob(user.id, job.id, { status: parsed.data.status, dateApplied });
  refresh(jobId);
  return { ok: true };
}

// archives a job or brings it back to the board
export async function setJobArchived(jobId: string, archived: boolean): Promise<ActionResult> {
  if (!id.safeParse(jobId).success) return fail("We could not find that job.");
  const user = await getCurrentUser();
  if (!(await updateJob(user.id, jobId, { archived }))) return fail("We could not find that job.");
  refresh(jobId);
  return { ok: true };
}

// deletes a job for good
export async function removeJob(jobId: string): Promise<ActionResult> {
  if (!id.safeParse(jobId).success) return fail("We could not find that job.");
  const user = await getCurrentUser();
  await deleteJob(user.id, jobId);
  refresh();
  return { ok: true };
}

// saves the notes tab, called a moment after typing stops
export async function saveJobNotes(jobId: string, notes: string): Promise<ActionResult> {
  const parsed = z.object({ jobId: id, notes: z.string().max(20_000, "Notes are limited to 20,000 characters.") }).safeParse({ jobId, notes });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Could not save your notes.");
  const user = await getCurrentUser();
  if (!(await updateJob(user.id, parsed.data.jobId, { notes: parsed.data.notes }))) return fail("We could not find that job.");
  return { ok: true };
}

// picks which resume goes with a job
export async function setJobResume(jobId: string, resumeId: string): Promise<ActionResult> {
  const parsed = z.object({ jobId: id, resumeId: id }).safeParse({ jobId, resumeId });
  if (!parsed.success) return fail("Pick a resume from the list.");
  const user = await getCurrentUser();
  if (!(await getResume(user.id, parsed.data.resumeId))) return fail("We could not find that resume.");
  if (!(await updateJob(user.id, parsed.data.jobId, { resumeId: parsed.data.resumeId }))) return fail("We could not find that job.");
  refresh(jobId);
  return { ok: true };
}

// saves the cover letter tab
export async function saveJobCoverLetter(jobId: string, content: string): Promise<ActionResult> {
  const parsed = z.object({ jobId: id, content: z.string().max(20_000, "Cover letters are limited to 20,000 characters.") }).safeParse({ jobId, content });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Could not save the cover letter.");
  const user = await getCurrentUser();
  await saveCoverLetter(user.id, parsed.data.jobId, parsed.data.content);
  refresh(jobId);
  return { ok: true };
}

const interviewSchema = z.object({
  type: z.enum(["Phone screen", "Technical", "Behavioral", "Onsite", "Final", "Other"]),
  // comes from a date and time picker, empty when not scheduled yet
  datetime: z
    .string()
    .trim()
    .transform((value) => (value ? new Date(value) : null))
    .refine((value) => value === null || !Number.isNaN(value.getTime()), "Pick a date and time."),
  interviewerName: text(200),
  phone: text(50),
  email: z
    .string()
    .trim()
    .max(200)
    .refine((value) => value === "" || z.email().safeParse(value).success, "That email does not look right.")
    .transform((value) => value || null),
  meetingLink: link,
  description: text(5000),
});

// adds an interview to a job
export async function addJobInterview(jobId: string, input: z.input<typeof interviewSchema>): Promise<ActionResult> {
  const parsed = interviewSchema.safeParse(input);
  if (!id.safeParse(jobId).success || !parsed.success) return fail(parsed.success ? "We could not find that job." : (parsed.error.issues[0]?.message ?? "Check the interview details."));
  const user = await getCurrentUser();
  if (!(await addInterview(user.id, jobId, parsed.data))) return fail("We could not find that job.");
  refresh(jobId);
  return { ok: true };
}

// saves the thank you note written for an interview
export async function saveThankYouNote(jobId: string, interviewId: string, note: string): Promise<ActionResult> {
  const parsed = z.object({ interviewId: id, note: z.string().max(5000) }).safeParse({ interviewId, note });
  if (!parsed.success) return fail("That note is too long.");
  const user = await getCurrentUser();
  await updateInterview(user.id, parsed.data.interviewId, { thankYouNote: parsed.data.note });
  refresh(jobId);
  return { ok: true };
}

// removes an interview
export async function removeInterview(jobId: string, interviewId: string): Promise<ActionResult> {
  if (!id.safeParse(interviewId).success) return fail("We could not find that interview.");
  const user = await getCurrentUser();
  await deleteInterview(user.id, interviewId);
  refresh(jobId);
  return { ok: true };
}
