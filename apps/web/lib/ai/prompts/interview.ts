import { z } from "zod";
import { STYLE_RULES } from "@/lib/ai/prompts/style";

export const QUESTION_TYPES = ["behavioral", "technical", "resume"] as const;
export const questionSchema = z.object({ type: z.enum(QUESTION_TYPES), question: z.string().min(10).max(400) });
export const questionsSchema = z.object({ questions: z.array(questionSchema).min(4).max(12) });
export type InterviewQuestion = z.infer<typeof questionSchema>;

export const INTERVIEW_QUESTIONS_TASK = "Task: write interview questions.";
export const INTERVIEW_QUESTIONS_SYSTEM = `${INTERVIEW_QUESTIONS_TASK}
You write practice interview questions for one job, for one candidate.

- Write exactly 8 questions: 3 behavioral ("tell me about a time..."), 3 technical or role specific questions about the skills the job asks for, and 2 about specific things on the candidate's resume ("tell me about the ... project").
- Make them the questions a real interviewer for this role would ask. One sentence each.
- Resume questions must point at something that is really on the resume.
- Placeholders like [NAME_1] stand for private details. Do not use them in questions.`;

export function interviewQuestionsPrompt(input: { jobTitle: string | null; jdText: string; resume: string }): string {
  return `Job title: ${input.jobTitle ?? "not given"}

Job description:
"""
${input.jdText.slice(0, 6000)}
"""

Candidate's resume:
"""
${input.resume.slice(0, 8000) || "not given"}
"""`;
}

// what comes back for one answer
export const feedbackSchema = z.object({
  score: z.number().min(0).max(100),
  star: z.object({ situation: z.boolean(), task: z.boolean(), action: z.boolean(), result: z.boolean() }),
  relevance: z.string().max(400),
  specificity: z.string().max(400),
  improve: z.array(z.string().max(300)).max(4),
  sample_answer: z.string().max(1800),
});
export type AnswerFeedback = z.infer<typeof feedbackSchema>;

export const INTERVIEW_FEEDBACK_TASK = "Task: give interview feedback.";
export const INTERVIEW_FEEDBACK_SYSTEM = `${INTERVIEW_FEEDBACK_TASK}
You are a fair, direct interview coach. You give feedback on one practice answer.

${STYLE_RULES}

- score: 0 to 100 for how well the answer would land in a real interview. An empty or off topic answer scores under 20. Most decent answers land between 50 and 80.
- star: for each of situation, task, action and result, true only if the answer clearly includes it.
- relevance: one or two sentences on how well the answer fits what this job is looking for.
- specificity: one or two sentences on whether the answer gives concrete details and numbers.
- improve: two or three short, specific things to change.
- sample_answer: a stronger answer of 90 to 150 words in the first person, built only from facts in the candidate's resume and their own answer. Where a number would help and none is given, use a placeholder like [X%]. Never invent experience.`;

export function interviewFeedbackPrompt(input: { question: string; answer: string; jobTitle: string | null; jdText: string; resume: string }): string {
  return `Job title: ${input.jobTitle ?? "not given"}

Job description:
"""
${input.jdText.slice(0, 4000)}
"""

Candidate's resume:
"""
${input.resume.slice(0, 6000) || "not given"}
"""

Question: ${input.question}

The candidate's answer:
"""
${input.answer.slice(0, 5000)}
"""`;
}
