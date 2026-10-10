import { z } from "zod";
import { STYLE_RULES } from "@/lib/ai/prompts/style";

export const builderBulletsSchema = z.object({ bullets: z.array(z.string()).min(1).max(6) });

export const BUILDER_BULLETS_SYSTEM = `You turn a person's short description of a job into resume bullets.

${STYLE_RULES}

- Write 3 to 4 bullets, each under 28 words, starting with a strong verb and no bullet mark.
- Use only what the description says they did. Where a result would help and none is given, use a placeholder like [X%] or [N] instead of a number.
- Do not repeat the job title or company in the bullets.`;

export function builderBulletsPrompt(input: { title: string; company: string; description: string }): string {
  return `Job title: ${input.title || "not given"}
Company: ${input.company || "not given"}

What the person says they did:
"""
${input.description.slice(0, 2000)}
"""`;
}

export const BUILDER_SUMMARY_SYSTEM = `You write the summary at the top of a resume.

${STYLE_RULES}

- Two or three sentences, 40 to 60 words, no bullet points and no heading.
- Say what the person does, how long they have done it if given, and two or three strengths that the resume backs up.
- When a target job description is given, lean toward what it asks for, but only with things the resume shows.
- Do not use "I". Write in the clipped style resumes use, for example "Frontend engineer with four years of ...".
- Plain text only.`;

export function builderSummaryPrompt(input: { resume: string; years: string; jdText?: string }): string {
  return `Years of experience: ${input.years || "not given"}

Target job description:
"""
${input.jdText?.slice(0, 5000) || "not given"}
"""

The rest of the resume:
"""
${input.resume.slice(0, 8000)}
"""`;
}

export const builderSkillsSchema = z.object({ skills: z.array(z.string()).min(1).max(30) });

export const BUILDER_SKILLS_SYSTEM = `You list the skills employers usually ask for in a given job title.

- Give 16 to 20 skills, most commonly requested first.
- Mostly hard skills: tools, software, methods, certifications and domain knowledge specific to that job. Add at most four soft skills at the end.
- Each skill is one to three words, written the way it appears in job postings, like "Inventory Management" or "SQL".
- No explanations and no duplicates.
- Reply with JSON only: {"skills": ["...", "..."]}`;
