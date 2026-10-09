import { and, desc, eq } from "drizzle-orm";
import type { ApplicationStatus } from "@resumefit/shared";
import { getDb, schema } from "@/db";

export type ApplicationRow = typeof schema.applications.$inferSelect;

// an application with the job it is for
export type ApplicationItem = Pick<ApplicationRow, "id" | "ats" | "applyUrl" | "status" | "fieldsFilled" | "fieldsNeedingAttention" | "createdAt" | "updatedAt" | "jobId"> & { jobTitle: string | null; company: string | null };

// every autofill run, newest first
export async function listApplications(userId: string): Promise<ApplicationItem[]> {
  const db = await getDb();
  return db
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
    })
    .from(schema.applications)
    .leftJoin(schema.jobs, eq(schema.applications.jobId, schema.jobs.id))
    .where(eq(schema.applications.userId, userId))
    .orderBy(desc(schema.applications.updatedAt));
}

// what the extension reports about one autofill run
export type ApplicationReport = { jobId: string | null; ats: string | null; applyUrl: string; status: ApplicationStatus; fieldsFilled: number; fieldsNeedingAttention: number };

// records an autofill run, updating the row for the same page when there is one
export async function recordApplication(userId: string, report: ApplicationReport): Promise<string> {
  const db = await getDb();
  const [existing] = await db
    .select({ id: schema.applications.id })
    .from(schema.applications)
    .where(and(eq(schema.applications.userId, userId), eq(schema.applications.applyUrl, report.applyUrl)))
    .limit(1);
  if (existing) {
    await db.update(schema.applications).set(report).where(eq(schema.applications.id, existing.id));
    return existing.id;
  }
  const [row] = await db
    .insert(schema.applications)
    .values({ userId, ...report })
    .returning({ id: schema.applications.id });
  if (!row) throw new Error("Could not record the application.");
  return row.id;
}
