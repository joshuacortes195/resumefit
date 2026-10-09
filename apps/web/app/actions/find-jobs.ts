"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { detectAts } from "@resumefit/scoring";
import { HARD_SKILLS } from "@resumefit/skills-data";
import { getDb, schema } from "@/db";
import { getCurrentUser } from "@/lib/auth";
import { createJob } from "@/lib/data/jobs";
import { getResume, listResumes } from "@/lib/data/resumes";
import { featureFlags } from "@/lib/data/settings";
import { allJobs, jobDescription, searchJobs, type JobResult } from "@/lib/jobs-feed";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const OFF = { ok: false as const, error: "Find Jobs is switched off." };

const searchSchema = z.object({
  query: z.string().trim().max(100),
  location: z.string().trim().max(100),
  remoteOnly: z.boolean(),
  days: z.union([z.literal(1), z.literal(7), z.literal(30)]).nullable(),
  sort: z.enum(["relevance", "date"]),
  // rank by how well each opening fits the base resume
  useResume: z.boolean(),
});

// searches the public job boards, ranking by fit with the base resume when asked
export async function findJobs(input: z.input<typeof searchSchema>): Promise<Result<{ jobs: JobResult[]; total: number; resumeName: string | null }>> {
  const parsed = searchSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the search and try again." };
  const user = await getCurrentUser();
  if (!(await featureFlags()).findJobs) return OFF;

  let resume: { text: string; skills: typeof HARD_SKILLS } | null = null;
  let resumeName: string | null = null;
  if (parsed.data.useResume) {
    const resumes = await listResumes(user.id);
    const base = resumes.find((entry) => entry.isBase) ?? resumes[0];
    const row = base ? await getResume(user.id, base.id) : null;
    if (!row?.rawText) return { ok: false, error: "You have no saved resume to match against yet. Upload one, or search by keyword." };
    resume = { text: row.rawText, skills: HARD_SKILLS };
    resumeName = row.name;
  }

  const all = await allJobs();
  if (all.length === 0) return { ok: false, error: "The job boards are not answering right now. Try again in a few minutes." };
  return { ok: true, jobs: searchJobs(all, parsed.data, resume), total: all.length, resumeName };
}

// the full text of one opening
export async function readJob(id: string): Promise<Result<{ description: string }>> {
  await getCurrentUser();
  if (!(await featureFlags()).findJobs) return OFF;
  const description = await jobDescription(id.slice(0, 200));
  return description ? { ok: true, description } : { ok: false, error: "We could not load this job's description. Open it on the job site instead." };
}

// puts an opening on the tracker, with its description, and says which card it is
export async function saveFoundJob(id: string): Promise<Result<{ jobId: string }>> {
  const user = await getCurrentUser();
  if (!(await featureFlags()).findJobs) return OFF;
  const found = (await allJobs()).find((job) => job.id === id);
  if (!found) return { ok: false, error: "That job is no longer listed." };

  // saving the same opening twice gives the same card
  const db = await getDb();
  const [existing] = await db
    .select({ id: schema.jobs.id })
    .from(schema.jobs)
    .where(and(eq(schema.jobs.userId, user.id), eq(schema.jobs.url, found.url)))
    .limit(1);
  if (existing) return { ok: true, jobId: existing.id };

  const description = (await jobDescription(id)) ?? "";
  const job = await createJob(user.id, { title: found.title, company: found.company, location: found.location, url: found.url, description, detectedAts: detectAts(found.url, "")?.name ?? null });
  revalidatePath("/tracker", "layout");
  return { ok: true, jobId: job.id };
}
