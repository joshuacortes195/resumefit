import { and, desc, eq } from "drizzle-orm";
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
  const db = await getDb();
  await db.delete(schema.resumes).where(and(eq(schema.resumes.userId, userId), eq(schema.resumes.id, id)));
  if (resume.filePath) await deleteFile(resume.filePath);
}
