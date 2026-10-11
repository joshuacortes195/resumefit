import { z } from "zod";
import { detectAts } from "@resumefit/scoring";
import { webUrl } from "@/lib/scan-request";
import { createJob, findCard } from "@/lib/data/jobs";
import { getResume, listResumes } from "@/lib/data/resumes";
import { createScan, DAILY_SCAN_LIMIT, scansToday } from "@/lib/data/scans";
import type { LayoutMeta } from "@resumefit/scoring";
import { ExtError, extRoute, preflight } from "@/lib/ext-auth";

export const OPTIONS = preflight;

const scanSchema = z.object({
  jdText: z.string().min(50).max(60_000),
  title: z.string().max(200).optional(),
  company: z.string().max(200).optional(),
  url: webUrl().optional(),
  resumeId: z.uuid().optional(),
  jobId: z.uuid().optional(),
});

type ScanInput = z.infer<typeof scanSchema>;

// finds the tracker card a scan belongs to, or makes one, so the score always shows up on the tracker.
// the card the panel named only counts when it really is this job, since the panel can still be holding the last job's card
async function cardFor(userId: string, input: ScanInput): Promise<{ jobId: string | null; added: boolean }> {
  const title = input.title?.trim();
  const company = input.company?.trim();
  const found = await findCard(userId, { title, company, url: input.url }, input.jobId);
  if (found) return { jobId: found, added: false };
  // a page we could not read a title from has nothing to put on a card
  if (!title) return { jobId: null, added: false };
  const job = await createJob(userId, { title, company, url: input.url, description: input.jdText, detectedAts: detectAts(input.url, input.jdText)?.name ?? null });
  return { jobId: job.id, added: true };
}

// scans a job description from the page against the base resume, or one the person picked
export const POST = extRoute(async (request, user) => {
  const parsed = scanSchema.safeParse(await request.json());
  if (!parsed.success) throw new ExtError("We could not find enough of a job description on this page to scan.");
  if ((await scansToday(user.id)) >= DAILY_SCAN_LIMIT) throw new ExtError(`You have run ${DAILY_SCAN_LIMIT} scans in the last day. Try again tomorrow.`, 429);

  const resumes = await listResumes(user.id);
  const resumeId = parsed.data.resumeId ?? resumes.find((resume) => resume.isBase)?.id ?? resumes[0]?.id;
  const resume = resumeId ? await getResume(user.id, resumeId) : null;
  if (!resume?.rawText) throw new ExtError("You have no saved resume yet. Upload one in ResumeFit first.", 404);

  const card = await cardFor(user.id, parsed.data);
  const scan = await createScan(user.id, {
    resumeId: resume.id,
    resumeText: resume.rawText,
    layout: (resume.layoutMeta as LayoutMeta | null) ?? null,
    jdText: parsed.data.jdText,
    jobTitle: parsed.data.title,
    company: parsed.data.company,
    jobUrl: parsed.data.url,
    // the scan hangs off the tracker card, which is where the score is shown
    jobId: card.jobId,
  });
  const missing = [...scan.report.hardSkills, ...scan.report.softSkills].filter((skill) => skill.match === "missing").map((skill) => skill.name);
  return { scanId: scan.id, matchRate: scan.matchRate, missing: missing.slice(0, 8), resumeName: resume.name, jobId: card.jobId, addedToTracker: card.added };
});
