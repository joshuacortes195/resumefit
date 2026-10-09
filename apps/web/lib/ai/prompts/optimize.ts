import { z } from "zod";
import { STYLE_RULES } from "@/lib/ai/prompts/style";

// the kinds of change a suggestion can be
export const SUGGESTION_TYPES = ["summary", "bullet", "skills", "verb", "metric"] as const;

// one proposed change to one line of the resume
export const suggestionSchema = z.object({
  id: z.string(),
  section: z.string(),
  // the number of the line this change is for
  target_ref: z.number().int(),
  original: z.string(),
  proposed: z.string(),
  keywords_added: z.array(z.string()),
  type: z.enum(SUGGESTION_TYPES),
  requires_user_confirmation: z.boolean(),
});
export const suggestionsSchema = z.object({ suggestions: z.array(suggestionSchema).max(30) });
export type Suggestion = z.infer<typeof suggestionSchema>;

// marks which job the fake test provider should do
export const OPTIMIZE_TASK = "Task: suggest resume edits.";

export const OPTIMIZE_SYSTEM = `${OPTIMIZE_TASK}
You help a job seeker tailor their resume to one job description. You suggest edits to single lines. The person accepts or rejects each one.

${STYLE_RULES}

What to suggest:
- "summary": rewrite the summary so it names the target job title and the top skills the person already shows elsewhere in the resume.
- "bullet": rephrase a bullet so a missing keyword fits naturally, only when the bullet already describes that kind of work.
- "skills": add missing skills to the skills line. Set requires_user_confirmation to true for these, because only the person knows if they have the skill.
- "verb": replace a weak opening like "Responsible for", "Helped with" or "Worked on" with a direct verb.
- "metric": when a bullet has no number, add a placeholder such as [X%] or [N] for the person to fill in. Never make up a number.

Rules for the reply:
- target_ref is the line number shown before the line (the N in "N| text"). Change one line per suggestion and never the same line twice.
- original is the line exactly as given, without the number. proposed is the full replacement line and keeps the bullet mark if the line had one.
- Keep each bullet to two lines at most, about 30 words.
- keywords_added lists only the missing keywords that appear in proposed.
- Leave lines that are already strong alone. Between 4 and 12 suggestions is right for most resumes.
- Never touch names, contact details, employers, job titles, dates or schools.`;

// the request for one resume and job
export function optimizePrompt(input: { lines: string[]; jobTitle: string | null; missing: string[]; present: string[]; jdSummary: string }): string {
  const numbered = input.lines.map((line, index) => `${index}| ${line}`).join("\n");
  return `Target job title: ${input.jobTitle ?? "not given"}

Keywords from the job description that are missing from the resume, most important first:
${input.missing.join(", ") || "none"}

Keywords the resume already has:
${input.present.join(", ") || "none"}

Job description:
"""
${input.jdSummary}
"""

Resume, one numbered line each:
"""
${numbered}
"""`;
}

// three ways to write a bullet around one keyword
export const bulletsSchema = z.object({ options: z.array(z.string()).min(1).max(5) });
export const BULLETS_TASK = "Task: write bullet options.";
export const BULLETS_SYSTEM = `${BULLETS_TASK}
You write resume bullet options for one job the person held, each using one given keyword.

${STYLE_RULES}

- Write exactly 3 options. Each is one bullet, under 30 words, starting with a strong verb and no bullet mark.
- Base every option on work the job entry already describes. If a result is not stated, use a placeholder like [X%] or [N] instead of a number.
- Each option must contain the keyword, spelled as given.
- The person will only keep a bullet if it is true for them, so stay close to what they did.`;

export function bulletsPrompt(input: { keyword: string; entry: string; jobTitle: string | null }): string {
  return `Keyword to include: ${input.keyword}
Target job title: ${input.jobTitle ?? "not given"}

The job entry from the resume:
"""
${input.entry}
"""`;
}
