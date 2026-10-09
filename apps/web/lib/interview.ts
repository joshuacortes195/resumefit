import { countSkills, parseResume } from "@resumefit/scoring";
import { HARD_SKILLS, SOFT_SKILLS } from "@resumefit/skills-data";
import type { InterviewQuestion } from "@/lib/ai/prompts/interview";

// sounds and phrases people fall back on while they think
const FILLERS = ["um", "uh", "erm", "like", "you know", "sort of", "kind of", "basically", "actually", "literally", "i mean", "right", "so yeah"];

// what we can measure about an answer without any outside help
export type AnswerMetrics = {
  words: number;
  // words per minute, null when the answer was not timed
  wordsPerMinute: number | null;
  fillerCount: number;
  // which fillers showed up and how often
  fillers: { word: string; count: number }[];
};

// counts words, pace and filler words in an answer
export function measureAnswer(answer: string, seconds: number | null): AnswerMetrics {
  const text = answer.toLowerCase();
  const words = text.split(/\s+/).filter(Boolean).length;
  const fillers = FILLERS.map((word) => ({ word, count: (text.match(new RegExp(`\\b${word}\\b`, "g")) ?? []).length })).filter((entry) => entry.count > 0);
  // "like" and "right" are often real words, so they only count when they come up a lot
  const counted = fillers.filter((entry) => !["like", "right", "actually"].includes(entry.word) || entry.count >= 3);
  return {
    words,
    wordsPerMinute: seconds && seconds >= 5 ? Math.round((words / seconds) * 60) : null,
    fillerCount: counted.reduce((total, entry) => total + entry.count, 0),
    fillers: counted.sort((a, b) => b.count - a.count),
  };
}

// questions that work for any job, used to fill out the set
const BEHAVIORAL = [
  "Tell me about a time you had to solve a problem with very little guidance.",
  "Tell me about a time you disagreed with a teammate. What did you do?",
  "Describe a mistake you made at work and what you changed afterwards.",
  "Tell me about a time you had too much to do. How did you decide what came first?",
];

// builds a set of eight questions from the job description and resume alone, for when no ai is set up
export function fallbackQuestions(jdText: string, resumeText: string, jobTitle: string | null): InterviewQuestion[] {
  const skills = [...countSkills(jdText, HARD_SKILLS)].sort((a, b) => b[1] - a[1]).map(([name]) => name);
  const soft = [...countSkills(jdText, SOFT_SKILLS)].map(([name]) => name);
  const jobs = resumeText ? parseResume(resumeText).experience : [];
  const role = jobTitle ?? "this role";

  const technical: InterviewQuestion[] = skills.slice(0, 3).map((skill, index) => ({
    type: "technical",
    question: [`Walk me through how you have used ${skill} in your work.`, `What is the hardest problem you have solved with ${skill}?`, `How would you explain ${skill} to someone new to the team?`][index] ?? `Tell me about your experience with ${skill}.`,
  }));
  while (technical.length < 3) technical.push({ type: "technical", question: [`What does a strong first ninety days look like in ${role}?`, `What part of ${role} do you expect to find hardest, and why?`, `How do you keep your skills up to date for ${role}?`][technical.length] ?? `Why are you a fit for ${role}?` });

  const resume: InterviewQuestion[] = jobs.slice(0, 2).map((job) => ({
    type: "resume",
    question: job.bullets[0] ? `On your resume you say: "${job.bullets[0].slice(0, 140)}". Tell me more about your part in that.` : `Tell me about your time as ${job.title ?? "an employee"}${job.company ? ` at ${job.company}` : ""}.`,
  }));
  while (resume.length < 2) resume.push({ type: "resume", question: resume.length === 0 ? "Walk me through your background and what brought you to this kind of work." : "What piece of work are you most proud of, and why?" });

  const behavioral: InterviewQuestion[] = [
    ...(soft[0] ? [{ type: "behavioral" as const, question: `This job calls for ${soft[0].toLowerCase()}. Tell me about a time you showed it.` }] : []),
    ...BEHAVIORAL.map((question) => ({ type: "behavioral" as const, question })),
  ].slice(0, 3);

  return [behavioral[0], technical[0], resume[0], behavioral[1], technical[1], resume[1], behavioral[2], technical[2]].filter((question): question is InterviewQuestion => Boolean(question));
}
