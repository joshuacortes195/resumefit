import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { APPLICATION_STATUSES, JOB_STATUSES, RESUME_SOURCES } from "@resumefit/shared";

// enums shared with the rest of the app
export const jobStatus = pgEnum("job_status", JOB_STATUSES);
export const applicationStatus = pgEnum("application_status", APPLICATION_STATUSES);
export const resumeSource = pgEnum("resume_source", RESUME_SOURCES);

// created and updated stamps most tables use
const createdAt = timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = timestamp("updated_at", { withTimezone: true })
  .notNull()
  .defaultNow()
  .$onUpdate(() => new Date());

// points a row at the user who owns it, deleting the user deletes the row
const ownerId = () =>
  uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" });

// people who can sign in
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name"),
  avatar: text("avatar"),
  inviteCodeUsed: text("invite_code_used"),
  isAdmin: boolean("is_admin").notNull().default(false),
  createdAt,
});

// codes that let friends sign up
export const inviteCodes = pgTable("invite_codes", {
  code: text("code").primaryKey(),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  maxUses: integer("max_uses").notNull().default(1),
  uses: integer("uses").notNull().default(0),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt,
});

// contact info and answers we reuse when filling applications
export const profiles = pgTable("profiles", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  fullName: text("full_name"),
  phone: text("phone"),
  email: text("email"),
  city: text("city"),
  state: text("state"),
  country: text("country"),
  zip: text("zip"),
  linkedinUrl: text("linkedin_url"),
  githubUrl: text("github_url"),
  portfolioUrl: text("portfolio_url"),
  otherLinks: text("other_links").array().notNull().default(sql`'{}'::text[]`),
  yearsExperience: real("years_experience"),
  workAuthorization: text("work_authorization"),
  needsSponsorship: boolean("needs_sponsorship"),
  willingToRelocate: boolean("willing_to_relocate"),
  desiredSalaryMin: integer("desired_salary_min"),
  desiredSalaryMax: integer("desired_salary_max"),
  earliestStartDate: date("earliest_start_date"),
  jobTypes: text("job_types").array().notNull().default(sql`'{}'::text[]`),
  preferredIndustries: text("preferred_industries").array().notNull().default(sql`'{}'::text[]`),
  remotePreference: text("remote_preference"),
  // demographic answers, we never guess these
  eeoGender: text("eeo_gender").notNull().default("Decline to self-identify"),
  eeoRace: text("eeo_race").notNull().default("Decline to self-identify"),
  eeoVeteran: text("eeo_veteran").notNull().default("Decline to self-identify"),
  eeoDisability: text("eeo_disability").notNull().default("Decline to self-identify"),
  // saved answers to common screening questions
  qaBank: jsonb("qa_bank").notNull().default([]),
  // skills the user added to their own dictionary, checked on every scan
  customSkills: jsonb("custom_skills").notNull().default([]),
  updatedAt,
});

// every resume version a user has
export const resumes = pgTable(
  "resumes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: ownerId(),
    name: text("name").notNull(),
    isBase: boolean("is_base").notNull().default(false),
    source: resumeSource("source").notNull().default("upload"),
    filePath: text("file_path"),
    fileType: text("file_type"),
    rawText: text("raw_text"),
    parsed: jsonb("parsed"),
    layoutMeta: jsonb("layout_meta"),
    builderData: jsonb("builder_data"),
    templateSettings: jsonb("template_settings"),
    linkedJobId: uuid("linked_job_id"),
    createdAt,
    updatedAt,
  },
  (table) => [
    index("resumes_user_idx").on(table.userId),
    // only one base resume per user
    uniqueIndex("resumes_one_base_per_user").on(table.userId).where(sql`${table.isBase}`),
  ],
);

// jobs on the tracker board
export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: ownerId(),
    title: text("title").notNull(),
    company: text("company"),
    location: text("location"),
    url: text("url"),
    salary: text("salary"),
    description: text("description"),
    detectedAts: text("detected_ats"),
    status: jobStatus("status").notNull().default("saved"),
    archived: boolean("archived").notNull().default(false),
    dateApplied: date("date_applied"),
    resumeId: uuid("resume_id").references(() => resumes.id, { onDelete: "set null" }),
    coverLetterId: uuid("cover_letter_id"),
    notes: text("notes"),
    // order of the card inside its column
    position: integer("position").notNull().default(0),
    createdAt,
    updatedAt,
  },
  (table) => [index("jobs_user_status_idx").on(table.userId, table.status)],
);

// one resume vs job description comparison
export const scans = pgTable(
  "scans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: ownerId(),
    resumeId: uuid("resume_id").references(() => resumes.id, { onDelete: "set null" }),
    jobId: uuid("job_id").references(() => jobs.id, { onDelete: "set null" }),
    // shown as the report title, both can be edited
    jobTitle: text("job_title"),
    company: text("company"),
    jobUrl: text("job_url"),
    jdText: text("jd_text").notNull(),
    jdHash: text("jd_hash").notNull(),
    resumeTextSnapshot: text("resume_text_snapshot").notNull(),
    matchRate: integer("match_rate").notNull(),
    categoryScores: jsonb("category_scores").notNull(),
    // the full list of findings shown on the report
    report: jsonb("report").notNull(),
    jobTitleOverride: text("job_title_override"),
    educationOverride: text("education_override"),
    // skills added by hand on the report page
    customSkills: jsonb("custom_skills").notNull().default([]),
    // layout of the file that was scanned, kept so the scan can be rerun after the resume is deleted
    layoutMeta: jsonb("layout_meta"),
    archived: boolean("archived").notNull().default(false),
    createdAt,
  },
  (table) => [index("scans_user_created_idx").on(table.userId, table.createdAt), index("scans_job_idx").on(table.jobId)],
);

// ai read of a job description, shared so the same posting is never analyzed twice
export const jdAnalysisCache = pgTable("jd_analysis_cache", {
  jdHash: text("jd_hash").primaryKey(),
  aiExtraction: jsonb("ai_extraction").notNull(),
  provider: text("provider").notNull(),
  model: text("model").notNull(),
  createdAt,
});

// cover letters saved to a job
export const coverLetters = pgTable("cover_letters", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: ownerId(),
  jobId: uuid("job_id").references(() => jobs.id, { onDelete: "cascade" }),
  resumeId: uuid("resume_id").references(() => resumes.id, { onDelete: "set null" }),
  content: text("content").notNull(),
  tone: text("tone"),
  createdAt,
});

// interviews scheduled for a job
export const interviews = pgTable("interviews", {
  id: uuid("id").primaryKey().defaultRandom(),
  jobId: uuid("job_id")
    .notNull()
    .references(() => jobs.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  datetime: timestamp("datetime", { withTimezone: true }),
  interviewerName: text("interviewer_name"),
  phone: text("phone"),
  email: text("email"),
  meetingLink: text("meeting_link"),
  description: text("description"),
  thankYouNote: text("thank_you_note"),
  createdAt,
});

// a round of rewrite suggestions for a scan
export const optimizations = pgTable("optimizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: ownerId(),
  scanId: uuid("scan_id").references(() => scans.id, { onDelete: "cascade" }),
  originalText: text("original_text").notNull(),
  suggestions: jsonb("suggestions").notNull().default([]),
  acceptedIds: text("accepted_ids").array().notNull().default(sql`'{}'::text[]`),
  finalText: text("final_text"),
  beforeScore: integer("before_score"),
  afterScore: integer("after_score"),
  createdAt,
});

// linkedin profile reports
export const linkedinReports = pgTable("linkedin_reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: ownerId(),
  profileText: jsonb("profile_text").notNull(),
  jobDescriptions: text("job_descriptions").array().notNull().default(sql`'{}'::text[]`),
  score: integer("score"),
  findings: jsonb("findings"),
  createdAt,
});

// interview practice runs
export const interviewSessions = pgTable("interview_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: ownerId(),
  jobId: uuid("job_id").references(() => jobs.id, { onDelete: "set null" }),
  questions: jsonb("questions").notNull().default([]),
  answers: jsonb("answers").notNull().default([]),
  feedback: jsonb("feedback"),
  createdAt,
});

// autofill runs from the extension
export const applications = pgTable("applications", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: ownerId(),
  jobId: uuid("job_id").references(() => jobs.id, { onDelete: "set null" }),
  ats: text("ats"),
  applyUrl: text("apply_url"),
  status: applicationStatus("status").notNull().default("queued"),
  fieldsFilled: integer("fields_filled").notNull().default(0),
  fieldsNeedingAttention: integer("fields_needing_attention").notNull().default(0),
  aiAnswers: jsonb("ai_answers"),
  createdAt,
  updatedAt,
});

// one row per ai call, used for daily caps and the admin page
export const aiUsage = pgTable(
  "ai_usage",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: ownerId(),
    feature: text("feature").notNull(),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    tokensIn: integer("tokens_in").notNull().default(0),
    tokensOut: integer("tokens_out").notNull().default(0),
    createdAt,
  },
  (table) => [index("ai_usage_user_day_idx").on(table.userId, table.feature, table.createdAt)],
);

// optional keys a user brings themselves, stored encrypted
export const userAiKeys = pgTable(
  "user_ai_keys",
  {
    userId: ownerId(),
    provider: text("provider").notNull(),
    encryptedKey: text("encrypted_key").notNull(),
    createdAt,
  },
  (table) => [primaryKey({ columns: [table.userId, table.provider] })],
);
