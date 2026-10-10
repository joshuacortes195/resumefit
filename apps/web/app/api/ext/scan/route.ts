import { z } from "zod";
import { webUrl } from "@/lib/scan-request";
import { getJob } from "@/lib/data/jobs";
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

// scans a job description from the page against the base resume, or one the person picked
export const POST = extRoute(async (request, user) => {
  const parsed = scanSchema.safeParse(await request.json());
  if (!parsed.success) throw new ExtError("We could not find enough of a job description on this page to scan.");
  if ((await scansToday(user.id)) >= DAILY_SCAN_LIMIT) throw new ExtError(`You have run ${DAILY_SCAN_LIMIT} scans in the last day. Try again tomorrow.`, 429);

  const resumes = await listResumes(user.id);
  const resumeId = parsed.data.resumeId ?? resumes.find((resume) => resume.isBase)?.id ?? resumes[0]?.id;
  const resume = resumeId ? await getResume(user.id, resumeId) : null;
  if (!resume?.rawText) throw new ExtError("You have no saved resume yet. Upload one in ResumeFit first.", 404);

  const scan = await createScan(user.id, {
    resumeId: resume.id,
    resumeText: resume.rawText,
    layout: (resume.layoutMeta as LayoutMeta | null) ?? null,
    jdText: parsed.data.jdText,
    jobTitle: parsed.data.title,
    company: parsed.data.company,
    jobUrl: parsed.data.url,
    // only a job that belongs to this person, anything else is quietly dropped
    jobId: parsed.data.jobId && (await getJob(user.id, parsed.data.jobId)) ? parsed.data.jobId : null,
  });
  const missing = [...scan.report.hardSkills, ...scan.report.softSkills].filter((skill) => skill.match === "missing").map((skill) => skill.name);
  return { scanId: scan.id, matchRate: scan.matchRate, missing: missing.slice(0, 8), resumeName: resume.name };
});
