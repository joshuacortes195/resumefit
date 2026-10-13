import { and, eq } from "drizzle-orm";
import { parseResume } from "@resumefit/scoring";
import type { ResumeSource } from "@resumefit/shared";
import { getDb, schema } from "@/db";
import { builderFromParsed, builderLayoutMeta, builderToText } from "@/lib/builder/layout";
import { builderDataSchema, defaultSettings, emptyBuilder, templateSettingsSchema, type BuilderData, type TemplateSettings } from "@/lib/builder/types";
import { getResume, type ResumeRow } from "@/lib/data/resumes";
import { safeErrorText } from "@/lib/log";
import { deleteFile } from "@/lib/storage";

// what the builder page needs to open a resume
export type BuilderResume = { id: string; name: string; data: BuilderData; settings: TemplateSettings };

// the builder's view of a resume. one that was uploaded gets its answers filled in from the text we read
export function toBuilderResume(row: ResumeRow): BuilderResume {
  const saved = builderDataSchema.safeParse(row.builderData);
  const settings = templateSettingsSchema.safeParse(row.templateSettings ?? {});
  return {
    id: row.id,
    name: row.name,
    data: row.builderData && saved.success ? saved.data : row.rawText ? builderFromParsed(parseResume(row.rawText)) : emptyBuilder(),
    settings: settings.success ? settings.data : defaultSettings(),
  };
}

// starts a new resume in the builder, empty or filled from text we already read
export async function createBuilderResume(userId: string, input: { data?: BuilderData; source?: ResumeSource; name?: string } = {}): Promise<string> {
  const db = await getDb();
  const data = input.data ?? emptyBuilder();
  const settings = defaultSettings();
  const text = builderToText(data, settings.template);
  const hasAny = (await db.select({ id: schema.resumes.id }).from(schema.resumes).where(eq(schema.resumes.userId, userId)).limit(1)).length > 0;
  const [row] = await db
    .insert(schema.resumes)
    .values({
      userId,
      name: input.name ?? (data.profile.name ? `${data.profile.name} resume` : "Untitled resume"),
      isBase: !hasAny,
      source: input.source ?? "builder",
      rawText: text,
      parsed: parseResume(text),
      layoutMeta: builderLayoutMeta(data, settings),
      builderData: data,
      templateSettings: settings,
    })
    .returning({ id: schema.resumes.id });
  if (!row) throw new Error("Could not start the resume.");
  return row.id;
}

// saves the builder's answers, and refreshes the text and layout facts scans read
export async function saveBuilderResume(userId: string, id: string, data: BuilderData, settings: TemplateSettings): Promise<boolean> {
  const existing = await getResume(userId, id);
  if (!existing) return false;
  const text = builderToText(data, settings.template);
  // a resume that still has its placeholder name takes the person's name once we know it
  const name = /^Untitled resume$/.test(existing.name) && data.profile.name.trim() ? `${data.profile.name.trim()} resume` : existing.name;
  const db = await getDb();
  await db
    .update(schema.resumes)
    .set({ name, rawText: text, parsed: parseResume(text), layoutMeta: builderLayoutMeta(data, settings), builderData: data, templateSettings: settings, filePath: null, fileType: null })
    .where(and(eq(schema.resumes.id, id), eq(schema.resumes.userId, userId)));
  // the uploaded original no longer matches what is in the builder
  // the save itself worked, so a file that would not go is only noted. it is cleared with the rest if the account is ever deleted
  if (existing.filePath) await deleteFile(existing.filePath).catch((error) => console.error(safeErrorText(error, "could not remove a replaced resume file")));
  return true;
}
