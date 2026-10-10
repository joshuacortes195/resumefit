import { eq, inArray } from "drizzle-orm";
import JSZip from "jszip";
import { getDb, schema } from "@/db";
import { deleteFile, loadFile } from "@/lib/storage";

// gathers every row that belongs to one person
async function everything(userId: string) {
  const db = await getDb();
  const own = <T extends { userId: unknown }>(table: T) => eq(table.userId as never, userId);
  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId));
  const [profile] = await db.select().from(schema.profiles).where(eq(schema.profiles.userId, userId));
  const jobs = await db.select().from(schema.jobs).where(own(schema.jobs));
  const jobIds = jobs.map((job) => job.id);
  return {
    account: user ? { email: user.email, name: user.name, createdAt: user.createdAt } : null,
    profile: profile ?? null,
    resumes: await db.select().from(schema.resumes).where(own(schema.resumes)),
    jobs,
    interviews: jobIds.length > 0 ? await db.select().from(schema.interviews).where(inArray(schema.interviews.jobId, jobIds)) : [],
    scans: await db.select().from(schema.scans).where(own(schema.scans)),
    coverLetters: await db.select().from(schema.coverLetters).where(own(schema.coverLetters)),
    optimizations: await db.select().from(schema.optimizations).where(own(schema.optimizations)),
    linkedinReports: await db.select().from(schema.linkedinReports).where(own(schema.linkedinReports)),
    interviewSessions: await db.select().from(schema.interviewSessions).where(own(schema.interviewSessions)),
    applications: await db.select().from(schema.applications).where(own(schema.applications)),
  };
}

// a zip with all of someone's data as json, plus the resume files they uploaded
export async function exportAccount(userId: string): Promise<Uint8Array> {
  const data = await everything(userId);
  const zip = new JSZip();
  zip.file("README.txt", "Everything ResumeFit has stored for you.\n\ndata.json holds your profile, resumes, scans, jobs, interviews, cover letters and reports.\nThe files folder holds the resume files you uploaded.\nSaved API keys and the extension's connection key are left out on purpose.\n");
  zip.file("data.json", JSON.stringify(data, null, 2));
  for (const resume of data.resumes) {
    const bytes = resume.filePath ? await loadFile(resume.filePath) : null;
    if (bytes) zip.file(`files/${resume.name.replace(/[^A-Za-z0-9 ._-]/g, "") || resume.id}.${resume.fileType ?? "pdf"}`, bytes);
  }
  return zip.generateAsync({ type: "uint8array" });
}

// removes a person and everything of theirs: stored files first, then the rows
export async function deleteAccount(userId: string): Promise<void> {
  const db = await getDb();
  const files = await db.select({ filePath: schema.resumes.filePath }).from(schema.resumes).where(eq(schema.resumes.userId, userId));
  for (const { filePath } of files) if (filePath) await deleteFile(filePath);
  // every other table hangs off the user and goes with it
  // a linkedin profile still waiting to be used goes too
  await db.delete(schema.appSettings).where(eq(schema.appSettings.key, `linkedin-import:${userId}`));
  await db.delete(schema.appSettings).where(eq(schema.appSettings.key, `extension-id:${userId}`));
  await db.delete(schema.appSettings).where(eq(schema.appSettings.key, `auto-submit:${userId}`));
  await db.delete(schema.users).where(eq(schema.users.id, userId));
}
