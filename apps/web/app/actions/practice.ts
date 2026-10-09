"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { analyzeJd, parseResume, scoreLinkedin } from "@resumefit/scoring";
import { HARD_SKILLS, SOFT_SKILLS } from "@resumefit/skills-data";
import { remainingToday } from "@/lib/ai/limits";
import { feedbackSchema, INTERVIEW_FEEDBACK_SYSTEM, INTERVIEW_QUESTIONS_SYSTEM, interviewFeedbackPrompt, interviewQuestionsPrompt, questionsSchema } from "@/lib/ai/prompts/interview";
import { headlinesSchema, LINKEDIN_ABOUT_SYSTEM, LINKEDIN_HEADLINE_SYSTEM, linkedinPrompt } from "@/lib/ai/prompts/linkedin";
import { tidy } from "@/lib/ai/prompts/style";
import { redact } from "@/lib/ai/redact";
import { AiBusyError, AiLimitError, AiUnavailableError, aiAvailable, generateJSON, generateText } from "@/lib/ai/router";
import { getCurrentUser } from "@/lib/auth";
import { getJob } from "@/lib/data/jobs";
import { createPracticeSession, getLinkedinReport, getPracticeSession, saveLinkedinReport, savePracticeAnswer, type PracticeAnswer } from "@/lib/data/practice";
import { getResume, listResumes } from "@/lib/data/resumes";
import { fallbackQuestions, measureAnswer } from "@/lib/interview";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

// turns anything that went wrong with a writing request into a message
function problem(error: unknown): { ok: false; error: string } {
  if (error instanceof AiBusyError || error instanceof AiLimitError || error instanceof AiUnavailableError) return { ok: false, error: error.message };
  console.error(error instanceof Error ? error.message : "practice action failed");
  return { ok: false, error: "Something went wrong on our side. Try again in a moment." };
}

const profileSchema = z.object({
  headline: z.string().trim().max(400),
  about: z.string().trim().max(6000),
  experience: z.string().trim().max(20_000),
  skills: z.array(z.string().trim().max(60)).max(100),
  url: z.string().trim().max(200).optional(),
});

// scores a linkedin profile against one to three job descriptions and saves the report
export async function createLinkedinReport(input: { profile: z.input<typeof profileSchema>; jobDescriptions: string[] }): Promise<Result<{ id: string }>> {
  const profile = profileSchema.safeParse(input.profile);
  const jobs = z.array(z.string().trim().min(50).max(60_000)).min(1, "Add at least one job description to compare your profile with.").max(3).safeParse(input.jobDescriptions.filter((jd) => jd.trim()));
  if (!profile.success) return { ok: false, error: "Part of your profile is too long. Trim it and try again." };
  if (!jobs.success) return { ok: false, error: jobs.error.issues[0]?.code === "too_small" && jobs.error.issues[0].path.length > 0 ? "One of the job descriptions is too short. Paste the full posting." : (jobs.error.issues[0]?.message ?? "Check the job descriptions.") };
  if (!profile.data.headline && !profile.data.about && !profile.data.experience) return { ok: false, error: "Add your headline, About section or experience first." };

  const user = await getCurrentUser();
  const cleaned = { ...profile.data, skills: profile.data.skills.filter(Boolean), url: profile.data.url || undefined };
  const report = scoreLinkedin(cleaned, jobs.data, HARD_SKILLS, SOFT_SKILLS);
  const id = await saveLinkedinReport(user.id, cleaned, jobs.data, report);
  revalidatePath("/linkedin");
  return { ok: true, id };
}

// drafts three headlines or a new About section for a saved report
export async function rewriteLinkedin(reportId: string, part: "headline" | "about"): Promise<Result<{ options: string[]; remaining: number | null }>> {
  try {
    const user = await getCurrentUser();
    const saved = await getLinkedinReport(user.id, reportId);
    if (!saved) return { ok: false, error: "We could not find that report." };

    // a profile is full of personal details, so they are hidden like on a resume
    const whole = redact([saved.profile.headline, saved.profile.about, saved.profile.experience].join("\n<<<>>>\n"));
    const [headline = "", about = "", experience = ""] = whole.text.split("\n<<<>>>\n");
    const wanted = saved.report.keywords.filter((keyword) => keyword.category === "hard").sort((a, b) => b.jdCount - a.jdCount).slice(0, 10).map((keyword) => keyword.name);
    const prompt = linkedinPrompt({ headline, about, experience, skills: saved.profile.skills, jobTitles: saved.report.jobTitles, wanted });

    const options =
      part === "headline"
        ? (await generateJSON("linkedin", { system: LINKEDIN_HEADLINE_SYSTEM, prompt }, headlinesSchema, { userId: user.id })).options.map((option) => whole.restore(tidy(option)).slice(0, 220)).slice(0, 3)
        : [whole.restore(tidy(await generateText("linkedin", { system: LINKEDIN_ABOUT_SYSTEM, prompt }, { userId: user.id })))];
    return { ok: true, options, remaining: await remainingToday(user.id, "linkedin") };
  } catch (error) {
    return problem(error);
  }
}

// the resume to build questions and feedback from: the job's own, or the base resume
async function resumeFor(userId: string, resumeId: string | null | undefined): Promise<string> {
  const resumes = await listResumes(userId);
  const id = resumeId ?? resumes.find((resume) => resume.isBase)?.id ?? resumes[0]?.id;
  return id ? ((await getResume(userId, id))?.rawText ?? "") : "";
}

// starts a practice interview for a tracked job or a pasted job description
export async function startPractice(input: { jobId?: string; jdText?: string }): Promise<Result<{ id: string }>> {
  const parsed = z.object({ jobId: z.uuid().optional(), jdText: z.string().trim().max(60_000).optional() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Pick a job or paste a job description." };
  const user = await getCurrentUser();
  const job = parsed.data.jobId ? await getJob(user.id, parsed.data.jobId) : null;
  const jdText = parsed.data.jdText || job?.description || "";
  if (jdText.length < 50) return { ok: false, error: job ? "That job has no description yet. Add one on its card, or paste it here." : "Paste the job description, the questions are written from it." };

  const resume = await resumeFor(user.id, job?.resumeId);
  const jobTitle = job?.title ?? analyzeJd(jdText).jobTitle;
  // written by the model when one is set up, otherwise built from the job and resume directly
  let questions = fallbackQuestions(jdText, resume, jobTitle);
  if (await aiAvailable(user.id)) {
    try {
      const hidden = redact(resume, resume ? parseResume(resume).contact : null);
      const reply = await generateJSON("interview", { system: INTERVIEW_QUESTIONS_SYSTEM, prompt: interviewQuestionsPrompt({ jobTitle, jdText, resume: hidden.text }) }, questionsSchema, { userId: user.id });
      if (reply.questions.length >= 6) questions = reply.questions.slice(0, 8).map((question) => ({ ...question, question: hidden.restore(question.question) }));
    } catch {
      // the built in questions are a fine stand in
    }
  }
  const id = await createPracticeSession(user.id, { jobId: job?.id ?? null, jobTitle, company: job?.company ?? analyzeJd(jdText).company, jdText, questions });
  revalidatePath("/interview");
  return { ok: true, id };
}

// saves one answer, measures it, and asks for coaching when a model is available
export async function answerQuestion(input: { sessionId: string; index: number; text: string; seconds: number | null; spoken: boolean }): Promise<Result<{ answer: PracticeAnswer; coached: boolean; note: string | null }>> {
  const parsed = z
    .object({ sessionId: z.uuid(), index: z.number().int().min(0).max(20), text: z.string().trim().min(1, "Type or say an answer first.").max(8000), seconds: z.number().min(0).max(3600).nullable(), spoken: z.boolean() })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check your answer." };
  const user = await getCurrentUser();
  const session = await getPracticeSession(user.id, parsed.data.sessionId);
  const question = session?.questions[parsed.data.index];
  if (!session || !question) return { ok: false, error: "We could not find that question." };

  const { text, seconds, spoken } = parsed.data;
  // pace only means something for a spoken answer
  const answer: PracticeAnswer = { text, seconds, spoken, metrics: measureAnswer(text, spoken ? seconds : null), feedback: null };
  let note: string | null = null;
  try {
    const job = session.jobId ? await getJob(user.id, session.jobId) : null;
    const resume = await resumeFor(user.id, job?.resumeId);
    const contact = resume ? parseResume(resume).contact : null;
    const hiddenResume = redact(resume, contact);
    const hiddenAnswer = redact(text, contact);
    const feedback = await generateJSON(
      "interview",
      { system: INTERVIEW_FEEDBACK_SYSTEM, prompt: interviewFeedbackPrompt({ question: question.question, answer: hiddenAnswer.text, jobTitle: session.jobTitle, jdText: session.jdText, resume: hiddenResume.text }) },
      feedbackSchema,
      { userId: user.id },
    );
    answer.feedback = { ...feedback, score: Math.round(feedback.score), sample_answer: hiddenResume.restore(hiddenAnswer.restore(tidy(feedback.sample_answer))) };
  } catch (error) {
    // the answer and its measurements are still saved, only the coaching is missing
    note = error instanceof AiBusyError || error instanceof AiLimitError || error instanceof AiUnavailableError ? error.message : "Coaching is not available right now.";
  }
  await savePracticeAnswer(user.id, session, parsed.data.index, answer);
  revalidatePath(`/interview/${session.id}`);
  return { ok: true, answer, coached: answer.feedback !== null, note };
}
