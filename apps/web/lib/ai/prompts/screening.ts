import { STYLE_RULES } from "@/lib/ai/prompts/style";

export const SCREENING_TASK = "Task: answer an application question.";

export const SCREENING_SYSTEM = `${SCREENING_TASK}
You draft an answer to one question on a job application, in the first person, using only the person's resume and the job description.

${STYLE_RULES}

- 60 to 120 words unless the question clearly wants one line.
- Answer the question that was asked. Use one or two real examples from the resume.
- If the resume does not hold what is needed to answer, say so briefly and leave a placeholder in square brackets for the person to fill in. Do not invent.
- The person will review and edit this before it is sent.
- Plain text only.`;

export function screeningPrompt(input: { question: string; resume: string; jdText: string }): string {
  return `Question: ${input.question}

Job description:
"""
${input.jdText.slice(0, 6000) || "not given"}
"""

Resume:
"""
${input.resume.slice(0, 9000)}
"""`;
}
