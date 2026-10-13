"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { detectAts } from "@resumefit/scoring";
import { getCurrentUser } from "@/lib/auth";
import { createJob, findCard } from "@/lib/data/jobs";
import { getResume, listResumes } from "@/lib/data/resumes";
import { featureFlags } from "@/lib/data/settings";
import { withinLimit } from "@/lib/rate-limit";
import { BOARDS, fieldJobs, jobDescription, profileResume, refreshFeed, savedJobs, searchJobs, type FeedJob, type JobResult } from "@/lib/jobs-feed";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const OFF = { ok: false as const, error: "Find Jobs is switched off." };
// how long a search waits for the wider job site before answering without it
const WIDER_WAIT_MS = 2500;
const SLOW_DOWN = { ok: false as const, error: "That is a lot of requests in a short time. Wait a minute and try again." };

const searchSchema = z.object({
  query: z.string().trim().max(100),
  location: z.string().trim().max(100),
  remoteOnly: z.boolean(),
  internOnly: z.boolean(),
  days: z.union([z.literal(1), z.literal(7), z.literal(30)]).nullable(),
  sort: z.enum(["relevance", "date"]),
  // the resume to rank against, the base resume when left out
  resumeId: z.uuid().nullable(),
});

// searches the saved openings, ranked by how well each one suits the chosen resume
export async function findJobs(input: z.input<typeof searchSchema>): Promise<Result<{ jobs: JobResult[]; total: number; resumeName: string | null; gathering: boolean }>> {
  const parsed = searchSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the search and try again." };
  const user = await getCurrentUser();
  if (!(await featureFlags()).findJobs) return OFF;
  // a search reads the whole pool and may reach out to job sites, so it is limited per person
  if (!(await withinLimit(user.id, "find-jobs"))) return SLOW_DOWN;

  const started = Date.now();
  const took: Record<string, number> = {};
  const timed = async <T>(name: string, work: Promise<T>): Promise<T> => {
    const value = await work;
    took[name] = Date.now() - started;
    return value;
  };

  // the saved openings and the resume are read side by side, neither waits for the other
  const [firstPool, chosen] = await Promise.all([
    timed("pool", savedJobs()),
    // the resume decides the ranking, and which fields to look in
    timed(
      "resume",
      (async () => {
        const resumes = await listResumes(user.id);
        const pick = resumes.find((entry) => entry.id === parsed.data.resumeId) ?? resumes.find((entry) => entry.isBase) ?? resumes[0];
        return pick ? getResume(user.id, pick.id) : null;
      })(),
    ),
  ]);
  const profile = chosen?.rawText ? profileResume(chosen.rawText) : null;

  let pool = firstPool;
  // the very first search finds the cupboard bare, so fetch a few companies right now
  if (pool.boards < 12) {
    await timed("first fill", refreshFeed(6000));
    pool = await savedJobs();
  }
  // and keep topping it up after the answer has gone out, without making anyone wait
  if (pool.boards < BOARDS.length) after(() => refreshFeed(25_000).catch(() => undefined));

  // openings from the wider job site, in the fields the resume points at. that site can take many seconds to answer,
  // so a search only waits a short while for it. when it is slower, the answer goes out without it and its openings are there for the next search
  let wider: FeedJob[] = [];
  let widerLate = false;
  if (profile && profile.fields.length > 0) {
    const level = parsed.data.internOnly ? "Internship" : profile.earlyCareer ? "Entry Level" : null;
    const asked = fieldJobs(profile.fields.slice(0, 2), level, 2).catch(() => [] as FeedJob[]);
    const answer = await timed("wider site", Promise.race([asked, new Promise<null>((resolve) => setTimeout(() => resolve(null), WIDER_WAIT_MS))]));
    if (answer) wider = answer;
    else {
      widerLate = true;
      after(() => asked);
    }
  }

  const jobs = searchJobs([...pool.jobs, ...wider], parsed.data, profile);
  took.total = Date.now() - started;
  // where the time went, in the server log, so a slow search can be explained afterwards
  if (took.total > 3000) console.info(`find jobs took ${took.total} ms: ${Object.entries(took).map(([name, at]) => `${name} done at ${at}`).join(", ")}, ${pool.jobs.length} saved openings${widerLate ? ", wider site left out" : ""}`);
  return { ok: true, jobs, total: pool.jobs.length + wider.length, resumeName: profile ? (chosen?.name ?? null) : null, gathering: pool.boards < BOARDS.length || widerLate };
}

// the full text of one opening
export async function readJob(id: string): Promise<Result<{ description: string }>> {
  // what arrives is only as well shaped as whoever sent it
  if (typeof id !== "string" || !id) return { ok: false, error: "We could not load this job's description. Open it on the job site instead." };
  const user = await getCurrentUser();
  if (!(await featureFlags()).findJobs) return OFF;
  if (!(await withinLimit(user.id, "find-jobs"))) return SLOW_DOWN;
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
  if (!(await withinLimit(user.id, "save-job"))) return SLOW_DOWN;
  const found = parsed.data;

  // saving the same opening twice gives the same card
  const existing = await findCard(user.id, { title: found.title, company: found.company, url: found.url });
  if (existing) return { ok: true, jobId: existing };

  // only a resume that is really theirs gets attached
  const resume = found.resumeId ? await getResume(user.id, found.resumeId) : null;
  const description = (await jobDescription(found.id)) ?? "";
  const job = await createJob(user.id, { title: found.title, company: found.company, location: found.location, url: found.url, description, detectedAts: detectAts(found.url, "")?.name ?? null, resumeId: resume?.id ?? null });
  revalidatePath("/tracker", "layout");
  revalidatePath("/dashboard");
  return { ok: true, jobId: job.id };
}
