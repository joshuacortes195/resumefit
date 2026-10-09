"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { DEGREE_LEVELS } from "@resumefit/scoring";
import { JOB_STATUSES } from "@resumefit/shared";
import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { getCurrentUser } from "@/lib/auth";
import { createJob } from "@/lib/data/jobs";
import { addToDictionary, deleteScans, getScan, setScansArchived, updateScan } from "@/lib/data/scans";

// what every action hands back, so the page can show a message when something is off
export type ActionResult = { ok: true } | { ok: false; error: string };

const id = z.uuid();
const fail = (error: string): ActionResult => ({ ok: false, error });

// refreshes the pages that show scans
function refresh(scanId?: string) {
  if (scanId) revalidatePath(`/scans/${scanId}`);
  revalidatePath("/scans");
  revalidatePath("/dashboard");
}

// saves the title shown at the top of the report
export async function renameScan(scanId: string, input: { company: string; jobTitle: string }): Promise<ActionResult> {
  const parsed = z.object({ scanId: id, company: z.string().trim().max(200), jobTitle: z.string().trim().max(200) }).safeParse({ scanId, ...input });
  if (!parsed.success) return fail("That title is too long.");
  const user = await getCurrentUser();
  const scan = await updateScan(user.id, parsed.data.scanId, { company: parsed.data.company || null, jobTitle: parsed.data.jobTitle || null });
  if (!scan) return fail("We could not find that scan.");
  // the tracker card keeps the same name
  if (scan.jobId && parsed.data.jobTitle) {
    const db = await getDb();
    await db
      .update(schema.jobs)
      .set({ title: parsed.data.jobTitle, company: parsed.data.company || null })
      .where(and(eq(schema.jobs.id, scan.jobId), eq(schema.jobs.userId, user.id)));
  }
  refresh(scanId);
  return { ok: true };
}

// changes the job title the report looks for in the resume
export async function setTargetTitle(scanId: string, title: string): Promise<ActionResult> {
  const parsed = z.object({ scanId: id, title: z.string().trim().max(200) }).safeParse({ scanId, title });
  if (!parsed.success) return fail("That title is too long.");
  const user = await getCurrentUser();
  if (!(await updateScan(user.id, parsed.data.scanId, { jobTitleOverride: parsed.data.title || null }))) return fail("We could not find that scan.");
  refresh(scanId);
  return { ok: true };
}

// changes the degree the report compares the resume against
export async function setRequiredEducation(scanId: string, level: string): Promise<ActionResult> {
  const parsed = z.object({ scanId: id, level: z.enum([...DEGREE_LEVELS, "none", "auto"]) }).safeParse({ scanId, level });
  if (!parsed.success) return fail("Pick a degree from the list.");
  const user = await getCurrentUser();
  // auto goes back to whatever we read from the posting
  if (!(await updateScan(user.id, parsed.data.scanId, { educationOverride: parsed.data.level === "auto" ? null : parsed.data.level }))) return fail("We could not find that scan.");
  refresh(scanId);
  return { ok: true };
}

// adds a skill the job asks for that our lists did not catch
export async function addSkill(scanId: string, input: { name: string; category: "hard" | "soft"; remember: boolean }): Promise<ActionResult> {
  const parsed = z
    .object({ scanId: id, name: z.string().trim().min(2, "Type the skill first.").max(60, "Keep the skill name short."), category: z.enum(["hard", "soft"]), remember: z.boolean() })
    .safeParse({ scanId, ...input });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the skill name.");
  const user = await getCurrentUser();
  const scan = await getScan(user.id, parsed.data.scanId);
  if (!scan) return fail("We could not find that scan.");

  const { name, category, remember } = parsed.data;
  const inReport = [...scan.report.hardSkills, ...scan.report.softSkills].some((skill) => skill.name.toLowerCase() === name.toLowerCase());
  if (inReport) return fail(`${name} is already in this report.`);
  if (remember) await addToDictionary(user.id, { name, category });
  await updateScan(user.id, scan.id, { customSkills: [...scan.customSkills, { name, category }] });
  refresh(scanId);
  return { ok: true };
}

// takes back a skill that was added by hand
export async function removeSkill(scanId: string, name: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  const scan = id.safeParse(scanId).success ? await getScan(user.id, scanId) : null;
  if (!scan) return fail("We could not find that scan.");
  await updateScan(user.id, scan.id, { customSkills: scan.customSkills.filter((skill) => skill.name !== name) });
  refresh(scanId);
  return { ok: true };
}

// swaps in an edited job description and scores the scan again
export async function updateJobDescription(scanId: string, jdText: string): Promise<ActionResult> {
  const parsed = z.object({ scanId: id, jdText: z.string().trim().min(50, "Paste the full job description, this one looks too short.").max(60_000, "That job description is too long.") }).safeParse({ scanId, jdText });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the job description.");
  const user = await getCurrentUser();
  if (!(await updateScan(user.id, parsed.data.scanId, { jdText: parsed.data.jdText }))) return fail("We could not find that scan.");
  refresh(scanId);
  return { ok: true };
}

// puts the job from a scan on the tracker board
export async function trackScan(scanId: string): Promise<ActionResult & { jobId?: string }> {
  const user = await getCurrentUser();
  const scan = id.safeParse(scanId).success ? await getScan(user.id, scanId) : null;
  if (!scan) return fail("We could not find that scan.");
  if (scan.jobId) return { ok: true, jobId: scan.jobId };

  const job = await createJob(user.id, {
    title: scan.jobTitle ?? "Untitled job",
    company: scan.company,
    url: scan.jobUrl,
    description: scan.jdText,
    detectedAts: scan.report.jd.ats?.name ?? null,
    resumeId: scan.resumeId,
  });
  // every scan of the same posting points at the same card
  const db = await getDb();
  await db
    .update(schema.scans)
    .set({ jobId: job.id })
    .where(and(eq(schema.scans.userId, user.id), eq(schema.scans.jdHash, scan.jdHash)));
  refresh(scanId);
  revalidatePath("/tracker");
  return { ok: true, jobId: job.id };
}

// moves a tracked scan's job to another stage, tracking it first if needed
export async function setScanStatus(scanId: string, status: string, today: string): Promise<ActionResult> {
  const parsed = z.enum(JOB_STATUSES).safeParse(status);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) return fail("That date does not look right.");
  if (!parsed.success) return fail("Pick a status from the list.");
  const tracked = await trackScan(scanId);
  if (!tracked.ok || !tracked.jobId) return tracked;
  const user = await getCurrentUser();
  const db = await getDb();
  await db
    .update(schema.jobs)
    .set({ status: parsed.data, dateApplied: parsed.data === "applied" ? today : undefined })
    .where(and(eq(schema.jobs.id, tracked.jobId), eq(schema.jobs.userId, user.id)));
  refresh(scanId);
  revalidatePath("/tracker");
  return { ok: true };
}

// archives or restores scans from the history table
export async function archiveScans(scanIds: string[], archived: boolean): Promise<ActionResult> {
  const parsed = z.array(id).max(200).safeParse(scanIds);
  if (!parsed.success) return fail("Pick the scans first.");
  const user = await getCurrentUser();
  await setScansArchived(user.id, parsed.data, archived);
  refresh();
  return { ok: true };
}

// deletes scans for good
export async function removeScans(scanIds: string[]): Promise<ActionResult> {
  const parsed = z.array(id).max(200).safeParse(scanIds);
  if (!parsed.success) return fail("Pick the scans first.");
  const user = await getCurrentUser();
  await deleteScans(user.id, parsed.data);
  refresh();
  return { ok: true };
}
