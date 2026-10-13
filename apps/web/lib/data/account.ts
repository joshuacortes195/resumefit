import { eq, inArray } from "drizzle-orm";
import JSZip from "jszip";
import { getDb, schema } from "@/db";
import { handOverAdmin, markClaimed } from "@/lib/data/users";
import { clearRateLimits } from "@/lib/rate-limit";
import { safeErrorText } from "@/lib/log";
import { deleteFile, deleteFilesOf, loadFile } from "@/lib/storage";

// gathers every row that belongs to one person
async function everything(userId: string) {
  const db = await getDb();
  const own = <T extends { userId: unknown }>(table: T) => eq(table.userId as never, userId);
  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId));
  const [profile] = await db.select().from(schema.profiles).where(eq(schema.profiles.userId, userId));
  // the newer application answers are saved as one bundle next to the profile
  const [application] = await db.select({ value: schema.appSettings.value }).from(schema.appSettings).where(eq(schema.appSettings.key, `application:${userId}`));
  // a linkedin profile that was read in and is still waiting to be used
  const [pendingLinkedin] = await db.select({ value: schema.appSettings.value }).from(schema.appSettings).where(eq(schema.appSettings.key, `linkedin-import:${userId}`));
  const jobs = await db.select().from(schema.jobs).where(own(schema.jobs));
  const jobIds = jobs.map((job) => job.id);
  return {
    account: user ? { email: user.email, name: user.name, createdAt: user.createdAt } : null,
    profile: profile ?? null,
    application: application?.value ?? null,
    resumes: await db.select().from(schema.resumes).where(own(schema.resumes)),
    jobs,
    interviews: jobIds.length > 0 ? await db.select().from(schema.interviews).where(inArray(schema.interviews.jobId, jobIds)) : [],
    scans: await db.select().from(schema.scans).where(own(schema.scans)),
    coverLetters: await db.select().from(schema.coverLetters).where(own(schema.coverLetters)),
    optimizations: await db.select().from(schema.optimizations).where(own(schema.optimizations)),
    linkedinReports: await db.select().from(schema.linkedinReports).where(own(schema.linkedinReports)),
    interviewSessions: await db.select().from(schema.interviewSessions).where(own(schema.interviewSessions)),
    applications: await db.select().from(schema.applications).where(own(schema.applications)),
    pendingLinkedin: pendingLinkedin?.value ?? null,
    // which ai features were used and when. the text that was sent is never kept
    aiUsage: await db.select().from(schema.aiUsage).where(own(schema.aiUsage)),
  };
}

// a zip with all of someone's data as json, plus the resume files they uploaded
export async function exportAccount(userId: string): Promise<Uint8Array> {
  const data = await everything(userId);
  const zip = new JSZip();
  zip.file("README.txt", "Everything ResumeFit has stored for you.\n\ndata.json holds your profile, resumes, scans, jobs, interviews, cover letters, reports and a list of when you used the AI features.\nThe files folder holds the resume files you uploaded.\nSaved API keys and the extension's connection key are left out on purpose.\n");
  zip.file("data.json", JSON.stringify(data, null, 2));
  const taken = new Set<string>();
  for (const resume of data.resumes) {
    const bytes = resume.filePath ? await loadFile(resume.filePath) : null;
    if (!bytes) continue;
    const plain = `${resume.name.replace(/[^A-Za-z0-9 ._-]/g, "") || resume.id}.${resume.fileType ?? "pdf"}`;
    // two resumes with the same name each keep their own file
    const name = taken.has(plain.toLowerCase()) ? `${resume.id} ${plain}` : plain;
    taken.add(name.toLowerCase());
    zip.file(`files/${name}`, bytes);
  }
  return zip.generateAsync({ type: "uint8array" });
}

// removes a person and everything of theirs: stored files first, then the rows.
// a file that will not go stops the whole thing, so nothing is half deleted. the answer says whether the last sweep of their folder worked
export async function deleteAccount(userId: string): Promise<{ filesLeft: boolean }> {
  const db = await getDb();
  const files = await db.select({ filePath: schema.resumes.filePath }).from(schema.resumes).where(eq(schema.resumes.userId, userId));
  for (const { filePath } of files) if (filePath) await deleteFile(filePath);
  // then anything else in their folder, like a file left over from a resume that was deleted earlier
  const filesLeft = await deleteFilesOf(userId).then(
    () => false,
    (error) => {
      console.error(safeErrorText(error, "could not clear a stored files folder"));
      return true;
    },
  );
  // every other table hangs off the user and goes with it
  // a linkedin profile still waiting to be used goes too
  await db.delete(schema.appSettings).where(eq(schema.appSettings.key, `linkedin-import:${userId}`));
  await db.delete(schema.appSettings).where(eq(schema.appSettings.key, `extension-id:${userId}`));
  await db.delete(schema.appSettings).where(eq(schema.appSettings.key, `auto-submit:${userId}`));
  await db.delete(schema.appSettings).where(eq(schema.appSettings.key, `application:${userId}`));
  await clearRateLimits(userId);
  // the app has had its first admin, so emptying it does not make the next stranger one
  await markClaimed();
  // if this was the only admin, someone else takes over
  await handOverAdmin(userId);
  await db.delete(schema.users).where(eq(schema.users.id, userId));
  return { filesLeft };
}
