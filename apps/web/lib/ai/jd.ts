import { eq } from "drizzle-orm";
import type { JdHints } from "@resumefit/scoring";
import { getDb, schema } from "@/db";
import { JD_EXTRACTION_SYSTEM, jdExtractionPrompt, jdExtractionSchema } from "@/lib/ai/prompts/jd-extraction";
import { generateJSON, readyProviders, type GenerateOptions } from "@/lib/ai/router";
import { cachedHints, hashJd, toHints } from "@/lib/data/scans";

// a smarter read of a job description, saved by its hash so the same posting is only ever read once by anyone
export async function jdHints(userId: string, jdText: string, options: Partial<GenerateOptions> = {}): Promise<JdHints | null> {
  const jdHash = hashJd(jdText);
  const saved = await cachedHints(jdHash);
  if (saved) return saved;

  try {
    const providers = options.providers ?? (await readyProviders(userId));
    if (providers.length === 0) return null;
    // job descriptions are public text, so nothing needs to be hidden before sending
    const extraction = await generateJSON("jd-extraction", { system: JD_EXTRACTION_SYSTEM, prompt: jdExtractionPrompt(jdText) }, jdExtractionSchema, {
      userId,
      fast: true,
      timeoutMs: 8000,
      ...options,
      providers,
    });
    const db = await getDb();
    await db
      .insert(schema.jdAnalysisCache)
      .values({ jdHash, aiExtraction: extraction, provider: providers[0]?.name ?? "unknown", model: providers[0]?.fastModel ?? "unknown" })
      .onConflictDoNothing({ target: schema.jdAnalysisCache.jdHash });
    return toHints(extraction);
  } catch {
    // the scan works fine without this, so any failure just means no hints
    return null;
  }
}

// true when a read of this posting is already saved
export async function hasJdHints(jdText: string): Promise<boolean> {
  const db = await getDb();
  const rows = await db.select({ jdHash: schema.jdAnalysisCache.jdHash }).from(schema.jdAnalysisCache).where(eq(schema.jdAnalysisCache.jdHash, hashJd(jdText))).limit(1);
  return rows.length > 0;
}
