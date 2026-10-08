import { z } from "zod";

// the columns a job can sit in on the tracker
export const JOB_STATUSES = ["saved", "applied", "interview", "offer", "rejected"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

// where an auto apply run is at
export const APPLICATION_STATUSES = ["queued", "autofilling", "needs_review", "applied", "failed"] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

// how a resume got into the app
export const RESUME_SOURCES = ["upload", "builder", "optimized", "linkedin"] as const;
export type ResumeSource = (typeof RESUME_SOURCES)[number];

// the five parts of the match report
export const SCORE_CATEGORIES = ["hardSkills", "softSkills", "searchability", "recruiterTips", "formatting"] as const;
export type ScoreCategory = (typeof SCORE_CATEGORIES)[number];

// one skill row in the report table
export const skillMatchSchema = z.object({
  name: z.string().min(1),
  category: z.enum(["hard", "soft"]),
  importance: z.enum(["required", "preferred"]),
  jdCount: z.number().int().min(1),
  resumeCount: z.number().int().min(0),
  // exact or alias is a full match, related is a half match
  match: z.enum(["exact", "related", "missing"]),
});
export type SkillMatch = z.infer<typeof skillMatchSchema>;

// what the new scan form sends to the server
export const newScanSchema = z.object({
  resumeId: z.string().uuid().optional(),
  resumeText: z.string().max(60_000).optional(),
  jdText: z.string().min(50, "Paste the full job description").max(60_000),
  jobTitle: z.string().max(200).optional(),
  company: z.string().max(200).optional(),
  jobUrl: z.string().url().optional(),
});
export type NewScanInput = z.infer<typeof newScanSchema>;
