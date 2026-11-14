import { z } from "zod";
import { parseResume } from "@resumefit/scoring";
import { requireAutoApply } from "@/lib/auto-apply";
import { remainingToday } from "@/lib/ai/limits";
import { SCREENING_SYSTEM, screeningPrompt } from "@/lib/ai/prompts/screening";
import { tidy } from "@/lib/ai/prompts/style";
import { redact } from "@/lib/ai/redact";
import { AiBusyError, AiLimitError, AiUnavailableError, generateText } from "@/lib/ai/router";
import { providedFor, questionKey } from "@/lib/data/applications";
import { getJob } from "@/lib/data/jobs";
import { getProfile } from "@/lib/data/profile";
import { getResume, listResumes } from "@/lib/data/resumes";
import { ExtError, extRoute, preflight } from "@/lib/ext-auth";
import { findAnswerForField, findSavedAnswer } from "@/lib/qa-match";
import { rateLimit } from "@/lib/rate-limit";

export const OPTIONS = preflight;

export const maxDuration = 60;

const answerSchema = z.object({ question: z.string().trim().min(2).max(500), jdText: z.string().max(60_000).default(""), resumeId: z.uuid().optional(), jobId: z.uuid().optional(), savedOnly: z.boolean().default(false) });

// answers a written question on an application: from the person's saved answers when one fits, otherwise a draft for them to check
export const POST = extRoute(async (request, user) => {
  await requireAutoApply();
  const parsed = answerSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) throw new ExtError("That question is too short or too long to answer.");

  // what the person answered for this very job comes first
  const own = parsed.data.jobId ? (await providedFor(user.id, parsed.data.jobId))[questionKey(parsed.data.question)] : undefined;
  if (own) return { answer: own, source: "saved" };
  // then a saved answer, which always wins over a draft and costs nothing
  const bank = (await getProfile(user.id)).qaBank;
  // asked only for what the person already said, for a field that is not a written question: matched strictly, and nothing is drafted
  if (parsed.data.savedOnly) return { answer: findAnswerForField(parsed.data.question, bank)?.answer ?? null, source: "none" };
  const saved = findSavedAnswer(parsed.data.question, bank);
  if (saved) return { answer: saved.answer, source: "saved" };
  if (parsed.data.question.length < 5) throw new ExtError("That question is too short or too long to answer.");

  // a draft is a call to a model, so it has the same per minute limit as the other writing features
  await rateLimit(user.id, "ai");
  const resumes = await listResumes(user.id);
  const resumeId = parsed.data.resumeId ?? resumes.find((resume) => resume.isBase)?.id ?? resumes[0]?.id;
  const resume = resumeId ? await getResume(user.id, resumeId) : null;
  if (!resume?.rawText) throw new ExtError("You have no saved resume yet, so there is nothing to draft an answer from.", 404);

  // an application form rarely shows the job description, so use the one saved on the tracker card
  const jdText = parsed.data.jdText || (parsed.data.jobId ? ((await getJob(user.id, parsed.data.jobId))?.description ?? "") : "");

  try {
    // names and contact details are swapped out before anything leaves, and put back in the answer
    const hidden = redact(resume.rawText, parseResume(resume.rawText).contact);
    const draft = await generateText("screening", { system: SCREENING_SYSTEM, prompt: screeningPrompt({ question: parsed.data.question, resume: hidden.text, jdText }) }, { userId: user.id, fast: true });
    return { answer: hidden.restore(tidy(draft)), source: "ai", remaining: await remainingToday(user.id, "screening") };
  } catch (error) {
    if (error instanceof AiBusyError || error instanceof AiLimitError || error instanceof AiUnavailableError) throw new ExtError(error.message, 503);
    throw error;
  }
});
