import { createHash } from "node:crypto";
import { and, asc, count, desc, eq, gte, ilike, inArray, lt, or } from "drizzle-orm";
import { scanResume, type DegreeLevel, type JdHints, type LayoutMeta, type ScanResult } from "@resumefit/scoring";
import { HARD_SKILLS, SOFT_SKILLS } from "@resumefit/skills-data";
import { getDb, schema } from "@/db";

export type ScanRow = typeof schema.scans.$inferSelect;

// a skill someone added by hand
export type CustomSkill = { name: string; category: "hard" | "soft" };

// a saved scan with its report typed
export type SavedScan = Omit<ScanRow, "report" | "customSkills" | "layoutMeta"> & {
  report: ScanResult;
  customSkills: CustomSkill[];
  layoutMeta: LayoutMeta | null;
};

// how many scans one person can run in a day, just to stop runaway scripts
export const DAILY_SCAN_LIMIT = 50;

// the same posting always gets the same hash, whatever the spacing or casing
export function hashJd(jdText: string): string {
  return createHash("sha256").update(jdText.toLowerCase().replace(/\s+/g, " ").trim()).digest("hex");
}

// the skills a user keeps in their own dictionary
export async function getDictionary(userId: string): Promise<CustomSkill[]> {
  const db = await getDb();
  const [profile] = await db.select({ customSkills: schema.profiles.customSkills }).from(schema.profiles).where(eq(schema.profiles.userId, userId)).limit(1);
  return (profile?.customSkills as CustomSkill[] | undefined) ?? [];
}

// adds a skill to a user's own dictionary
export async function addToDictionary(userId: string, skill: CustomSkill): Promise<void> {
  const current = await getDictionary(userId);
  if (current.some((entry) => entry.name.toLowerCase() === skill.name.toLowerCase())) return;
  const db = await getDb();
  const customSkills = [...current, skill];
  await db.insert(schema.profiles).values({ userId, customSkills }).onConflictDoUpdate({ target: schema.profiles.userId, set: { customSkills } });
}

// the parts of a scan that decide its result
type ScanInputs = {
  resumeText: string;
  jdText: string;
  jobTitle?: string | null;
  jobUrl?: string | null;
  educationOverride?: string | null;
  customSkills?: CustomSkill[];
  layout?: LayoutMeta | null;
  // when the scan was first made, so "Present" always means the same month
  today?: Date;
  // extra facts about the posting from the optional smarter read
  hints?: JdHints | null;
};

// runs the scoring engine with the full skill lists plus the user's own skills
export function runScan(inputs: ScanInputs, dictionary: CustomSkill[] = []): ScanResult {
  const own = (category: "hard" | "soft") => dictionary.filter((skill) => skill.category === category).map((skill) => ({ name: skill.name }));
  const known = new Set([...HARD_SKILLS, ...SOFT_SKILLS].map((skill) => skill.name.toLowerCase()));
  const fresh = (skills: { name: string }[]) => skills.filter((skill) => !known.has(skill.name.toLowerCase()));
  return scanResume({
    resumeText: inputs.resumeText,
    jdText: inputs.jdText,
    jobTitle: inputs.jobTitle ?? undefined,
    jobUrl: inputs.jobUrl ?? undefined,
    educationOverride: (inputs.educationOverride as DegreeLevel | "none" | null | undefined) ?? null,
    customSkills: inputs.customSkills,
    layout: inputs.layout,
    today: inputs.today,
    hints: inputs.hints,
    hardSkills: [...HARD_SKILLS, ...fresh(own("hard"))],
    softSkills: [...SOFT_SKILLS, ...fresh(own("soft"))],
  });
}

// the saved smarter read of a posting, in the shape the scoring engine takes
export async function cachedHints(jdHash: string): Promise<JdHints | null> {
  const db = await getDb();
  const [row] = await db.select({ aiExtraction: schema.jdAnalysisCache.aiExtraction }).from(schema.jdAnalysisCache).where(eq(schema.jdAnalysisCache.jdHash, jdHash)).limit(1);
  return row ? toHints(row.aiExtraction as StoredExtraction) : null;
}

// the parts of a saved read that we use
type StoredExtraction = {
  job_title?: string | null;
  company?: string | null;
  years_required_min?: number | null;
  education_required?: string | null;
  education_preferred?: string | null;
  hard_skills?: { name: string }[];
  soft_skills?: { name: string }[];
  tools?: string[];
  certifications?: string[];
};

// maps a saved read onto the hints the scoring engine takes
export function toHints(extraction: StoredExtraction): JdHints {
  return {
    jobTitle: extraction.job_title,
    company: extraction.company,
    yearsRequired: extraction.years_required_min,
    educationRequired: extraction.education_required,
    educationPreferred: extraction.education_preferred,
    // tools and certifications are hard skills as far as the report goes
    hardSkills: [...(extraction.hard_skills ?? []).map((skill) => skill.name), ...(extraction.tools ?? []), ...(extraction.certifications ?? [])],
    softSkills: (extraction.soft_skills ?? []).map((skill) => skill.name),
  };
}

// turns a database row into a typed scan
function toSaved(row: ScanRow): SavedScan {
  return { ...row, report: row.report as ScanResult, customSkills: (row.customSkills as CustomSkill[]) ?? [], layoutMeta: (row.layoutMeta as LayoutMeta | null) ?? null };
}

// how many scans this user has run in the last day
export async function scansToday(userId: string): Promise<number> {
  const db = await getDb();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [row] = await db
    .select({ total: count() })
    .from(schema.scans)
    .where(and(eq(schema.scans.userId, userId), gte(schema.scans.createdAt, since)));
  return row?.total ?? 0;
}

// what a new scan needs
export type NewScan = {
  resumeId: string | null;
  resumeText: string;
  layout: LayoutMeta | null;
  jdText: string;
  jobTitle?: string | null;
  company?: string | null;
  jobUrl?: string | null;
  jobId?: string | null;
  hints?: JdHints | null;
};

// runs a scan and saves it
export async function createScan(userId: string, input: NewScan): Promise<SavedScan> {
  const db = await getDb();
  const today = new Date();
  // a scan can only hang off a job that belongs to the same person
  if (input.jobId) {
    const [owned] = await db
      .select({ id: schema.jobs.id })
      .from(schema.jobs)
      .where(and(eq(schema.jobs.id, input.jobId), eq(schema.jobs.userId, userId)))
      .limit(1);
    if (!owned) input = { ...input, jobId: null };
  }
  const report = runScan({ resumeText: input.resumeText, jdText: input.jdText, jobTitle: input.jobTitle, jobUrl: input.jobUrl, layout: input.layout, today, hints: input.hints }, await getDictionary(userId));
  const [row] = await db
    .insert(schema.scans)
    .values({
      userId,
      resumeId: input.resumeId,
      jobId: input.jobId ?? null,
      // fall back to what we could read from the posting
      jobTitle: input.jobTitle?.trim() || report.jobTitle,
      company: input.company?.trim() || report.jd.company,
      jobUrl: input.jobUrl ?? null,
      jdText: input.jdText,
      jdHash: hashJd(input.jdText),
      resumeTextSnapshot: input.resumeText,
      matchRate: report.matchRate,
      categoryScores: report.categoryScores,
      report,
      layoutMeta: input.layout,
      createdAt: today,
    })
    .returning();
  if (!row) throw new Error("Could not save the scan.");
  return toSaved(row);
}

// one scan, only if it belongs to this user
export async function getScan(userId: string, id: string): Promise<SavedScan | null> {
  // ids that are not uuids can never match, and postgres would throw on them
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const db = await getDb();
  const [row] = await db
    .select()
    .from(schema.scans)
    .where(and(eq(schema.scans.id, id), eq(schema.scans.userId, userId)))
    .limit(1);
  return row ? toSaved(row) : null;
}

// the scan of the same posting that came right before this one, for the score change
export async function previousScan(userId: string, scan: SavedScan): Promise<{ id: string; matchRate: number } | null> {
  const db = await getDb();
  const [row] = await db
    .select({ id: schema.scans.id, matchRate: schema.scans.matchRate })
    .from(schema.scans)
    .where(and(eq(schema.scans.userId, userId), eq(schema.scans.jdHash, scan.jdHash), lt(schema.scans.createdAt, scan.createdAt)))
    .orderBy(desc(schema.scans.createdAt))
    .limit(1);
  return row ?? null;
}

// changes to a saved scan that mean it has to be scored again
export type ScanChanges = {
  jobTitle?: string | null;
  company?: string | null;
  jobTitleOverride?: string | null;
  educationOverride?: string | null;
  customSkills?: CustomSkill[];
  jdText?: string;
};

// applies changes to a scan and scores it again
export async function updateScan(userId: string, id: string, changes: ScanChanges): Promise<SavedScan | null> {
  const scan = await getScan(userId, id);
  if (!scan) return null;
  const next = { ...scan, ...changes };
  const report = runScan(
    {
      resumeText: scan.resumeTextSnapshot,
      jdText: next.jdText,
      // the title to look for can be set apart from the title shown at the top
      jobTitle: next.jobTitleOverride || next.jobTitle,
      jobUrl: scan.jobUrl,
      educationOverride: next.educationOverride,
      customSkills: next.customSkills,
      layout: scan.layoutMeta,
      today: scan.createdAt,
      // reuse the saved read of this posting, if there is one
      hints: await cachedHints(hashJd(next.jdText)),
    },
    await getDictionary(userId),
  );
  const db = await getDb();
  const [row] = await db
    .update(schema.scans)
    .set({
      jobTitle: next.jobTitle,
      company: next.company,
      jobTitleOverride: next.jobTitleOverride,
      educationOverride: next.educationOverride,
      customSkills: next.customSkills,
      jdText: next.jdText,
      jdHash: hashJd(next.jdText),
      matchRate: report.matchRate,
      categoryScores: report.categoryScores,
      report,
    })
    .where(and(eq(schema.scans.id, id), eq(schema.scans.userId, userId)))
    .returning();
  return row ? toSaved(row) : null;
}

// one line in the scan history table
export type ScanListItem = Pick<ScanRow, "id" | "matchRate" | "jobTitle" | "company" | "jobId" | "resumeId" | "archived" | "createdAt"> & {
  snippet: string;
  jobStatus: (typeof schema.jobs.$inferSelect)["status"] | null;
};

export type ScanListOptions = {
  search?: string;
  sort?: "date" | "score" | "company";
  archived?: boolean;
  page?: number;
  pageSize?: number;
};

// a page of scan history, with the total so the table can show "1-10 of N"
export async function listScans(userId: string, options: ScanListOptions = {}): Promise<{ items: ScanListItem[]; total: number }> {
  const { search, sort = "date", archived = false, page = 1, pageSize = 10 } = options;
  const db = await getDb();
  const term = search?.trim() ? `%${search.trim().replace(/[%_]/g, "")}%` : null;
  const where = and(
    eq(schema.scans.userId, userId),
    eq(schema.scans.archived, archived),
    term ? or(ilike(schema.scans.jobTitle, term), ilike(schema.scans.company, term), ilike(schema.scans.jdText, term)) : undefined,
  );
  const order = sort === "score" ? desc(schema.scans.matchRate) : sort === "company" ? asc(schema.scans.company) : desc(schema.scans.createdAt);

  const rows = await db
    .select({
      id: schema.scans.id,
      matchRate: schema.scans.matchRate,
      jobTitle: schema.scans.jobTitle,
      company: schema.scans.company,
      jobId: schema.scans.jobId,
      resumeId: schema.scans.resumeId,
      archived: schema.scans.archived,
      createdAt: schema.scans.createdAt,
      jdText: schema.scans.jdText,
      jobStatus: schema.jobs.status,
    })
    .from(schema.scans)
    // the job has to be this person's too, belt and braces
    .leftJoin(schema.jobs, and(eq(schema.scans.jobId, schema.jobs.id), eq(schema.jobs.userId, userId)))
    .where(where)
    .orderBy(order, desc(schema.scans.createdAt))
    .limit(pageSize)
    .offset((Math.max(1, page) - 1) * pageSize);
  const [totals] = await db.select({ total: count() }).from(schema.scans).where(where);

  return {
    items: rows.map(({ jdText, ...row }) => ({ ...row, snippet: jdText.replace(/\s+/g, " ").slice(0, 140) })),
    total: totals?.total ?? 0,
  };
}

// the newest scan, for the dashboard card
export async function latestScan(userId: string): Promise<SavedScan | null> {
  const db = await getDb();
  const [row] = await db
    .select()
    .from(schema.scans)
    .where(and(eq(schema.scans.userId, userId), eq(schema.scans.archived, false)))
    .orderBy(desc(schema.scans.createdAt))
    .limit(1);
  return row ? toSaved(row) : null;
}

// archives or restores scans
export async function setScansArchived(userId: string, ids: string[], archived: boolean): Promise<void> {
  if (ids.length === 0) return;
  const db = await getDb();
  await db.update(schema.scans).set({ archived }).where(and(eq(schema.scans.userId, userId), inArray(schema.scans.id, ids)));
}

// deletes scans for good
export async function deleteScans(userId: string, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const db = await getDb();
  await db.delete(schema.scans).where(and(eq(schema.scans.userId, userId), inArray(schema.scans.id, ids)));
}
