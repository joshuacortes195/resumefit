// lists scans and tracker cards whose link to each other looks wrong. it only reads, nothing is ever changed.
// local database:   pnpm --filter web check:links
// hosted database:  DATABASE_URL="postgres://..." pnpm --filter web check:links

import { eq } from "drizzle-orm";
import { getDb, isLocalDb, schema } from "@/db";
import { samePosting } from "@/lib/data/jobs";

type Problem = { kind: string; user: string; scan: string; score: number | string; scanJob: string; card: string; fix: string };

// "Title at Company" for the printout
const named = (title: string | null, company: string | null) => `${title ?? "(no title)"} at ${company ?? "(no company)"}`;

async function main() {
  const db = await getDb();
  console.log(`Checking the ${isLocalDb() ? "local" : "hosted"} database. Nothing will be changed.\n`);

  const users = await db.select({ id: schema.users.id, email: schema.users.email }).from(schema.users);
  const problems: Problem[] = [];

  for (const user of users) {
    const cards = await db.select({ id: schema.jobs.id, title: schema.jobs.title, company: schema.jobs.company, url: schema.jobs.url, archived: schema.jobs.archived }).from(schema.jobs).where(eq(schema.jobs.userId, user.id));
    const scans = await db
      .select({ id: schema.scans.id, jobId: schema.scans.jobId, title: schema.scans.jobTitle, company: schema.scans.company, url: schema.scans.jobUrl, matchRate: schema.scans.matchRate, jdHash: schema.scans.jdHash })
      .from(schema.scans)
      .where(eq(schema.scans.userId, user.id));
    const cardById = new Map(cards.map((card) => [card.id, card]));
    const add = (problem: Omit<Problem, "user">) => problems.push({ user: user.email, ...problem });

    for (const scan of scans) {
      const posting = { title: scan.title, company: scan.company, url: scan.url };
      const linked = scan.jobId ? cardById.get(scan.jobId) : undefined;
      // the card this scan should sit on, going by the same rule the app uses
      const right = cards.find((card) => !card.archived && samePosting(card, posting)) ?? cards.find((card) => samePosting(card, posting));

      if (scan.jobId && !linked) {
        // the database stops this from happening, so it would mean a card owned by someone else
        add({ kind: "linked to a card that is not theirs", scan: scan.id, score: scan.matchRate, scanJob: named(scan.title, scan.company), card: scan.jobId, fix: "set job_id to null" });
      } else if (linked && !samePosting(linked, posting)) {
        // the card shows this scan's score even though it is another job
        add({
          kind: "on the wrong card",
          scan: scan.id,
          score: scan.matchRate,
          scanJob: named(scan.title, scan.company),
          card: `${named(linked.title, linked.company)} [${linked.id}]`,
          fix: right ? `move to ${named(right.title, right.company)} [${right.id}]` : "set job_id to null (shows as not tracked)",
        });
      } else if (!linked && right) {
        // the job is on the board but the scan says "not tracked"
        add({ kind: "not linked, but its job is on the board", scan: scan.id, score: scan.matchRate, scanJob: named(scan.title, scan.company), card: `${named(right.title, right.company)} [${right.id}]`, fix: `set job_id to ${right.id}` });
      } else if (linked?.archived) {
        add({ kind: "card is archived", scan: scan.id, score: scan.matchRate, scanJob: named(scan.title, scan.company), card: `${named(linked.title, linked.company)} [${linked.id}]`, fix: "none needed, shown as Tracked (archived)" });
      }
    }

    // a card holding scans of more than one posting, a sign the scans got mixed up
    for (const card of cards) {
      const mine = scans.filter((scan) => scan.jobId === card.id);
      const postings = new Set(mine.map((scan) => scan.jdHash));
      if (postings.size > 1) add({ kind: "card has scans of different postings", scan: mine.map((scan) => scan.id.slice(0, 8)).join(", "), score: mine.map((scan) => scan.matchRate).join(", "), scanJob: [...new Set(mine.map((scan) => named(scan.title, scan.company)))].join(" / "), card: `${named(card.title, card.company)} [${card.id}]`, fix: "check the rows above for this card" });
    }
  }

  if (problems.length === 0) {
    console.log("Every scan sits on the right card. Nothing to fix.");
  } else {
    for (const problem of problems) {
      console.log(`${problem.kind.toUpperCase()}  (${problem.user})`);
      console.log(`  scan:  ${problem.scan}  score ${problem.score}`);
      console.log(`  job:   ${problem.scanJob}`);
      console.log(`  card:  ${problem.card}`);
      console.log(`  fix:   ${problem.fix}\n`);
    }
    const counts = new Map<string, number>();
    for (const problem of problems) counts.set(problem.kind, (counts.get(problem.kind) ?? 0) + 1);
    console.log("Totals");
    for (const [kind, total] of counts) console.log(`  ${total}  ${kind}`);
  }
  process.exit(0);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
