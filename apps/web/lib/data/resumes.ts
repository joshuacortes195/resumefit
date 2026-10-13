import { and, count, desc, eq, gte } from "drizzle-orm";
import { parseResume, type LayoutMeta } from "@resumefit/scoring";
import type { ResumeSource } from "@resumefit/shared";
import { getDb, schema } from "@/db";
import { deleteFile, saveFile } from "@/lib/storage";

export type ResumeRow = typeof schema.resumes.$inferSelect;

// the short version of a resume used in pickers and lists
export type ResumeSummary = Pick<ResumeRow, "id" | "name" | "isBase" | "source" | "fileType" | "linkedJobId" | "createdAt" | "updatedAt">;

// what a new resume needs
export type NewResume = {
  name: string;
  text: string;
  source?: ResumeSource;
  layout?: LayoutMeta | null;
  // the original upload, kept so it can be downloaded later
  file?: { bytes: Uint8Array; type: "pdf" | "docx" };
  linkedJobId?: string | null;
};

// every resume a user has, newest first
export async function listResumes(userId: string): Promise<ResumeSummary[]> {
  const db = await getDb();
  return db
    .select({
      id: schema.resumes.id,
      name: schema.resumes.name,
      isBase: schema.resumes.isBase,
      source: schema.resumes.source,
      fileType: schema.resumes.fileType,
      linkedJobId: schema.resumes.linkedJobId,
      createdAt: schema.resumes.createdAt,
      updatedAt: schema.resumes.updatedAt,
    })
    .from(schema.resumes)
    .where(eq(schema.resumes.userId, userId))
    .orderBy(desc(schema.resumes.updatedAt));
}

// one resume, only if it belongs to this user
export async function getResume(userId: string, id: string): Promise<ResumeRow | null> {
  const db = await getDb();
  const [row] = await db
    .select()
    .from(schema.resumes)
    .where(and(eq(schema.resumes.id, id), eq(schema.resumes.userId, userId)))
    .limit(1);
  return row ?? null;
}

// how many new resumes one person can add in a day, just to stop a runaway script filling the storage
export const DAILY_RESUME_LIMIT = 100;

// how many resumes this person added in the last day
export async function resumesToday(userId: string): Promise<number> {
  const db = await getDb();
  const [row] = await db
    .select({ total: count() })
    .from(schema.resumes)
    .where(and(eq(schema.resumes.userId, userId), gte(schema.resumes.createdAt, new Date(Date.now() - 86_400_000))));
  return row?.total ?? 0;
}

// saves a resume, or hands back the one we already have with the exact same text
export async function saveResume(userId: string, resume: NewResume): Promise<ResumeRow> {
  const db = await getDb();
  const existing = await db
    .select()
    .from(schema.resumes)
    .where(and(eq(schema.resumes.userId, userId), eq(schema.resumes.rawText, resume.text)))
    .limit(1);
  if (existing[0] && !resume.linkedJobId) return existing[0];

  // the first resume someone adds becomes their base resume
  const hasAny = (await db.select({ id: schema.resumes.id }).from(schema.resumes).where(eq(schema.resumes.userId, userId)).limit(1)).length > 0;
  const [row] = await db
    .insert(schema.resumes)
    .values({
      userId,
      name: resume.name,
      isBase: !hasAny,
      source: resume.source ?? "upload",
      fileType: resume.file?.type ?? null,
      rawText: resume.text,
      parsed: parseResume(resume.text),
      layoutMeta: resume.layout ?? null,
      linkedJobId: resume.linkedJobId ?? null,
    })
    .returning();
  if (!row) throw new Error("Could not save the resume.");

  // keep the original file next to it
  if (resume.file) {
    const filePath = `${userId}/${row.id}.${resume.file.type}`;
    const contentType = resume.file.type === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    await saveFile(filePath, resume.file.bytes, contentType);
    await db.update(schema.resumes).set({ filePath }).where(eq(schema.resumes.id, row.id));
    row.filePath = filePath;
  }
  return row;
}

// makes one resume the base resume and clears the star from the others
export async function setBaseResume(userId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.transaction(async (tx) => {
    await tx.update(schema.resumes).set({ isBase: false }).where(and(eq(schema.resumes.userId, userId), eq(schema.resumes.isBase, true)));
    await tx.update(schema.resumes).set({ isBase: true }).where(and(eq(schema.resumes.userId, userId), eq(schema.resumes.id, id)));
  });
}

// renames a resume
export async function renameResume(userId: string, id: string, name: string): Promise<void> {
  const db = await getDb();
  await db.update(schema.resumes).set({ name }).where(and(eq(schema.resumes.userId, userId), eq(schema.resumes.id, id)));
}

// copies a resume under a new name
export async function duplicateResume(userId: string, id: string): Promise<ResumeRow | null> {
  const original = await getResume(userId, id);
  if (!original) return null;
  const db = await getDb();
  const [copy] = await db
    .insert(schema.resumes)
    .values({
      userId,
      name: `${original.name} (copy)`,
      isBase: false,
      source: original.source,
      fileType: null,
      rawText: original.rawText,
      parsed: original.parsed,
      layoutMeta: original.layoutMeta,
      builderData: original.builderData,
      templateSettings: original.templateSettings,
    })
    .returning();
  return copy ?? null;
}

// deletes a resume and its stored file
export async function deleteResume(userId: string, id: string): Promise<void> {
  const resume = await getResume(userId, id);
  if (!resume) return;
  // the stored file goes first. if that fails the resume stays, instead of leaving a file behind that nothing points at
  if (resume.filePath) await deleteFile(resume.filePath);
  const db = await getDb();
  await db.delete(schema.resumes).where(and(eq(schema.resumes.userId, userId), eq(schema.resumes.id, id)));
  // when the base resume is deleted, the most recent one left takes its place
  if (resume.isBase) {
    const [next] = await db.select({ id: schema.resumes.id }).from(schema.resumes).where(eq(schema.resumes.userId, userId)).orderBy(desc(schema.resumes.updatedAt)).limit(1);
    if (next) await db.update(schema.resumes).set({ isBase: true }).where(eq(schema.resumes.id, next.id));
  }
}

// a resume as the manager table shows it, with the job it was made for
export type ManagedResume = ResumeSummary & { jobTitle: string | null; jobCompany: string | null; words: number };

// every resume with its linked job, for the resume manager
export async function listManagedResumes(userId: string): Promise<ManagedResume[]> {
  const db = await getDb();
  const rows = await db
    .select({
      id: schema.resumes.id,
      name: schema.resumes.name,
      isBase: schema.resumes.isBase,
      source: schema.resumes.source,
      fileType: schema.resumes.fileType,
      linkedJobId: schema.resumes.linkedJobId,
      createdAt: schema.resumes.createdAt,
      updatedAt: schema.resumes.updatedAt,
      rawText: schema.resumes.rawText,
      jobTitle: schema.jobs.title,
      jobCompany: schema.jobs.company,
    })
    .from(schema.resumes)
    .leftJoin(schema.jobs, eq(schema.resumes.linkedJobId, schema.jobs.id))
    .where(eq(schema.resumes.userId, userId))
    .orderBy(desc(schema.resumes.isBase), desc(schema.resumes.updatedAt));
  return rows.map(({ rawText, ...row }) => ({ ...row, words: (rawText ?? "").split(/\s+/).filter(Boolean).length }));
}
