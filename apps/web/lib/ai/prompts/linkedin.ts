import { z } from "zod";
import { STYLE_RULES } from "@/lib/ai/prompts/style";

export const headlinesSchema = z.object({ options: z.array(z.string()).min(1).max(5) });

export const LINKEDIN_HEADLINE_TASK = "Task: write linkedin headlines.";
export const LINKEDIN_HEADLINE_SYSTEM = `${LINKEDIN_HEADLINE_TASK}
You write LinkedIn headlines for a job seeker.

${STYLE_RULES}

- Write exactly 3 options, each under 200 characters.
- Each one names the kind of role the person wants and two or three skills they already show in their profile.
- Use only skills and facts from the profile. Prefer the ones the target jobs ask for.
- No emoji, no "seeking opportunities", no "guru", "ninja" or "rockstar".`;

export const LINKEDIN_ABOUT_TASK = "Task: write a linkedin about section.";
export const LINKEDIN_ABOUT_SYSTEM = `${LINKEDIN_ABOUT_TASK}
You rewrite the About section of a LinkedIn profile.

${STYLE_RULES}

- 200 to 260 words, first person, three or four short paragraphs.
- Open with what the person does and for whom. Then two or three things they have done, using results that are already in the profile. End with what they are looking for.
- Work in the skills the target jobs ask for, but only the ones the profile already shows.
- Plain text only, no headings and no bullet points.`;

// the request for either rewrite
export function linkedinPrompt(input: { headline: string; about: string; experience: string; skills: string[]; jobTitles: string[]; wanted: string[] }): string {
  return `Target job titles: ${input.jobTitles.join(", ") || "not given"}
Skills the target jobs ask for most: ${input.wanted.join(", ") || "not given"}

Current headline: ${input.headline || "none"}

Current About section:
"""
${input.about.slice(0, 4000) || "none"}
"""

Experience:
"""
${input.experience.slice(0, 6000) || "none"}
"""

Skills listed on the profile: ${input.skills.slice(0, 60).join(", ") || "none"}`;
}
