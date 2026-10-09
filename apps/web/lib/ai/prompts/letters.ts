import { STYLE_RULES } from "@/lib/ai/prompts/style";

export const TONES = ["Professional", "Enthusiastic", "Concise", "Conversational"] as const;
export type Tone = (typeof TONES)[number];

// the three lengths on offer, in words
export const LENGTHS = { Short: 150, Standard: 250, Detailed: 350 } as const;
export type Length = keyof typeof LENGTHS;

export const COVER_LETTER_TASK = "Task: write a cover letter.";

export function coverLetterSystem(tone: Tone, length: Length): string {
  return `${COVER_LETTER_TASK}
You write a cover letter for one job, using only facts from the person's resume.

${STYLE_RULES}

- Tone: ${tone}. Length: about ${LENGTHS[length]} words.
- Do not open with "I am writing to express my interest" or any version of it. Start with something specific about the role or the person's most relevant work.
- Pick two or three things from the resume that match what the job asks for and say what the person did.
- If the person gave a reason for wanting this company, work it in. Do not make up reasons or facts about the company.
- Address it to the hiring manager by name when one is given, otherwise "Dear Hiring Manager,".
- End with a short closing line and the person's name placeholder if the resume has one.
- Plain text only. No headings, no bullet points, no subject line.`;
}

export function coverLetterPrompt(input: { resume: string; jdText: string; jobTitle: string | null; company: string | null; why?: string; manager?: string }): string {
  return `Job title: ${input.jobTitle ?? "not given"}
Company: ${input.company ?? "not given"}
Hiring manager: ${input.manager?.trim() || "not given"}
Why this company, in the person's words: ${input.why?.trim() || "not given"}

Job description:
"""
${input.jdText.slice(0, 8000)}
"""

Resume:
"""
${input.resume.slice(0, 10_000)}
"""`;
}

export const THANK_YOU_TASK = "Task: write a thank-you note.";

export const THANK_YOU_SYSTEM = `${THANK_YOU_TASK}
You write a short thank-you email to send after a job interview.

${STYLE_RULES}

- 80 to 120 words. Warm and direct.
- Thank the interviewer by name when one is given. Mention the kind of interview and the role.
- If the person's notes mention something that was discussed, refer to one thing from them. Do not invent topics.
- Say once that the person is still interested, and close simply.
- Plain text only, starting with the greeting. No subject line.`;

export function thankYouPrompt(input: { jobTitle: string; company: string | null; type: string; interviewer: string | null; notes: string | null; name: string | null }): string {
  return `Role: ${input.jobTitle}
Company: ${input.company ?? "not given"}
Interview type: ${input.type}
Interviewer: ${input.interviewer ?? "not given"}
The person's notes from the interview: ${input.notes ?? "none"}
Sign off as: ${input.name ?? "the person's name placeholder"}`;
}
