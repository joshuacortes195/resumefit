import { z } from "zod";
import { webUrl } from "@/lib/scan-request";
import { detectAts } from "@resumefit/scoring";
import { createJob, findCard } from "@/lib/data/jobs";
import { ExtError, extRoute, preflight } from "@/lib/ext-auth";
import { rateLimit } from "@/lib/rate-limit";

export const OPTIONS = preflight;

const jobSchema = z.object({
  title: z.string().trim().min(1).max(200),
  company: z.string().trim().max(200).optional(),
  location: z.string().trim().max(200).optional(),
  url: webUrl().optional(),
  description: z.string().max(60_000).optional(),
});

// saves the job on the page to the tracker, or finds it when it was saved before
export const POST = extRoute(async (request, user) => {
  const parsed = jobSchema.safeParse(await request.json());
  if (!parsed.success) throw new ExtError("We could not read a job title on this page.");
  await rateLimit(user.id, "save-job");
  const { title, company, location, url, description } = parsed.data;

  // the same job is only ever saved once
  const existing = await findCard(user.id, { title, company, url });
  if (existing) return { jobId: existing, alreadySaved: true };
  const job = await createJob(user.id, { title, company, location, url, description, detectedAts: detectAts(url, description ?? "")?.name ?? null });
  return { jobId: job.id, alreadySaved: false };
});
