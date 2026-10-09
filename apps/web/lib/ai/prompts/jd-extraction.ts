import { z } from "zod";

// what we ask the model to pull out of a job description
export const jdExtractionSchema = z.object({
  job_title: z.string().nullable(),
  company: z.string().nullable(),
  seniority: z.string().nullable(),
  years_required_min: z.number().nullable(),
  years_required_max: z.number().nullable(),
  education_required: z.string().nullable(),
  education_preferred: z.string().nullable(),
  hard_skills: z.array(z.object({ name: z.string(), importance: z.enum(["required", "preferred"]), count: z.number() })),
  soft_skills: z.array(z.object({ name: z.string(), importance: z.enum(["required", "preferred"]), count: z.number() })),
  certifications: z.array(z.string()),
  tools: z.array(z.string()),
  responsibilities_summary: z.string(),
  detected_ats_hint: z.string().nullable(),
});
export type JdExtraction = z.infer<typeof jdExtractionSchema>;

export const JD_EXTRACTION_SYSTEM = `You read job descriptions and pull out the facts a resume scanner needs.

- Only list skills, tools and certifications that are named in the text. Do not guess or add related ones.
- Use the spelling from the job description. Keep each skill short, one to four words.
- A skill is "required" unless it only appears under headings like preferred, nice to have or bonus, or in a sentence that calls it a plus.
- "count" is how many times the skill is mentioned.
- Ignore benefits, perks, salary and legal text.
- Use null when the text does not say.
- education levels must be one of: High School, Associate, Bachelor's, Master's, MBA, JD, MD, PhD.`;

// the request for one job description
export function jdExtractionPrompt(jdText: string): string {
  return `Job description:\n"""\n${jdText.slice(0, 12_000)}\n"""`;
}
