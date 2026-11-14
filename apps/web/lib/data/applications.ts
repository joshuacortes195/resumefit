import { and, desc, eq, gte, or } from "drizzle-orm";
import type { ApplicationStatus } from "@resumefit/shared";
import { getDb, schema } from "@/db";
import { decrypt, encrypt } from "@/lib/ai/crypto";
import { encryptionSecret } from "@/lib/ai/secret";

export type ApplicationRow = typeof schema.applications.$inferSelect;

// one answer that was put on the form, as the extension reports it
export type UsedAnswer = { label: string; value: string; status: "filled" | "review" | "missing" | "skipped" };

// what was used on one application: the answers, the resume and whether a cover letter went with it
export type ApplicationDetails = { answers: UsedAnswer[]; resumeId: string | null; resumeName: string | null; coverLetter: boolean; appliedAt: string | null; sentBy?: "me" | "auto"; sentAt?: string };

// an application with the job it is for
export type ApplicationItem = Pick<ApplicationRow, "id" | "ats" | "applyUrl" | "status" | "fieldsFilled" | "fieldsNeedingAttention" | "createdAt" | "updatedAt" | "jobId"> & { jobTitle: string | null; company: string | null; sentBy: "me" | "auto" };

// the copy of the answers holds things like work authorization, so it is locked the same way the application profile is
function seal(details: ApplicationDetails): { sealed: string } | null {
  const secret = encryptionSecret();
  return secret ? { sealed: encrypt(JSON.stringify(details), secret) } : null;
}

// unlocks a saved copy of the answers, null when there is none or it cannot be read
export function openDetails(stored: unknown): ApplicationDetails | null {
  const sealed = (stored as { sealed?: unknown } | null)?.sealed;
  const secret = encryptionSecret();
  if (typeof sealed !== "string" || !secret) return null;
  const opened = decrypt(sealed, secret);
  return opened === null ? null : (JSON.parse(opened) as ApplicationDetails);
}

// every auto apply run, newest first
export async function listApplications(userId: string): Promise<ApplicationItem[]> {
  const db = await getDb();
  const rows = await db
    .select({
      id: schema.applications.id,
      ats: schema.applications.ats,
      applyUrl: schema.applications.applyUrl,
      status: schema.applications.status,
      fieldsFilled: schema.applications.fieldsFilled,
      fieldsNeedingAttention: schema.applications.fieldsNeedingAttention,
      createdAt: schema.applications.createdAt,
      updatedAt: schema.applications.updatedAt,
      jobId: schema.applications.jobId,
      jobTitle: schema.jobs.title,
      company: schema.jobs.company,
      aiAnswers: schema.applications.aiAnswers,
    })
    .from(schema.applications)
    .leftJoin(schema.jobs, eq(schema.applications.jobId, schema.jobs.id))
    .where(eq(schema.applications.userId, userId))
    .orderBy(desc(schema.applications.updatedAt));
  // the locked copy of the answers stays behind, only who pressed Submit comes out of it
  return rows.map(({ aiAnswers, ...row }) => ({ ...row, sentBy: openDetails(aiAnswers)?.sentBy ?? "me" }));
}

// how many applications were sent for this person, by us and not by them, in the last 24 hours
export async function autoSentLastDay(userId: string, now = new Date()): Promise<number> {
  const db = await getDb();
  const rows = await db
    .select({ aiAnswers: schema.applications.aiAnswers })
    .from(schema.applications)
    .where(and(eq(schema.applications.userId, userId), eq(schema.applications.status, "applied"), gte(schema.applications.updatedAt, new Date(now.getTime() - 86_400_000))));
  return rows.filter((row) => {
    const details = openDetails(row.aiAnswers);
    return details?.sentBy === "auto" && details.sentAt !== undefined && now.getTime() - new Date(details.sentAt).getTime() < 86_400_000;
  }).length;
}

// the newest run for one tracker card, with the answers that were used on it
export async function applicationForJob(userId: string, jobId: string): Promise<(ApplicationRow & { details: ApplicationDetails | null }) | null> {
  const db = await getDb();
  const [row] = await db
    .select()
    .from(schema.applications)
    .where(and(eq(schema.applications.userId, userId), eq(schema.applications.jobId, jobId)))
    .orderBy(desc(schema.applications.updatedAt))
    .limit(1);
  return row ? { ...row, details: openDetails(row.aiAnswers) } : null;
}

// what the extension reports about one run
export type ApplicationReport = { jobId: string | null; ats: string | null; applyUrl: string; status: ApplicationStatus; fieldsFilled: number; fieldsNeedingAttention: number; details?: ApplicationDetails };

// records a run, updating the row for the same job or the same page when there is one
export async function recordApplication(userId: string, report: ApplicationReport): Promise<string> {
  const db = await getDb();
  const { details, ...columns } = report;
  // a report without the answers, like "this one failed", keeps the copy that was saved before
  const values = details ? { ...columns, aiAnswers: seal(details) } : columns;
  // the form can sit at a different address than the posting, so a run for a known job is found by the job
  const same = report.jobId ? or(eq(schema.applications.jobId, report.jobId), eq(schema.applications.applyUrl, report.applyUrl)) : eq(schema.applications.applyUrl, report.applyUrl);
  const [existing] = await db
    .select({ id: schema.applications.id })
    .from(schema.applications)
    .where(and(eq(schema.applications.userId, userId), same))
    .orderBy(desc(schema.applications.updatedAt))
    .limit(1);
  if (existing) {
    await db.update(schema.applications).set(values).where(eq(schema.applications.id, existing.id));
    return existing.id;
  }
  const [row] = await db
    .insert(schema.applications)
    .values({ userId, ...values })
    .returning({ id: schema.applications.id });
  if (!row) throw new Error("Could not record the application.");
  return row.id;
}
