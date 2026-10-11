import { and, asc, count, desc, eq, gte, inArray, max } from "drizzle-orm";
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

// what we know about a posting when deciding which tracker card it belongs to
export type Posting = { title?: string | null; company?: string | null; url?: string | null };

// lowercases a name and drops punctuation, so "Acme, Inc." and "acme inc" compare equal
const plain = (text: string | null | undefined) => (text ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

// true when a tracker card and a posting are the same job. this is the one rule every link between a scan and a card goes through.
// the titles have to agree, and then either the company or the link has to agree too. a link alone only counts when there is no title to go on
export function samePosting(card: Posting, posting: Posting): boolean {
  const sameLink = Boolean(card.url && posting.url && card.url === posting.url);
  const [cardTitle, title] = [plain(card.title), plain(posting.title)];
  if (!cardTitle || !title) return sameLink;
  if (cardTitle !== title) return false;
  const [cardCompany, company] = [plain(card.company), plain(posting.company)];
  // two different companies can post a job with the same title
  if (cardCompany && company) return cardCompany === company;
  return sameLink;
}

// finds the tracker card for a posting, null when it has none yet. the card the caller names is checked like any other
export async function findCard(userId: string, posting: Posting, namedId?: string | null): Promise<string | null> {
  const db = await getDb();
  const cards = await db
    .select({ id: schema.jobs.id, title: schema.jobs.title, company: schema.jobs.company, url: schema.jobs.url, archived: schema.jobs.archived })
    .from(schema.jobs)
    .where(eq(schema.jobs.userId, userId))
    .orderBy(desc(schema.jobs.createdAt));
  const matches = cards.filter((card) => samePosting(card, posting));
  // the named card first, then one still on the board, then the newest
  return (matches.find((card) => card.id === namedId) ?? matches.find((card) => !card.archived) ?? matches[0])?.id ?? null;
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

// a job as the board shows it, with the score of its latest scan
export type BoardJob = Pick<JobRow, "id" | "title" | "company" | "status" | "position" | "archived" | "createdAt" | "url"> & { matchRate: number | null };

// every job for the board, in column order
export async function listJobs(userId: string, archived = false): Promise<BoardJob[]> {
  const db = await getDb();
  const rows = await db
    .select({
      id: schema.jobs.id,
      title: schema.jobs.title,
      company: schema.jobs.company,
      status: schema.jobs.status,
      position: schema.jobs.position,
      archived: schema.jobs.archived,
      createdAt: schema.jobs.createdAt,
      url: schema.jobs.url,
    })
    .from(schema.jobs)
    .where(and(eq(schema.jobs.userId, userId), eq(schema.jobs.archived, archived)))
    .orderBy(asc(schema.jobs.position), asc(schema.jobs.createdAt));
  const scores = await latestScores(userId, rows.map((row) => row.id));
  return rows.map((row) => ({ ...row, matchRate: scores.get(row.id)?.matchRate ?? null }));
}

// the newest scan of each job, plus how many scans it has had
export async function latestScores(userId: string, jobIds: string[]): Promise<Map<string, { matchRate: number; scanId: string; scans: number }>> {
  const scores = new Map<string, { matchRate: number; scanId: string; scans: number }>();
  if (jobIds.length === 0) return scores;
  const db = await getDb();
  const rows = await db
    .select({ id: schema.scans.id, jobId: schema.scans.jobId, matchRate: schema.scans.matchRate })
    .from(schema.scans)
    .where(and(eq(schema.scans.userId, userId), inArray(schema.scans.jobId, jobIds)))
    .orderBy(desc(schema.scans.createdAt));
  for (const row of rows) {
    if (!row.jobId) continue;
    const seen = scores.get(row.jobId);
    // rows come newest first, so the first one we see for a job is its latest
    if (seen) seen.scans += 1;
    else scores.set(row.jobId, { matchRate: row.matchRate, scanId: row.id, scans: 1 });
  }
  return scores;
}

// the fields of a job that can be edited from its card
export type JobChanges = Partial<Pick<JobRow, "title" | "company" | "location" | "url" | "salary" | "description" | "dateApplied" | "notes" | "status" | "archived" | "resumeId">>;

// saves edits to a job
export async function updateJob(userId: string, id: string, changes: JobChanges): Promise<JobRow | null> {
  const db = await getDb();
  const [row] = await db
    .update(schema.jobs)
    .set(changes)
    .where(and(eq(schema.jobs.id, id), eq(schema.jobs.userId, userId)))
    .returning();
  return row ?? null;
}

// drops a card into a column, orderedIds is that column from top to bottom after the move
export async function moveJob(userId: string, id: string, status: JobStatus, orderedIds: string[], today: string): Promise<void> {
  const db = await getDb();
  await db.transaction(async (tx) => {
    const [job] = await tx
      .select({ status: schema.jobs.status, dateApplied: schema.jobs.dateApplied })
      .from(schema.jobs)
      .where(and(eq(schema.jobs.id, id), eq(schema.jobs.userId, userId)))
      .limit(1);
    if (!job) return;
    // a card that lands in applied for the first time gets today's date
    const dateApplied = status === "applied" && !job.dateApplied ? today : job.dateApplied;
    await tx.update(schema.jobs).set({ status, dateApplied }).where(and(eq(schema.jobs.id, id), eq(schema.jobs.userId, userId)));
    // renumber the column so the order sticks
    for (const [position, jobId] of orderedIds.entries()) {
      await tx.update(schema.jobs).set({ position }).where(and(eq(schema.jobs.id, jobId), eq(schema.jobs.userId, userId), eq(schema.jobs.status, status)));
    }
  });
}

// deletes a job and everything hanging off it
export async function deleteJob(userId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.delete(schema.jobs).where(and(eq(schema.jobs.id, id), eq(schema.jobs.userId, userId)));
}

export type InterviewRow = typeof schema.interviews.$inferSelect;
export type NewInterview = Pick<InterviewRow, "type" | "datetime" | "interviewerName" | "phone" | "email" | "meetingLink" | "description">;

// the interviews for a job, soonest first
export async function listInterviews(userId: string, jobId: string): Promise<InterviewRow[]> {
  if (!(await getJob(userId, jobId))) return [];
  const db = await getDb();
  return db.select().from(schema.interviews).where(eq(schema.interviews.jobId, jobId)).orderBy(asc(schema.interviews.datetime));
}

// adds an interview to a job the user owns
export async function addInterview(userId: string, jobId: string, interview: NewInterview): Promise<InterviewRow | null> {
  if (!(await getJob(userId, jobId))) return null;
  const db = await getDb();
  const [row] = await db
    .insert(schema.interviews)
    .values({ jobId, ...interview })
    .returning();
  return row ?? null;
}

// changes an interview, only when its job belongs to the user
export async function updateInterview(userId: string, id: string, changes: Partial<NewInterview & { thankYouNote: string | null }>): Promise<void> {
  const db = await getDb();
  const [found] = await db.select({ jobId: schema.interviews.jobId }).from(schema.interviews).where(eq(schema.interviews.id, id)).limit(1);
  if (!found || !(await getJob(userId, found.jobId))) return;
  await db.update(schema.interviews).set(changes).where(eq(schema.interviews.id, id));
}

// removes an interview, only when its job belongs to the user
export async function deleteInterview(userId: string, id: string): Promise<void> {
  const db = await getDb();
  const [found] = await db.select({ jobId: schema.interviews.jobId }).from(schema.interviews).where(eq(schema.interviews.id, id)).limit(1);
  if (!found || !(await getJob(userId, found.jobId))) return;
  await db.delete(schema.interviews).where(eq(schema.interviews.id, id));
}

// the cover letter saved to a job, if there is one
export async function getCoverLetter(userId: string, jobId: string): Promise<{ id: string; content: string; tone: string | null } | null> {
  const db = await getDb();
  const [row] = await db
    .select({ id: schema.coverLetters.id, content: schema.coverLetters.content, tone: schema.coverLetters.tone })
    .from(schema.coverLetters)
    .where(and(eq(schema.coverLetters.userId, userId), eq(schema.coverLetters.jobId, jobId)))
    .orderBy(desc(schema.coverLetters.createdAt))
    .limit(1);
  return row ?? null;
}

// saves the cover letter for a job, replacing the one that was there
export async function saveCoverLetter(userId: string, jobId: string, content: string, tone: string | null = null): Promise<void> {
  if (!(await getJob(userId, jobId))) return;
  const db = await getDb();
  const existing = await getCoverLetter(userId, jobId);
  if (existing) {
    await db.update(schema.coverLetters).set({ content, tone: tone ?? existing.tone }).where(eq(schema.coverLetters.id, existing.id));
    return;
  }
  const [row] = await db.insert(schema.coverLetters).values({ userId, jobId, content, tone }).returning({ id: schema.coverLetters.id });
  if (row) await db.update(schema.jobs).set({ coverLetterId: row.id }).where(eq(schema.jobs.id, jobId));
}
