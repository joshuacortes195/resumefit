import { and, desc, eq } from "drizzle-orm";
import type { LinkedinProfile, LinkedinReport } from "@resumefit/scoring";
import { getDb, schema } from "@/db";
import type { AnswerFeedback, InterviewQuestion } from "@/lib/ai/prompts/interview";
import type { AnswerMetrics } from "@/lib/interview";

const isId = (id: string) => /^[0-9a-f-]{36}$/i.test(id);

// a saved linkedin report
export type SavedLinkedinReport = { id: string; profile: LinkedinProfile; jobDescriptions: string[]; score: number; report: LinkedinReport; createdAt: Date };

// where a profile sent over by the extension waits until the linkedin page picks it up
const pendingKey = (userId: string) => `linkedin-import:${userId}`;
const PENDING_FOR = 24 * 60 * 60 * 1000;

export async function savePendingLinkedin(userId: string, profile: LinkedinProfile): Promise<void> {
  const db = await getDb();
  const value = { profile, at: Date.now() };
  await db.insert(schema.appSettings).values({ key: pendingKey(userId), value }).onConflictDoUpdate({ target: schema.appSettings.key, set: { value } });
}

// the profile the extension sent, if one came in during the last day
export async function pendingLinkedin(userId: string): Promise<LinkedinProfile | null> {
  const db = await getDb();
  const [row] = await db.select({ value: schema.appSettings.value }).from(schema.appSettings).where(eq(schema.appSettings.key, pendingKey(userId))).limit(1);
  const saved = row?.value as { profile?: LinkedinProfile; at?: number } | undefined;
  return saved?.profile && Date.now() - (saved.at ?? 0) < PENDING_FOR ? saved.profile : null;
}

// once it has been used, or the account goes, the waiting copy is thrown away
export async function clearPendingLinkedin(userId: string): Promise<void> {
  const db = await getDb();
  await db.delete(schema.appSettings).where(eq(schema.appSettings.key, pendingKey(userId)));
}

export async function saveLinkedinReport(userId: string, profile: LinkedinProfile, jobDescriptions: string[], report: LinkedinReport): Promise<string> {
  const db = await getDb();
  const [row] = await db.insert(schema.linkedinReports).values({ userId, profileText: profile, jobDescriptions, score: report.score, findings: report }).returning({ id: schema.linkedinReports.id });
  if (!row) throw new Error("Could not save the report.");
  return row.id;
}

export async function getLinkedinReport(userId: string, id: string): Promise<SavedLinkedinReport | null> {
  if (!isId(id)) return null;
  const db = await getDb();
  const [row] = await db
    .select()
    .from(schema.linkedinReports)
    .where(and(eq(schema.linkedinReports.id, id), eq(schema.linkedinReports.userId, userId)))
    .limit(1);
  return row ? { id: row.id, profile: row.profileText as LinkedinProfile, jobDescriptions: row.jobDescriptions, score: row.score ?? 0, report: row.findings as LinkedinReport, createdAt: row.createdAt } : null;
}

// past linkedin reports, newest first
export async function listLinkedinReports(userId: string): Promise<{ id: string; score: number; headline: string; createdAt: Date }[]> {
  const db = await getDb();
  const rows = await db.select().from(schema.linkedinReports).where(eq(schema.linkedinReports.userId, userId)).orderBy(desc(schema.linkedinReports.createdAt)).limit(20);
  return rows.map((row) => ({ id: row.id, score: row.score ?? 0, headline: (row.profileText as LinkedinProfile).headline, createdAt: row.createdAt }));
}

// one answer in a practice session, with what we measured and the coaching that came back
export type PracticeAnswer = { text: string; seconds: number | null; spoken: boolean; metrics: AnswerMetrics; feedback: AnswerFeedback | null };

// a practice interview
export type PracticeSession = {
  id: string;
  jobId: string | null;
  jobTitle: string | null;
  company: string | null;
  jdText: string;
  questions: InterviewQuestion[];
  // one slot per question, null until it is answered
  answers: (PracticeAnswer | null)[];
  createdAt: Date;
};

// the job details ride along with the questions, since a session can be for a pasted job description
type StoredQuestions = { jobTitle: string | null; company: string | null; jdText: string; list: InterviewQuestion[] };

export async function createPracticeSession(userId: string, input: { jobId: string | null; jobTitle: string | null; company: string | null; jdText: string; questions: InterviewQuestion[] }): Promise<string> {
  const db = await getDb();
  const stored: StoredQuestions = { jobTitle: input.jobTitle, company: input.company, jdText: input.jdText, list: input.questions };
  const [row] = await db
    .insert(schema.interviewSessions)
    .values({ userId, jobId: input.jobId, questions: stored, answers: input.questions.map(() => null) })
    .returning({ id: schema.interviewSessions.id });
  if (!row) throw new Error("Could not start the session.");
  return row.id;
}

// turns a database row into a session
function toSession(row: typeof schema.interviewSessions.$inferSelect): PracticeSession {
  const stored = row.questions as StoredQuestions;
  return { id: row.id, jobId: row.jobId, jobTitle: stored.jobTitle, company: stored.company, jdText: stored.jdText, questions: stored.list ?? [], answers: (row.answers as (PracticeAnswer | null)[]) ?? [], createdAt: row.createdAt };
}

export async function getPracticeSession(userId: string, id: string): Promise<PracticeSession | null> {
  if (!isId(id)) return null;
  const db = await getDb();
  const [row] = await db
    .select()
    .from(schema.interviewSessions)
    .where(and(eq(schema.interviewSessions.id, id), eq(schema.interviewSessions.userId, userId)))
    .limit(1);
  return row ? toSession(row) : null;
}

// saves the answer to one question of a session
export async function savePracticeAnswer(userId: string, session: PracticeSession, index: number, answer: PracticeAnswer): Promise<void> {
  const answers = session.questions.map((_, position) => (position === index ? answer : (session.answers[position] ?? null)));
  const db = await getDb();
  await db
    .update(schema.interviewSessions)
    .set({ answers })
    .where(and(eq(schema.interviewSessions.id, session.id), eq(schema.interviewSessions.userId, userId)));
}

// past sessions, newest first, optionally only the ones for one job
export async function listPracticeSessions(userId: string, jobId?: string): Promise<PracticeSession[]> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(schema.interviewSessions)
    .where(and(eq(schema.interviewSessions.userId, userId), jobId ? eq(schema.interviewSessions.jobId, jobId) : undefined))
    .orderBy(desc(schema.interviewSessions.createdAt))
    .limit(20);
  return rows.map(toSession);
}

// the average coaching score of a session, null when nothing was scored
export function sessionScore(session: PracticeSession): number | null {
  const scores = session.answers.flatMap((answer) => (answer?.feedback ? [answer.feedback.score] : []));
  return scores.length > 0 ? Math.round(scores.reduce((total, score) => total + score, 0) / scores.length) : null;
}
