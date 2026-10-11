"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { parseResume, type ResumeContact } from "@resumefit/scoring";
import { writeCoverLetter, writeThankYou } from "@/lib/ai/letters";
import { remainingToday, type AiFeature } from "@/lib/ai/limits";
import { suggestBullets, suggestEdits } from "@/lib/ai/optimize";
import { LENGTHS, TONES } from "@/lib/ai/prompts/letters";
import type { Suggestion } from "@/lib/ai/prompts/optimize";
import { AiBusyError, AiLimitError, AiUnavailableError } from "@/lib/ai/router";
import { parseTarget } from "@/lib/letter-target";
import { getCurrentUser } from "@/lib/auth";
import { getJob, listInterviews, saveCoverLetter, updateInterview } from "@/lib/data/jobs";
import { finishOptimization, saveSuggestions } from "@/lib/data/optimizations";
import { getResume, saveResume } from "@/lib/data/resumes";
import { ensureCard, getScan } from "@/lib/data/scans";

// what the writing actions hand back: the result plus how many uses are left today
type Written<T> = ({ ok: true; remaining: number | null } & T) | { ok: false; error: string };

const id = z.uuid();

// turns anything that went wrong into a message for the person
function problem(error: unknown): { ok: false; error: string } {
  if (error instanceof AiBusyError || error instanceof AiLimitError || error instanceof AiUnavailableError) return { ok: false, error: error.message };
  console.error(error instanceof Error ? error.message : "writing action failed");
  return { ok: false, error: "Something went wrong on our side. Try again in a moment." };
}

// how many uses of a feature are left after this one
async function left(userId: string, feature: AiFeature): Promise<number | null> {
  return remainingToday(userId, feature);
}

// asks for edit suggestions for a scan
export async function generateSuggestions(scanId: string): Promise<Written<{ suggestions: Suggestion[]; optimizationId: string }>> {
  try {
    const user = await getCurrentUser();
    const scan = id.safeParse(scanId).success ? await getScan(user.id, scanId) : null;
    if (!scan) return { ok: false, error: "We could not find that scan." };
    const suggestions = await suggestEdits(scan, { userId: user.id });
    const optimizationId = await saveSuggestions(user.id, scan.id, scan.resumeTextSnapshot, suggestions, scan.matchRate);
    return { ok: true, suggestions, optimizationId, remaining: await left(user.id, "optimize") };
  } catch (error) {
    return problem(error);
  }
}

// asks for three bullets that use one keyword, based on one job in the resume as it reads right now
export async function generateBullets(input: { scanId: string; keyword: string; entryIndex: number; resumeText: string }): Promise<Written<{ options: string[] }>> {
  const parsed = z.object({ scanId: id, keyword: z.string().trim().min(1).max(60), entryIndex: z.number().int().min(0).max(50), resumeText: z.string().min(50).max(60_000) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Pick a keyword and a job first." };
  try {
    const user = await getCurrentUser();
    const scan = await getScan(user.id, parsed.data.scanId);
    if (!scan) return { ok: false, error: "We could not find that scan." };
    const options = await suggestBullets({ ...parsed.data, jobTitle: scan.report.jobTitle }, { userId: user.id });
    return { ok: true, options, remaining: await left(user.id, "bullets") };
  } catch (error) {
    return problem(error);
  }
}

// saves the edited resume as a new version linked to the scan's job
export async function saveOptimizedResume(input: { scanId: string; text: string; optimizationId: string | null; acceptedIds: string[]; afterScore: number }): Promise<{ ok: true; resumeId: string } | { ok: false; error: string }> {
  const parsed = z
    .object({ scanId: id, text: z.string().trim().min(50, "The resume is empty.").max(60_000), optimizationId: id.nullable(), acceptedIds: z.array(z.string().max(20)).max(60), afterScore: z.number().min(0).max(100) })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "There is nothing to save yet." };
  const user = await getCurrentUser();
  const scan = await getScan(user.id, parsed.data.scanId);
  if (!scan) return { ok: false, error: "We could not find that scan." };

  const label = [scan.company, scan.jobTitle].filter(Boolean).join(", ") || "this job";
  // a resume written for a job belongs with that job, so the job goes on the tracker if it is not there yet
  const jobId = await ensureCard(user.id, scan);
  const resume = await saveResume(user.id, { name: `Resume for ${label}`.slice(0, 120), text: parsed.data.text, source: "optimized", linkedJobId: jobId });
  if (parsed.data.optimizationId) {
    await finishOptimization(user.id, parsed.data.optimizationId, { acceptedIds: parsed.data.acceptedIds, finalText: parsed.data.text, afterScore: Math.round(parsed.data.afterScore) });
  }
  revalidatePath("/resumes");
  revalidatePath("/tracker", "layout");
  revalidatePath("/scans");
  return { ok: true, resumeId: resume.id };
}

const letterSchema = z.object({
  // where the resume and the job come from: a scan, or a saved resume plus pasted job text
  scanId: id.optional(),
  resumeId: id.optional(),
  jobId: id.optional(),
  jdText: z.string().max(60_000).optional(),
  jobTitle: z.string().max(200).optional(),
  company: z.string().max(200).optional(),
  // typed by hand, like "Software Engineer Intern for Google"
  target: z.string().max(200).optional(),
  tone: z.enum(TONES),
  length: z.enum(Object.keys(LENGTHS) as [keyof typeof LENGTHS, ...(keyof typeof LENGTHS)[]]),
  why: z.string().max(1000).optional(),
  manager: z.string().max(120).optional(),
});

// writes a cover letter from a scan, a tracked job or a saved resume plus a job description
export async function generateCoverLetter(input: z.input<typeof letterSchema>): Promise<Written<{ letter: string }>> {
  const parsed = letterSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the options and try again." };
  try {
    const user = await getCurrentUser();
    const { scanId, resumeId, jobId } = parsed.data;
    const scan = scanId ? await getScan(user.id, scanId) : null;
    const job = jobId ? await getJob(user.id, jobId) : null;
    const resume = resumeId ? await getResume(user.id, resumeId) : job?.resumeId ? await getResume(user.id, job.resumeId) : null;

    // a resume that was picked on purpose wins over the one a scan happened to use
    const resumeText = (resumeId ? resume?.rawText : null) ?? scan?.resumeTextSnapshot ?? resume?.rawText ?? "";
    const jdText = parsed.data.jdText?.trim() || scan?.jdText || job?.description || "";
    const typed = parseTarget(parsed.data.target ?? "");
    const jobTitle = parsed.data.jobTitle?.trim() || typed.jobTitle || scan?.jobTitle || job?.title || null;
    const company = parsed.data.company?.trim() || typed.company || scan?.company || job?.company || null;
    if (resumeText.trim().length < 50) return { ok: false, error: "Pick a resume first. A cover letter is built from what is in it." };
    // the job description is a bonus, the letter only has to know which job it is for
    if (jdText.trim().length < 50 && !jobTitle) return { ok: false, error: "Say which job the letter is for, like Software Engineer Intern for Google." };

    const contact: ResumeContact = (resumeId ? null : scan?.report.resume.contact) ?? parseResume(resumeText).contact;
    const letter = await writeCoverLetter(
      {
        resume: resumeText,
        contact,
        jdText,
        jobTitle,
        company,
        tone: parsed.data.tone,
        length: parsed.data.length,
        why: parsed.data.why,
        manager: parsed.data.manager,
      },
      { userId: user.id },
    );
    return { ok: true, letter, remaining: await left(user.id, "cover-letter") };
  } catch (error) {
    return problem(error);
  }
}

// attaches a cover letter to a job on the tracker
export async function saveLetterToJob(jobId: string, content: string, tone: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = z.object({ jobId: id, content: z.string().trim().min(1, "The letter is empty.").max(20_000), tone: z.string().max(40) }).safeParse({ jobId, content, tone });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Could not save the letter." };
  const user = await getCurrentUser();
  if (!(await getJob(user.id, parsed.data.jobId))) return { ok: false, error: "We could not find that job." };
  await saveCoverLetter(user.id, parsed.data.jobId, parsed.data.content, parsed.data.tone);
  revalidatePath(`/tracker/${jobId}`, "layout");
  return { ok: true };
}

// drafts a thank-you note for one interview and saves it on that interview
export async function generateThankYou(jobId: string, interviewId: string): Promise<Written<{ note: string }>> {
  if (!id.safeParse(jobId).success || !id.safeParse(interviewId).success) return { ok: false, error: "We could not find that interview." };
  try {
    const user = await getCurrentUser();
    const job = await getJob(user.id, jobId);
    const interview = (await listInterviews(user.id, jobId)).find((entry) => entry.id === interviewId);
    if (!job || !interview) return { ok: false, error: "We could not find that interview." };
    const resume = job.resumeId ? await getResume(user.id, job.resumeId) : null;
    const name = resume?.rawText ? parseResume(resume.rawText).contact.name : null;

    const note = await writeThankYou({ jobTitle: job.title, company: job.company, type: interview.type, interviewer: interview.interviewerName, notes: interview.description, name }, { userId: user.id });
    await updateInterview(user.id, interview.id, { thankYouNote: note });
    revalidatePath(`/tracker/${jobId}`, "layout");
    return { ok: true, note, remaining: await left(user.id, "thank-you") };
  } catch (error) {
    return problem(error);
  }
}
