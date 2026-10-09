import { and, asc, count, eq, gte, max } from "drizzle-orm";
import type { JobStatus } from "@resumefit/shared";
import { getDb, schema } from "@/db";

export type JobRow = typeof schema.jobs.$inferSelect;

// what a new tracker job needs
export type NewJob = {
  title: string;
  company?: string | null;
  location?: string | null;
  url?: string | null;
  salary?: string | null;
  description?: string | null;
  detectedAts?: string | null;
  status?: JobStatus;
  resumeId?: string | null;
};

// adds a job to the bottom of its column on the tracker
export async function createJob(userId: string, job: NewJob): Promise<JobRow> {
  const db = await getDb();
  const status = job.status ?? "saved";
  const [last] = await db
    .select({ position: max(schema.jobs.position) })
    .from(schema.jobs)
    .where(and(eq(schema.jobs.userId, userId), eq(schema.jobs.status, status)));
  const [row] = await db
    .insert(schema.jobs)
    .values({
      userId,
      title: job.title,
      company: job.company ?? null,
      location: job.location ?? null,
      url: job.url ?? null,
      salary: job.salary ?? null,
      description: job.description ?? null,
      detectedAts: job.detectedAts ?? null,
      status,
      resumeId: job.resumeId ?? null,
      position: (last?.position ?? -1) + 1,
    })
    .returning();
  if (!row) throw new Error("Could not save the job.");
  return row;
}

// one job, only if it belongs to this user
export async function getJob(userId: string, id: string): Promise<JobRow | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const db = await getDb();
  const [row] = await db
    .select()
    .from(schema.jobs)
    .where(and(eq(schema.jobs.id, id), eq(schema.jobs.userId, userId)))
    .limit(1);
  return row ?? null;
}

// how many jobs sit in each tracker column, archived ones left out
export async function jobCounts(userId: string): Promise<Record<JobStatus, number>> {
  const db = await getDb();
  const rows = await db
    .select({ status: schema.jobs.status, total: count() })
    .from(schema.jobs)
    .where(and(eq(schema.jobs.userId, userId), eq(schema.jobs.archived, false)))
    .groupBy(schema.jobs.status);
  const counts: Record<JobStatus, number> = { saved: 0, applied: 0, interview: 0, offer: 0, rejected: 0 };
  for (const row of rows) counts[row.status] = row.total;
  return counts;
}

// the soonest interview that has not happened yet
export async function nextInterview(userId: string): Promise<{ datetime: Date; type: string; jobId: string; jobTitle: string; company: string | null } | null> {
  const db = await getDb();
  const [row] = await db
    .select({ datetime: schema.interviews.datetime, type: schema.interviews.type, jobId: schema.jobs.id, jobTitle: schema.jobs.title, company: schema.jobs.company })
    .from(schema.interviews)
    .innerJoin(schema.jobs, eq(schema.interviews.jobId, schema.jobs.id))
    .where(and(eq(schema.jobs.userId, userId), gte(schema.interviews.datetime, new Date())))
    .orderBy(asc(schema.interviews.datetime))
    .limit(1);
  return row?.datetime ? { ...row, datetime: row.datetime } : null;
}
