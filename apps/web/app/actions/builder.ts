"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { countSkills } from "@resumefit/scoring";
import { HARD_SKILLS, SOFT_SKILLS } from "@resumefit/skills-data";
import { remainingToday } from "@/lib/ai/limits";
import { BUILDER_BULLETS_SYSTEM, BUILDER_SKILLS_SYSTEM, BUILDER_SUMMARY_SYSTEM, builderBulletsPrompt, builderBulletsSchema, builderSkillsSchema, builderSummaryPrompt } from "@/lib/ai/prompts/builder";
import { tidy } from "@/lib/ai/prompts/style";
import { redact } from "@/lib/ai/redact";
import { AiBusyError, AiLimitError, AiUnavailableError, aiAvailable, generateJSON, generateText } from "@/lib/ai/router";
import { getCurrentUser } from "@/lib/auth";
import { builderToText } from "@/lib/builder/layout";
import { builderDataSchema, templateSettingsSchema } from "@/lib/builder/types";
import { createBuilderResume, saveBuilderResume } from "@/lib/data/builder";
import { deleteResume } from "@/lib/data/resumes";
import { savedJobs } from "@/lib/jobs-feed";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

// turns anything that went wrong with a writing request into a message
function problem(error: unknown): { ok: false; error: string } {
  if (error instanceof AiBusyError || error instanceof AiLimitError || error instanceof AiUnavailableError) return { ok: false, error: error.message };
  console.error(error instanceof Error ? error.message : "builder action failed");
  return { ok: false, error: "Something went wrong on our side. Try again in a moment." };
}

// starts an empty resume and says where to find it
export async function startBlankResume(): Promise<Result<{ id: string }>> {
  const user = await getCurrentUser();
  const id = await createBuilderResume(user.id);
  revalidatePath("/resumes");
  return { ok: true, id };
}

// saves the builder as it stands, called a moment after every change
export async function saveBuilder(id: string, data: unknown, settings: unknown): Promise<Result> {
  const parsedData = builderDataSchema.safeParse(data);
  const parsedSettings = templateSettingsSchema.safeParse(settings);
  if (!z.uuid().safeParse(id).success || !parsedData.success || !parsedSettings.success) return { ok: false, error: "Some of what you typed is too long to save. Shorten it and it will save again." };
  const user = await getCurrentUser();
  if (!(await saveBuilderResume(user.id, id, parsedData.data, parsedSettings.data))) return { ok: false, error: "We could not find that resume." };
  return { ok: true };
}

// writes bullets for one job from a short description of what the person did there
export async function writeBullets(input: { title: string; company: string; description: string }): Promise<Result<{ bullets: string[]; remaining: number | null }>> {
  const parsed = z.object({ title: z.string().max(200), company: z.string().max(200), description: z.string().trim().min(15, "Tell us a bit more about what you did, a sentence or two is enough.").max(2000) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Describe the job first." };
  try {
    const user = await getCurrentUser();
    const reply = await generateJSON("builder", { system: BUILDER_BULLETS_SYSTEM, prompt: builderBulletsPrompt(parsed.data) }, builderBulletsSchema, { userId: user.id, fast: true });
    return { ok: true, bullets: reply.bullets.map((bullet) => tidy(bullet).replace(/^[•\-*]\s*/, "")).filter(Boolean), remaining: await remainingToday(user.id, "builder") };
  } catch (error) {
    return problem(error);
  }
}

// writes the summary from the rest of the resume, leaning toward a job description when one is given
export async function writeSummary(data: unknown, jdText: string): Promise<Result<{ summary: string; remaining: number | null }>> {
  const parsed = builderDataSchema.safeParse(data);
  if (!parsed.success) return { ok: false, error: "Fill in your experience first." };
  if (parsed.data.experience.length === 0 && parsed.data.education.length === 0) return { ok: false, error: "Add some experience or education first, the summary is written from them." };
  try {
    const user = await getCurrentUser();
    // the summary is written from everything except the old summary, with contact details hidden
    const resume = redact(builderToText({ ...parsed.data, summary: "" }, "classic"), { name: parsed.data.profile.name, location: parsed.data.profile.location });
    const summary = await generateText("builder", { system: BUILDER_SUMMARY_SYSTEM, prompt: builderSummaryPrompt({ resume: resume.text, years: parsed.data.profile.years, jdText: jdText.slice(0, 20_000) }) }, { userId: user.id });
    return { ok: true, summary: resume.restore(tidy(summary)), remaining: await remainingToday(user.id, "builder") };
  } catch (error) {
    return problem(error);
  }
}

// finds the skills a job description asks for, most mentioned first. no ai involved
export async function skillsFromJob(jdText: string): Promise<Result<{ skills: string[] }>> {
  const text = jdText.trim();
  if (text.length < 20) return { ok: false, error: "Paste a job description, or at least a few lines of one." };
  await getCurrentUser();
  const counts = countSkills(text.slice(0, 60_000), [...HARD_SKILLS, ...SOFT_SKILLS]);
  const skills = [...counts].sort((a, b) => b[1] - a[1]).map(([name]) => name);
  return skills.length > 0 ? { ok: true, skills: skills.slice(0, 24) } : { ok: false, error: "We did not recognize any skills in that text. Try pasting more of the job description." };
}

// words in a job title that say nothing about the kind of work
const TITLE_FILLER = new Set(["senior", "junior", "lead", "staff", "principal", "associate", "the", "and", "for", "intern", "internship", "entry", "level", "new", "grad", "summer", "fall", "spring", "winter", "part", "full", "time", "remote"]);

// suggests skills from a job title alone. real postings with that title are read first, a model fills in when there are too few
export async function skillsForTitle(title: string): Promise<Result<{ skills: string[] }>> {
  const wanted = title.trim().slice(0, 100);
  if (wanted.length < 2) return { ok: false, error: "Type the job title you are aiming for, like Supply Chain Analyst." };
  const user = await getCurrentUser();
  const words = wanted
    .toLowerCase()
    .split(/[^a-z0-9+#]+/)
    .filter((word) => word.length > 1 && !TITLE_FILLER.has(word));

  // count the skills that open jobs with this title ask for
  const tally = new Map<string, number>();
  if (words.length > 0) {
    const { jobs } = await savedJobs();
    for (const job of jobs) {
      const jobTitle = job.title.toLowerCase();
      if (!words.every((word) => jobTitle.includes(word))) continue;
      for (const skill of job.skills) tally.set(skill, (tally.get(skill) ?? 0) + 1);
    }
  }
  const skills = [...tally].sort((a, b) => b[1] - a[1]).map(([name]) => name);

  // not enough postings to go on, so ask for the usual skills of that job
  if (skills.length < 10 && (await aiAvailable(user.id))) {
    try {
      const reply = await generateJSON("builder", { system: BUILDER_SKILLS_SYSTEM, prompt: `Job title: ${wanted}` }, builderSkillsSchema, { userId: user.id, fast: true });
      for (const skill of reply.skills.map((entry) => tidy(entry).slice(0, 60))) if (skill && !skills.some((known) => known.toLowerCase() === skill.toLowerCase())) skills.push(skill);
    } catch (error) {
      if (skills.length === 0) return problem(error);
    }
  }
  return skills.length > 0 ? { ok: true, skills: skills.slice(0, 24) } : { ok: false, error: "We could not find skills for that title. Try a more common way of saying it, or paste a job description below." };
}

// throws away a resume that was started in the builder and then cancelled
export async function discardDraft(id: string): Promise<Result> {
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "We could not find that resume." };
  const user = await getCurrentUser();
  await deleteResume(user.id, id);
  revalidatePath("/resumes");
  return { ok: true };
}
