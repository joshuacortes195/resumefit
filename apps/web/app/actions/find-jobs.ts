"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { detectAts } from "@resumefit/scoring";
import { getDb, schema } from "@/db";
import { getCurrentUser } from "@/lib/auth";
import { createJob } from "@/lib/data/jobs";
import { getResume, listResumes } from "@/lib/data/resumes";
import { featureFlags } from "@/lib/data/settings";
import { BOARDS, fieldJobs, jobDescription, profileResume, refreshFeed, savedJobs, searchJobs, type FeedJob, type JobResult } from "@/lib/jobs-feed";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const OFF = { ok: false as const, error: "Find Jobs is switched off." };

const searchSchema = z.object({
  query: z.string().trim().max(100),
  location: z.string().trim().max(100),
  remoteOnly: z.boolean(),
  internOnly: z.boolean(),
  days: z.union([z.literal(1), z.literal(7), z.literal(30)]).nullable(),
  sort: z.enum(["relevance", "date"]),
  // the resume to rank against, the base resume when left out
  resumeId: z.uuid().nullable(),
  // only openings on systems the extension can fill in
  autofillOnly: z.boolean().default(false),
});

// searches the saved openings, ranked by how well each one suits the chosen resume
export async function findJobs(input: z.input<typeof searchSchema>): Promise<Result<{ jobs: JobResult[]; total: number; resumeName: string | null; gathering: boolean }>> {
  const parsed = searchSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the search and try again." };
  const user = await getCurrentUser();
  if (!(await featureFlags()).findJobs) return OFF;

  // the resume decides the ranking, and which fields to look in
  const resumes = await listResumes(user.id);
  const chosen = resumes.find((entry) => entry.id === parsed.data.resumeId) ?? resumes.find((entry) => entry.isBase) ?? resumes[0];
  const row = chosen ? await getResume(user.id, chosen.id) : null;
  const profile = row?.rawText ? profileResume(row.rawText) : null;

  let pool = await savedJobs();
  // the very first search finds the cupboard bare, so fetch a few companies right now
  if (pool.boards < 12) {
    await refreshFeed(6000);
    pool = await savedJobs();
  }
  // and keep topping it up after the answer has gone out, without making anyone wait
  if (pool.boards < BOARDS.length) after(() => refreshFeed(25_000).catch(() => undefined));

  // openings from the wider job site, in the fields the resume points at. these cannot be autofilled
  let wider: FeedJob[] = [];
  if (profile && profile.fields.length > 0 && !parsed.data.autofillOnly) {
    const level = parsed.data.internOnly ? "Internship" : profile.earlyCareer ? "Entry Level" : null;
    wider = await fieldJobs(profile.fields.slice(0, 2), level, 2);
  }

  const jobs = searchJobs([...pool.jobs, ...wider], parsed.data, profile);
  return { ok: true, jobs, total: pool.jobs.length + wider.length, resumeName: profile ? (row?.name ?? null) : null, gathering: pool.boards < BOARDS.length };
}

// the full text of one opening
export async function readJob(id: string): Promise<Result<{ description: string }>> {
  await getCurrentUser();
  if (!(await featureFlags()).findJobs) return OFF;
  const description = await jobDescription(id.slice(0, 200));
  return description ? { ok: true, description } : { ok: false, error: "We could not load this job's description. Open it on the job site instead." };
}

const foundJobSchema = z.object({
  id: z.string().max(200),
  title: z.string().trim().min(1).max(200),
  company: z.string().trim().max(200),
  location: z.string().trim().max(200),
  url: z.string().max(2000).regex(/^https:\/\//),
  // the resume this job was picked for, kept on the card
  resumeId: z.uuid().nullable().default(null),
});

// puts an opening on the tracker, with its description, and says which card it is
export async function saveFoundJob(input: z.input<typeof foundJobSchema>): Promise<Result<{ jobId: string }>> {
  const parsed = foundJobSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "That job could not be saved." };
  const user = await getCurrentUser();
  if (!(await featureFlags()).findJobs) return OFF;
  const found = parsed.data;

  // saving the same opening twice gives the same card
  const db = await getDb();
  const [existing] = await db
    .select({ id: schema.jobs.id })
    .from(schema.jobs)
    .where(and(eq(schema.jobs.userId, user.id), eq(schema.jobs.url, found.url)))
    .limit(1);
  if (existing) return { ok: true, jobId: existing.id };

  // only a resume that is really theirs gets attached
  const resume = found.resumeId ? await getResume(user.id, found.resumeId) : null;
  const description = (await jobDescription(found.id)) ?? "";
  const job = await createJob(user.id, { title: found.title, company: found.company, location: found.location, url: found.url, description, detectedAts: detectAts(found.url, "")?.name ?? null, resumeId: resume?.id ?? null });
  revalidatePath("/tracker", "layout");
  revalidatePath("/dashboard");
  revalidatePath("/auto-apply");
  return { ok: true, jobId: job.id };
}
