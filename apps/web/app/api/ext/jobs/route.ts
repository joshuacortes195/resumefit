import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { detectAts } from "@resumefit/scoring";
import { getDb, schema } from "@/db";
import { createJob } from "@/lib/data/jobs";
import { ExtError, extRoute, preflight } from "@/lib/ext-auth";

export const OPTIONS = preflight;

const jobSchema = z.object({
  title: z.string().trim().min(1).max(200),
  company: z.string().trim().max(200).optional(),
  location: z.string().trim().max(200).optional(),
  url: z.url().max(2000).optional(),
  description: z.string().max(60_000).optional(),
});

// saves the job on the page to the tracker, or finds it when it was saved before
export const POST = extRoute(async (request, user) => {
  const parsed = jobSchema.safeParse(await request.json());
  if (!parsed.success) throw new ExtError("We could not read a job title on this page.");
  const { title, company, location, url, description } = parsed.data;

  // the same link is only ever saved once
  if (url) {
    const db = await getDb();
    const [existing] = await db
      .select({ id: schema.jobs.id })
      .from(schema.jobs)
      .where(and(eq(schema.jobs.userId, user.id), eq(schema.jobs.url, url)))
      .limit(1);
    if (existing) return { jobId: existing.id, alreadySaved: true };
  }
  const job = await createJob(user.id, { title, company, location, url, description, detectedAts: detectAts(url, description ?? "")?.name ?? null });
  return { jobId: job.id, alreadySaved: false };
});
