import { z } from "zod";
import { parseResume } from "@resumefit/scoring";
import { remainingToday } from "@/lib/ai/limits";
import { SCREENING_SYSTEM, screeningPrompt } from "@/lib/ai/prompts/screening";
import { tidy } from "@/lib/ai/prompts/style";
import { redact } from "@/lib/ai/redact";
import { AiBusyError, AiLimitError, AiUnavailableError, generateText } from "@/lib/ai/router";
import { getJob } from "@/lib/data/jobs";
import { getProfile } from "@/lib/data/profile";
import { getResume, listResumes } from "@/lib/data/resumes";
import { ExtError, extRoute, preflight } from "@/lib/ext-auth";
import { findSavedAnswer } from "@/lib/qa-match";

export const OPTIONS = preflight;

const answerSchema = z.object({ question: z.string().trim().min(5).max(500), jdText: z.string().max(60_000).default(""), resumeId: z.uuid().optional(), jobId: z.uuid().optional() });

// answers a free text question on an application: from the saved answers when one fits, otherwise a draft to review
export const POST = extRoute(async (request, user) => {
  const parsed = answerSchema.safeParse(await request.json());
  if (!parsed.success) throw new ExtError("That question is too short or too long to answer.");

  // a saved answer always wins, and costs nothing
  const saved = findSavedAnswer(parsed.data.question, (await getProfile(user.id)).qaBank);
  if (saved) return { answer: saved.answer, source: "saved" };

  const resumes = await listResumes(user.id);
  const resumeId = parsed.data.resumeId ?? resumes.find((resume) => resume.isBase)?.id ?? resumes[0]?.id;
  const resume = resumeId ? await getResume(user.id, resumeId) : null;
  if (!resume?.rawText) throw new ExtError("You have no saved resume yet, so there is nothing to draft an answer from.", 404);

  // an application form rarely shows the job description, so use the one saved on the tracker card
  const jdText = parsed.data.jdText || (parsed.data.jobId ? ((await getJob(user.id, parsed.data.jobId))?.description ?? "") : "");

  try {
    const hidden = redact(resume.rawText, parseResume(resume.rawText).contact);
    const draft = await generateText("screening", { system: SCREENING_SYSTEM, prompt: screeningPrompt({ question: parsed.data.question, resume: hidden.text, jdText }) }, { userId: user.id, fast: true });
    return { answer: hidden.restore(tidy(draft)), source: "ai", remaining: await remainingToday(user.id, "screening") };
  } catch (error) {
    if (error instanceof AiBusyError || error instanceof AiLimitError || error instanceof AiUnavailableError) throw new ExtError(error.message, 503);
    throw error;
  }
});
