// finds stored data that older versions of the app got wrong, and fixes it when told to.
// without --apply it only reads and prints what it would change.
//
//   local database, look only:    pnpm --filter web repair
//   hosted database, look only:   DATABASE_URL="postgres://..." pnpm --filter web repair
//   make the changes:             DATABASE_URL="postgres://..." pnpm --filter web repair --apply
//   one part only:                ... repair --only=links        (links, text, tailored, resumes, scans, health)
//   look closely at one scan:     ... repair --explain=8c0d7750  (the start of its id is enough)

import { and, eq, like } from "drizzle-orm";
import { analyzeJd, findYearsRequired, parseResume, stripIgnoredSections, unflatten, type ParsedResume } from "@resumefit/scoring";
import { getDb, isLocalDb, schema } from "@/db";
import { mendBuilder } from "@/lib/builder/mend";
import { builderDataSchema, type BuilderData } from "@/lib/builder/types";
import { samePosting, tidyCompany } from "@/lib/data/jobs";
import { cachedHints, ensureCard, getDictionary, getScan, hashJd, runScan, type CustomSkill, type SavedScan } from "@/lib/data/scans";
import type { LayoutMeta, ScanResult } from "@resumefit/scoring";

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const ONLY = args.find((arg) => arg.startsWith("--only="))?.slice(7).split(",") ?? null;
const EXPLAIN = args.find((arg) => arg.startsWith("--explain="))?.slice(10) ?? null;
const wants = (part: string) => !EXPLAIN && (ONLY === null || ONLY.includes(part));

// "Title at Company" for the printout
const named = (title: string | null | undefined, company: string | null | undefined) => `${title ?? "(no title)"} at ${company ?? "(no company)"}`;
const short = (id: string | null | undefined) => (id ? id.slice(0, 8) : "none");
let changes = 0;
const say = (line = "") => console.log(line);
const heading = (title: string) => say(`\n=== ${title} ===`);

// a company name without the number some career sites put in front of it, only used to compare a scan with a card
const bare = (company: string | null | undefined) => company?.trim().replace(/^\d{1,5}\s+(?=[A-Za-z])/, "") ?? null;
// the same job, going by the rule the app uses, but forgiving of that number
const same = (card: { title: string | null; company: string | null; url: string | null }, posting: { title: string | null; company: string | null; url: string | null }) =>
  samePosting({ ...card, company: bare(card.company) }, { ...posting, company: bare(posting.company) });

type Db = Awaited<ReturnType<typeof getDb>>;
type Card = { id: string; title: string; company: string | null; url: string | null; archived: boolean; description: string | null };
type ScanRow = { id: string; jobId: string | null; title: string | null; company: string | null; url: string | null; matchRate: number; jdHash: string; createdAt: Date; archived: boolean };

async function cardsOf(db: Db, userId: string): Promise<Card[]> {
  return db.select({ id: schema.jobs.id, title: schema.jobs.title, company: schema.jobs.company, url: schema.jobs.url, archived: schema.jobs.archived, description: schema.jobs.description }).from(schema.jobs).where(eq(schema.jobs.userId, userId));
}

async function scansOf(db: Db, userId: string): Promise<ScanRow[]> {
  return db
    .select({ id: schema.scans.id, jobId: schema.scans.jobId, title: schema.scans.jobTitle, company: schema.scans.company, url: schema.scans.jobUrl, matchRate: schema.scans.matchRate, jdHash: schema.scans.jdHash, createdAt: schema.scans.createdAt, archived: schema.scans.archived })
    .from(schema.scans)
    .where(eq(schema.scans.userId, userId));
}

// the card a scan should sit on, null when its job is not on the tracker
const rightCard = (cards: Card[], scan: ScanRow) => cards.find((card) => !card.archived && same(card, scan)) ?? cards.find((card) => same(card, scan)) ?? null;
// the newest of some scans, which is the one a card shows
const newest = (scans: ScanRow[]) => [...scans].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0] ?? null;

// 1. tracker jobs showing another job's scan
async function links(db: Db, userId: string) {
  const cards = await cardsOf(db, userId);
  const scans = await scansOf(db, userId);
  const moves: { scan: ScanRow; to: string | null }[] = [];
  for (const scan of scans) {
    const linked = cards.find((card) => card.id === scan.jobId) ?? null;
    const right = rightCard(cards, scan);
    if (linked && same(linked, scan)) continue;
    if ((linked?.id ?? null) === (right?.id ?? null)) continue;
    moves.push({ scan, to: right?.id ?? null });
  }

  // what each card shows now, and what it will show
  const target = new Map(moves.map((move) => [move.scan.id, move.to]));
  const after = scans.map((scan) => (target.has(scan.id) ? { ...scan, jobId: target.get(scan.id) ?? null } : scan));
  for (const card of cards) {
    const now = newest(scans.filter((scan) => scan.jobId === card.id));
    const then = newest(after.filter((scan) => scan.jobId === card.id));
    if ((now?.id ?? null) === (then?.id ?? null)) continue;
    say(`TRACKER JOB ${short(card.id)}  ${named(card.title, card.company)}${card.archived ? "  (archived)" : ""}`);
    say(`  shows now:    ${now ? `scan ${short(now.id)}  score ${now.matchRate}  ${named(now.title, now.company)}` : "no scan"}`);
    say(`  should show:  ${then ? `scan ${short(then.id)}  score ${then.matchRate}  ${named(then.title, then.company)}` : "Not scanned yet"}`);
  }
  if (moves.length > 0) say("\nScans to move:");
  for (const { scan, to } of moves) {
    const from = cards.find((card) => card.id === scan.jobId);
    const goal = cards.find((card) => card.id === to);
    say(`  scan ${short(scan.id)}  score ${scan.matchRate}  ${named(scan.title, scan.company)}`);
    say(`    from: ${from ? `${named(from.title, from.company)} [${short(from.id)}]` : "not tracked"}`);
    say(`    to:   ${goal ? `${named(goal.title, goal.company)} [${short(goal.id)}]` : "not tracked (its own job is not on the board)"}`);
    changes += 1;
    if (APPLY) await db.update(schema.scans).set({ jobId: to }).where(and(eq(schema.scans.id, scan.id), eq(schema.scans.userId, userId)));
  }
  if (moves.length === 0) say("Every scan sits on its own job's card.");
}

// 4. company names with a career site's number in front, and job descriptions that start in the middle of a word
async function text(db: Db, userId: string) {
  const cards = await cardsOf(db, userId);
  const scans = await db.select({ id: schema.scans.id, company: schema.scans.company, title: schema.scans.jobTitle, url: schema.scans.jobUrl, jdText: schema.scans.jdText, jobId: schema.scans.jobId }).from(schema.scans).where(eq(schema.scans.userId, userId));
  let found = 0;

  // a number in front of the company. on a workday link it is the employer's internal entity number and comes off.
  // with no link to go on, it only comes off when the same name without the number is already on one of the person's own cards or scans
  const known = new Set([...cards.map((card) => card.company), ...scans.map((scan) => scan.company)].filter((name): name is string => Boolean(name) && !/^\d{1,5}\s/.test(name ?? "")).map((name) => name.toLowerCase()));
  const fixed = (company: string | null, url: string | null): string | null => {
    if (!company || !/^\d{1,5}\s+[A-Za-z]/.test(company)) return null;
    const viaLink = tidyCompany(company, url);
    if (viaLink && viaLink !== company) return viaLink;
    const stripped = bare(company);
    return stripped && known.has(stripped.toLowerCase()) ? stripped : null;
  };
  for (const scan of scans) {
    if (!scan.company || !/^\d{1,5}\s+[A-Za-z]/.test(scan.company)) continue;
    found += 1;
    const next = fixed(scan.company, scan.url);
    say(`COMPANY on scan ${short(scan.id)}: "${scan.company}"  link: ${scan.url ?? "none"}`);
    say(next ? `  change to "${next}"` : `  left alone: not a workday link and "${bare(scan.company)}" is not a name you have elsewhere. It may be the company's real name.`);
    if (next) {
      changes += 1;
      if (APPLY) await db.update(schema.scans).set({ company: next }).where(and(eq(schema.scans.id, scan.id), eq(schema.scans.userId, userId)));
    }
  }
  for (const card of cards) {
    if (!card.company || !/^\d{1,5}\s+[A-Za-z]/.test(card.company)) continue;
    found += 1;
    const next = fixed(card.company, card.url);
    say(`COMPANY on tracker job ${short(card.id)}: "${card.company}"  link: ${card.url ?? "none"}`);
    say(next ? `  change to "${next}"` : "  left alone, for the same reason as above");
    if (next) {
      changes += 1;
      if (APPLY) await db.update(schema.jobs).set({ company: next }).where(and(eq(schema.jobs.id, card.id), eq(schema.jobs.userId, userId)));
    }
  }

  // a description that starts with a small letter was cut somewhere before it reached us
  for (const scan of scans) {
    const start = scan.jdText.trimStart();
    if (!/^[a-z]/.test(start)) continue;
    found += 1;
    say(`JOB DESCRIPTION of scan ${short(scan.id)} (${named(scan.title, scan.company)}) starts mid word: "${start.slice(0, 60).replace(/\s+/g, " ")}..."`);
    // the only honest fix is a full copy of the same text. the card's own description is the one place that might have it
    const probe = start.slice(0, 80);
    const source = cards.map((card) => card.description ?? "").find((description) => description.indexOf(probe) > 0 && /\S/.test(description.charAt(description.indexOf(probe) - 1)));
    if (!source) {
      say("  cannot be restored: no complete copy of this text is stored. The missing letters were never saved, so the fix is to scan the posting again.");
      continue;
    }
    const at = source.indexOf(probe);
    // back up to the start of the word that was cut
    let from = at;
    while (from > 0 && /\S/.test(source.charAt(from - 1))) from -= 1;
    const restored = source.slice(from, at) + start;
    say(`  restore from its tracker card: "${restored.slice(0, 60).replace(/\s+/g, " ")}..."`);
    changes += 1;
    if (APPLY) await db.update(schema.scans).set({ jdText: restored, jdHash: hashJd(restored) }).where(and(eq(schema.scans.id, scan.id), eq(schema.scans.userId, userId)));
  }
  if (found === 0) say("No company names with a number in front, and no job descriptions that start mid word.");
}

// 5. resumes written for a job that are not linked to it
async function tailored(db: Db, userId: string) {
  const cards = await cardsOf(db, userId);
  const resumes = await db.select({ id: schema.resumes.id, name: schema.resumes.name, rawText: schema.resumes.rawText, linkedJobId: schema.resumes.linkedJobId }).from(schema.resumes).where(and(eq(schema.resumes.userId, userId), eq(schema.resumes.source, "optimized")));
  const rounds = await db.select({ scanId: schema.optimizations.scanId, finalText: schema.optimizations.finalText }).from(schema.optimizations).where(eq(schema.optimizations.userId, userId));
  const scans = await scansOf(db, userId);
  let found = 0;
  for (const resume of resumes) {
    if (resume.linkedJobId && cards.some((card) => card.id === resume.linkedJobId)) continue;
    found += 1;
    // the scan it was written from: the optimizer saved the same text, or failing that the resume is still named after the job
    const byText = rounds.find((round) => round.finalText && round.finalText.trim() === (resume.rawText ?? "").trim())?.scanId ?? null;
    const byName = scans.filter((scan) => `Resume for ${[scan.company, scan.title].filter(Boolean).join(", ") || "this job"}`.slice(0, 120) === resume.name);
    const scanId = byText ?? newest(byName)?.id ?? null;
    say(`TAILORED RESUME ${short(resume.id)}  "${resume.name}"  linked to: ${resume.linkedJobId ? "a job that no longer exists" : "nothing"}`);
    const row = scans.find((scan) => scan.id === scanId);
    if (!row) {
      say("  left alone: could not tell which scan it was written from");
      continue;
    }
    const card = cards.find((entry) => entry.id === row.jobId && same(entry, row)) ?? rightCard(cards, row);
    say(`  written from scan ${short(row.id)}  ${named(row.title, row.company)}  (${byText ? "same text as the optimizer saved" : "matched by its name"})`);
    say(card ? `  link to tracker job ${short(card.id)}  ${named(card.title, card.company)}` : "  its job is not on the tracker yet: add the job to the tracker and link the resume to it");
    changes += 1;
    if (APPLY) {
      const scan = await getScan(userId, row.id);
      if (!scan) continue;
      const jobId = card?.id ?? (await ensureCard(userId, { ...scan, jobId: null }));
      if (card && scan.jobId !== card.id) await db.update(schema.scans).set({ jobId: card.id }).where(and(eq(schema.scans.userId, userId), eq(schema.scans.jdHash, scan.jdHash)));
      await db.update(schema.resumes).set({ linkedJobId: jobId }).where(and(eq(schema.resumes.id, resume.id), eq(schema.resumes.userId, userId)));
    }
  }
  if (found === 0) say("Every tailored resume is linked to its job.");
}

// the jobs and schooling of a parsed resume, one line each, for comparing two reads
const jobsOf = (parsed: ParsedResume | null) => (parsed?.experience ?? []).map((job) => `${job.title ?? "?"} | ${job.company ?? "?"} | ${job.location ?? "?"} | ${job.dates ? "dated" : "no dates"}`);
const schoolOf = (parsed: ParsedResume | null) => (parsed?.education ?? []).map((school) => `${school.level ?? "?"} in ${school.field ?? "?"}${school.specialization ? ` (${school.specialization})` : ""} | ${school.school ?? "?"}`);
function showChange(label: string, before: string[], after: string[]): boolean {
  if (JSON.stringify(before) === JSON.stringify(after)) return false;
  say(`  ${label} before:`);
  for (const line of before) say(`    - ${line}`);
  say(`  ${label} after:`);
  for (const line of after) say(`    + ${line}`);
  return true;
}

// 3. resumes read by the old parser
async function resumes(db: Db, userId: string) {
  const rows = await db.select().from(schema.resumes).where(eq(schema.resumes.userId, userId));
  let found = 0;
  for (const row of rows) {
    if (!row.rawText) continue;
    const before = row.parsed as ParsedResume | null;
    const after = parseResume(row.rawText);
    const fromBuilder = row.builderData !== null;
    let changed = false;
    const title = `RESUME ${short(row.id)}  "${row.name}"${fromBuilder ? "  (builder)" : ""}`;
    const printTitle = () => {
      if (!changed) say(title);
      changed = true;
    };
    if (JSON.stringify(jobsOf(before)) !== JSON.stringify(jobsOf(after)) || JSON.stringify(schoolOf(before)) !== JSON.stringify(schoolOf(after))) {
      printTitle();
      showChange("jobs", jobsOf(before), jobsOf(after));
      showChange("education", schoolOf(before), schoolOf(after));
      if (APPLY) await db.update(schema.resumes).set({ parsed: after, updatedAt: row.updatedAt }).where(eq(schema.resumes.id, row.id));
    }
    // a builder resume keeps the answers it was filled in with, so a wrong read at import time is still in there
    const saved = fromBuilder ? builderDataSchema.safeParse(row.builderData) : null;
    if (saved?.success) {
      const mended = mendBuilder(saved.data);
      const line = (data: BuilderData) => data.experience.map((job) => `${job.title || "?"} | ${job.company || "?"} | ${job.location || "?"} | ${job.start || "?"} to ${job.current ? "now" : job.end || "?"}`);
      const jobsChanged = JSON.stringify(line(saved.data)) !== JSON.stringify(line(mended));
      const skillsChanged = JSON.stringify(saved.data.skills) !== JSON.stringify(mended.skills);
      if (jobsChanged || skillsChanged) {
        printTitle();
        if (jobsChanged) showChange("builder jobs", line(saved.data), line(mended));
        if (skillsChanged) showChange("builder skills", [saved.data.skills.join(" · ")], [mended.skills.join(" · ")]);
        if (APPLY) {
          const { saveBuilderResume } = await import("@/lib/data/builder");
          const { templateSettingsSchema, defaultSettings } = await import("@/lib/builder/types");
          const settings = templateSettingsSchema.safeParse(row.templateSettings);
          await saveBuilderResume(userId, row.id, mended, settings.success ? settings.data : defaultSettings());
        }
      }
      // the degree cannot be worked out again from what the builder kept, so it is only pointed out
      for (const school of saved.data.education) {
        if (/machine learning|artificial intelligence|specialization|concentration/i.test(school.field) && !/,/.test(school.field)) {
          printTitle();
          say(`  education to check by hand: "${[school.degree, school.field].filter(Boolean).join(" in ")}". The builder only kept this, so the major has to be typed in again (Education step).`);
        }
      }
    }
    if (changed) {
      found += 1;
      changes += 1;
    }
  }
  if (found === 0) say("Every stored resume already reads the way the current parser reads it.");
}

// 2, 3 and 9. saved reports made by older scoring: scored again from the resume and posting each one kept
async function scans(db: Db, userId: string) {
  const rows = await db.select().from(schema.scans).where(eq(schema.scans.userId, userId));
  const dictionary = await getDictionary(userId);
  let found = 0;
  for (const row of rows) {
    const old = row.report as ScanResult;
    const next = runScan(
      {
        resumeText: row.resumeTextSnapshot,
        jdText: row.jdText,
        jobTitle: row.jobTitleOverride || row.jobTitle,
        jobUrl: row.jobUrl,
        educationOverride: row.educationOverride,
        customSkills: (row.customSkills as CustomSkill[]) ?? [],
        layout: (row.layoutMeta as LayoutMeta | null) ?? null,
        today: row.createdAt,
        hints: await cachedHints(row.jdHash),
      },
      dictionary,
    );
    const facts = (report: ScanResult) => ({
      score: report.matchRate,
      jobs: report.resume.experience.length,
      undated: report.resume.experience.filter((job) => !job.dates).length,
      hard: report.hardSkills.length,
      soft: report.softSkills.length,
      years: report.jd.yearsRequired,
    });
    const [was, now] = [facts(old), facts(next)];
    if (JSON.stringify(was) === JSON.stringify(now) && row.matchRate === next.matchRate) continue;
    found += 1;
    changes += 1;
    say(`SCAN ${short(row.id)}  ${named(row.jobTitle, row.company)}`);
    say(`  score ${row.matchRate} -> ${next.matchRate}${next.cap ? `  (held at ${next.cap.limit}: ${next.cap.reason === "noHardSkills" ? "no hard skills could be read" : `asks for about ${next.cap.wanted} years, resume shows ${next.cap.have}`})` : ""}`);
    if (was.jobs !== now.jobs || was.undated !== now.undated) say(`  jobs on the resume ${was.jobs} -> ${now.jobs}, without dates ${was.undated} -> ${now.undated}`);
    if (was.hard !== now.hard || was.soft !== now.soft) say(`  skills read from the posting: hard ${was.hard} -> ${now.hard}, soft ${was.soft} -> ${now.soft}`);
    if (was.years !== now.years) say(`  years asked for ${was.years ?? "none"} -> ${now.years ?? "none"}`);
    if (APPLY) await db.update(schema.scans).set({ matchRate: next.matchRate, categoryScores: next.categoryScores, report: next }).where(and(eq(schema.scans.id, row.id), eq(schema.scans.userId, userId)));
  }
  if (found === 0) say("Every saved report already matches what the current scoring gives.");
}

// 7. what the providers last said, word for word
async function health(db: Db) {
  const [row] = await db.select({ value: schema.appSettings.value, updatedAt: schema.appSettings.updatedAt }).from(schema.appSettings).where(eq(schema.appSettings.key, "ai-health"));
  const saved = (row?.value ?? {}) as Record<string, { lastOk: string | null; lastError: string | null; lastErrorAt: string | null; rateLimitHits: number }>;
  if (Object.keys(saved).length === 0) say("No provider has reported a problem.");
  for (const [name, entry] of Object.entries(saved)) say(`${name}: last ok ${entry.lastOk ?? "never"}, last error at ${entry.lastErrorAt ?? "never"}: ${entry.lastError ?? "none"}`);
  const feeds = await db.select({ key: schema.appSettings.key }).from(schema.appSettings).where(like(schema.appSettings.key, "feed:%"));
  say(`job feed: ${feeds.length} company boards saved`);
}

// a close look at one scan: what the posting looks like and what the engine reads from it
async function explain(db: Db, prefix: string) {
  const rows = await db.select().from(schema.scans);
  const row = rows.find((scan) => scan.id.startsWith(prefix));
  if (!row) return say(`No scan starts with ${prefix}.`);
  const jd = row.jdText;
  const lines = jd.split(/\r?\n/);
  const old = row.report as ScanResult;
  heading(`Scan ${row.id}`);
  say(`title: ${row.jobTitle}\ncompany: ${row.company}\nlink: ${row.jobUrl ?? "none"}\nlinked to tracker job: ${row.jobId ?? "none"}\nscanned: ${row.createdAt.toISOString()}`);
  say(`job description: ${jd.length} characters, ${lines.length} lines, longest line ${Math.max(...lines.map((line) => line.length))} characters`);
  say(`starts: "${jd.slice(0, 200).replace(/\s+/g, " ")}"`);
  say(`after dropping benefits and legal text the old way, nothing was left of a line with legal wording. Now: ${stripIgnoredSections(jd).length} characters are kept.`);
  say(`after giving it its lines back: ${unflatten(jd).split("\n").length} lines`);
  say(`stored report: score ${row.matchRate}, hard skills ${old.hardSkills.length}, soft skills ${old.softSkills.length}, years asked ${old.jd.yearsRequired ?? "none"}, jobs on resume ${old.resume.experience.length}`);
  const fresh = analyzeJd(jd, row.jobUrl ?? undefined);
  say(`read now: title "${fresh.jobTitle}", company "${fresh.company}", years asked ${fresh.yearsRequired ?? "none"}`);
  // every sentence that carries a number of years, so a misread can be seen
  for (const sentence of unflatten(jd).split(/(?<=[.!?])\s+|\n/)) {
    if (/\b(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten)\s*(\+|plus|or more)?\s*(-|–|to)?\s*\d{0,2}\+?\s*(years?|yrs?)\b/i.test(sentence)) say(`  years sentence (reads as ${findYearsRequired(sentence) ?? "not an ask"}): "${sentence.trim().slice(0, 220)}"`);
  }
  const saved = (await getScan(row.userId, row.id)) as SavedScan;
  const next = runScan({ resumeText: saved.resumeTextSnapshot, jdText: jd, jobTitle: saved.jobTitleOverride || saved.jobTitle, jobUrl: saved.jobUrl, educationOverride: saved.educationOverride, customSkills: saved.customSkills, layout: saved.layoutMeta, today: saved.createdAt, hints: await cachedHints(saved.jdHash) }, await getDictionary(row.userId));
  say(`scored now: ${next.matchRate}${next.cap ? ` (held at ${next.cap.limit}, ${next.cap.reason})` : ""}, hard skills ${next.hardSkills.length} [${next.hardSkills.slice(0, 12).map((skill) => `${skill.name}:${skill.match}`).join(", ")}], soft skills ${next.softSkills.length}, years asked ${next.jd.yearsRequired ?? "none"}, jobs on resume ${next.resume.experience.length}`);
}

async function main() {
  const db = await getDb();
  say(`${isLocalDb() ? "Local" : "Hosted"} database. ${APPLY ? "APPLYING the changes below." : "Dry run: nothing is changed. Add --apply to make these changes."}`);
  if (EXPLAIN) {
    await explain(db, EXPLAIN);
    process.exit(0);
  }
  const users = await db.select({ id: schema.users.id, email: schema.users.email }).from(schema.users);
  for (const user of users) {
    say(`\n########## ${user.email} ##########`);
    // the order matters: links first, so a tailored resume is linked to the right card
    if (wants("links")) {
      heading("1. Tracker jobs and the scan each one shows");
      await links(db, user.id);
    }
    if (wants("text")) {
      heading("4. Company names and job descriptions saved wrong");
      await text(db, user.id);
    }
    if (wants("tailored")) {
      heading("5. Tailored resumes not linked to their job");
      await tailored(db, user.id);
    }
    if (wants("resumes")) {
      heading("3. Resumes read by the old parser");
      await resumes(db, user.id);
    }
    if (wants("scans")) {
      heading("2, 3 and 9. Saved reports scored again");
      await scans(db, user.id);
    }
  }
  if (wants("health")) {
    heading("7. What the AI providers last said");
    await health(db);
  }
  say(`\n${changes} ${changes === 1 ? "thing" : "things"} ${APPLY ? "changed" : "to change"}.${APPLY ? "" : " Nothing was written."}`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exit(1);
});
