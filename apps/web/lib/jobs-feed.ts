import { like } from "drizzle-orm";
import { countSkills, looksLikeTitle, parseResume, type SkillTerm } from "@resumefit/scoring";
import { HARD_SKILLS } from "@resumefit/skills-data";
import { getDb, schema } from "@/db";
import { BOARDS, type Board } from "@/lib/job-boards";

export { BOARDS, type Board } from "@/lib/job-boards";
export { fitLabel } from "@/lib/fit";

// one opening as we keep it: small enough to hold thousands, with the skills it asks for worked out ahead of time
export type FeedJob = {
  // where it came from and its id there, joined, so it can be found again
  id: string;
  title: string;
  company: string;
  // the company's website, for its little logo. empty when we do not know it
  domain: string;
  location: string;
  remote: boolean;
  url: string;
  postedAt: string | null;
  // the hard skills named in the title and description
  skills: string[];
  // true for internships and other roles aimed at students
  intern: boolean;
};

// turns the html job boards send into plain text, keeping paragraphs and bullets. nothing from it is ever shown as html
export function htmlToText(html: string): string {
  const decode = (text: string) =>
    text
      .replace(/&nbsp;/g, " ")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
      .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(parseInt(code, 16)))
      .replace(/&apos;/g, "'")
      .replace(/&amp;/g, "&");
  // greenhouse sends its html with the tags themselves escaped, so decode once before stripping
  const raw = /&lt;\/?[a-z]/i.test(html) ? decode(html) : html;
  const text = raw
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
    .replace(/<li[^>]*>/gi, "\n• ")
    .replace(/<\/(p|div|li|ul|ol|h[1-6]|tr)>|<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "");
  return decode(text)
    .replace(/[ \t]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

type Raw = Record<string, unknown>;
const text = (value: unknown) => (typeof value === "string" ? value : "");

async function getJson(url: string, timeoutMs = 15_000): Promise<unknown> {
  const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), headers: { Accept: "application/json", "User-Agent": "ResumeFit job search" } });
  if (!response.ok) throw new Error(`${url} answered ${response.status}`);
  return response.json();
}

// the most openings we keep from one company, newest first
const PER_BOARD = 300;

// the skills an opening asks for, by the names on our own skill list
function skillsIn(title: string, description: string): string[] {
  return [...countSkills(`${title}\n${description.slice(0, 12_000)}`, HARD_SKILLS).keys()].slice(0, 40);
}

const INTERN = /\b(intern|internship|co-?op|new grad|graduate program|apprentice)\b/i;

// reads one company's board into our own small shape
export async function fetchBoard(board: Board): Promise<FeedJob[]> {
  const key = (id: unknown) => `${board.source}:${board.token}:${String(id)}`;
  const make = (id: unknown, title: string, location: string, remote: boolean, url: string, postedAt: string | null, description: string): FeedJob => ({
    id: key(id),
    title: title.trim().slice(0, 200),
    company: board.company,
    domain: board.domain,
    location: location.slice(0, 120),
    remote,
    url,
    postedAt,
    skills: skillsIn(title, description),
    intern: INTERN.test(title),
  });

  let jobs: FeedJob[];
  if (board.source === "greenhouse") {
    const data = (await getJson(`https://boards-api.greenhouse.io/v1/boards/${board.token}/jobs?content=true`, 25_000)) as { jobs?: Raw[] };
    jobs = (data.jobs ?? []).slice(0, PER_BOARD).map((job) => {
      const location = text((job.location as Raw | undefined)?.name);
      return make(job.id, text(job.title), location, /remote/i.test(location), text(job.absolute_url), text(job.first_published) || text(job.updated_at) || null, htmlToText(text(job.content)));
    });
  } else if (board.source === "lever") {
    const data = (await getJson(`https://api.lever.co/v0/postings/${board.token}?mode=json`, 25_000)) as Raw[];
    jobs = data.slice(0, PER_BOARD).map((job) => {
      const categories = (job.categories as Raw | undefined) ?? {};
      const lists = ((job.lists as Raw[] | undefined) ?? []).map((list) => `${text(list.text)}\n${htmlToText(text(list.content))}`).join("\n");
      const location = text(categories.location);
      return make(job.id, text(job.text), location, text(job.workplaceType) === "remote" || /remote/i.test(location), text(job.hostedUrl), typeof job.createdAt === "number" ? new Date(job.createdAt).toISOString() : null, `${text(job.descriptionPlain)}\n${lists}`);
    });
  } else {
    const data = (await getJson(`https://api.ashbyhq.com/posting-api/job-board/${board.token}`, 25_000)) as { jobs?: Raw[] };
    jobs = (data.jobs ?? [])
      .filter((job) => job.isListed !== false)
      .slice(0, PER_BOARD)
      .map((job) => make(job.id, text(job.title), text(job.location), job.isRemote === true, text(job.jobUrl), text(job.publishedAt) || null, text(job.descriptionPlain)));
  }
  return jobs.filter((job) => job.title && /^https:\/\//.test(job.url));
}

// how long a company's saved openings count as fresh
// lets the browser tests run without reaching out to real job sites
const OFFLINE = () => process.env.JOB_FEED_OFFLINE === "1";

const STALE_AFTER = 20 * 60 * 60 * 1000;
const feedKey = (board: Board) => `feed:${board.source}:${board.token}`;

// fetches the companies whose saved openings are oldest or missing, until the time allowed runs out.
// called once a day by a scheduled visit, and in the background when someone searches, so the pool fills up and stays current
export async function refreshFeed(budgetMs: number, boards: Board[] = BOARDS): Promise<{ refreshed: number; waiting: number }> {
  if (OFFLINE()) return { refreshed: 0, waiting: 0 };
  const started = Date.now();
  const db = await getDb();
  const saved = await db.select({ key: schema.appSettings.key, updatedAt: schema.appSettings.updatedAt }).from(schema.appSettings).where(like(schema.appSettings.key, "feed:%"));
  const age = new Map(saved.map((row) => [row.key, row.updatedAt.getTime()]));
  const due = boards.filter((board) => started - (age.get(feedKey(board)) ?? 0) > STALE_AFTER).sort((a, b) => (age.get(feedKey(a)) ?? 0) - (age.get(feedKey(b)) ?? 0));

  let refreshed = 0;
  // a few at a time, so one slow company does not hold up the rest
  for (let index = 0; index < due.length && Date.now() - started < budgetMs; index += 4) {
    await Promise.all(
      due.slice(index, index + 4).map(async (board) => {
        let jobs: FeedJob[] = [];
        try {
          jobs = await fetchBoard(board);
        } catch {
          // a board that is down keeps what it had, and is tried again next time
          if (age.has(feedKey(board))) return;
        }
        const value = { jobs };
        await db.insert(schema.appSettings).values({ key: feedKey(board), value }).onConflictDoUpdate({ target: schema.appSettings.key, set: { value, updatedAt: new Date() } });
        refreshed += 1;
      }),
    );
  }
  memory.feed = null;
  return { refreshed, waiting: Math.max(0, due.length - refreshed) };
}

// what we hold in memory between requests, so the database is not read on every search
const globalForFeed = globalThis as unknown as { jobFeed2?: { feed: { at: number; jobs: FeedJob[]; boards: number } | null; muse: Map<string, { at: number; jobs: MuseJob[] }> } };
const memory = (globalForFeed.jobFeed2 ??= { feed: null, muse: new Map() });

// every opening we have saved, across all companies
export async function savedJobs(): Promise<{ jobs: FeedJob[]; boards: number }> {
  if (memory.feed && Date.now() - memory.feed.at < 10 * 60 * 1000) return memory.feed;
  const db = await getDb();
  const rows = await db.select({ value: schema.appSettings.value }).from(schema.appSettings).where(like(schema.appSettings.key, "feed:%"));
  const jobs = rows.flatMap((row) => ((row.value as { jobs?: FeedJob[] }).jobs ?? []));
  memory.feed = { at: Date.now(), jobs, boards: rows.length };
  return memory.feed;
}

// the fields a wider job site sorts its openings into, and the words on a resume that point at each one
const FIELDS: [category: string, signs: RegExp][] = [
  ["Software Engineering", /software|developer|frontend|backend|full.?stack|devops|programmer|web development|mobile development/i],
  ["Data and Analytics", /data (analyst|scientist|engineer)|analytics|machine learning|business intelligence|statistic/i],
  ["Healthcare", /nurs(e|ing)|clinical|patient|medical|pharmac|physician|therapist|healthcare|caregiver|\b(rn|cna|lpn|emt)\b/i],
  ["Transportation and Logistics", /supply chain|logistics|warehouse|procurement|inventory|shipping|freight|dispatch|forklift/i],
  ["Business Operations", /operations|supply chain|procurement|business analyst|administrative|office manager|coordinator/i],
  ["Accounting and Finance", /account(ant|ing)|financ|bookkeep|audit|payroll|tax\b|investment|banking/i],
  ["Science and Engineering", /mechanical|electrical|civil|chemical|aerospace|manufacturing|biomedical|laborator|research (assistant|scientist)|\bcad\b|solidworks/i],
  ["Sales", /\bsales\b|account executive|business development|\bsdr\b|\bbdr\b/i],
  ["Customer Service", /customer (service|support|success)|call center|help desk/i],
  ["Education", /teach(er|ing)|tutor|instructor|curriculum|classroom/i],
  ["Design and UX", /\bux\b|\bui\b|product design|graphic design|figma|user research/i],
  ["Project Management", /project manager|program manager|scrum|\bpmp\b/i],
  ["Retail", /retail|cashier|barista|store associate|merchandis|server\b|restaurant/i],
  ["Legal Services", /paralegal|attorney|legal|litigation|compliance/i],
];

// what a resume tells us about the kind of work its owner is after
export type ResumeProfile = {
  skills: Set<string>;
  // words from the job titles the person has held
  titleWords: Set<string>;
  fields: string[];
  // true for students and people with under a year of work behind them
  earlyCareer: boolean;
};

const TITLE_NOISE = new Set(["senior", "junior", "lead", "staff", "principal", "associate", "assistant", "the", "and", "of", "for", "intern", "internship", "i", "ii", "iii"]);
const titleWordsOf = (title: string) => title.toLowerCase().split(/[^a-z+#]+/).filter((word) => word.length > 2 && !TITLE_NOISE.has(word));

// reads a resume for the skills, job titles and field that decide which openings suit it
export function profileResume(resumeText: string, skills: SkillTerm[] = HARD_SKILLS): ResumeProfile {
  const parsed = parseResume(resumeText);
  const titles = parsed.experience.map((job) => job.title ?? "").filter(looksLikeTitle);
  const fields = FIELDS.filter(([, signs]) => signs.test(`${titles.join(" ")} ${resumeText.slice(0, 6000)}`)).map(([category]) => category);
  return {
    skills: new Set(countSkills(resumeText, skills).keys()),
    titleWords: new Set(titles.flatMap(titleWordsOf)),
    fields: fields.slice(0, 3),
    earlyCareer: (parsed.yearsExperience ?? 0) < 1.5 || /\b(student|expected graduation|class of 20\d\d|gpa)\b/i.test(resumeText),
  };
}

// how well an opening suits a resume, 0 to 100. mostly the share of its skills the resume has, plus how close the job title is to ones already held.
// openings that name fewer than three skills are judged on their title alone, and capped, since that is thin evidence
export function fitScore(job: Pick<FeedJob, "title" | "skills">, profile: ResumeProfile): number {
  const words = titleWordsOf(job.title);
  const titleFit = words.length === 0 || profile.titleWords.size === 0 ? 0 : words.filter((word) => profile.titleWords.has(word)).length / words.length;
  if (job.skills.length < 3) return Math.round(titleFit * 55);
  const skillFit = job.skills.filter((skill) => profile.skills.has(skill)).length / job.skills.length;
  return Math.round(100 * (0.75 * skillFit + 0.25 * titleFit));
}

// an opening from the wider job site, with its description kept so it can be shown without asking again
type MuseJob = FeedJob & { description: string };

// openings from a wide, public job site that covers fields the company boards do not: healthcare, logistics, retail, teaching and more
export async function fieldJobs(categories: string[], level: string | null, pages = 2): Promise<MuseJob[]> {
  if (OFFLINE()) return [];
  const results = await Promise.all(
    categories.flatMap((category) =>
      Array.from({ length: pages }, async (_, page) => {
        const cacheKey = `${category}|${level ?? ""}|${page}`;
        const saved = memory.muse.get(cacheKey);
        if (saved && Date.now() - saved.at < 30 * 60 * 1000) return saved.jobs;
        try {
          const params = new URLSearchParams({ category, page: String(page + 1) });
          if (level) params.set("level", level);
          const data = (await getJson(`https://www.themuse.com/api/public/jobs?${params}`, 9000)) as { results?: Raw[] };
          const jobs = (data.results ?? []).map((job): MuseJob => {
            const description = htmlToText(text(job.contents));
            const title = text(job.name);
            const location = ((job.locations as Raw[] | undefined) ?? []).map((place) => text(place.name)).join("; ");
            return {
              id: `muse:jobs:${String(job.id)}`,
              title,
              company: text((job.company as Raw | undefined)?.name),
              domain: "",
              location,
              remote: /remote|flexible/i.test(location),
              url: text((job.refs as Raw | undefined)?.landing_page),
              postedAt: text(job.publication_date) || null,
              skills: skillsIn(title, description),
              intern: INTERN.test(title) || level === "Internship",
              description,
            };
          });
          memory.muse.set(cacheKey, { at: Date.now(), jobs });
          return jobs;
        } catch {
          return saved?.jobs ?? [];
        }
      }),
    ),
  );
  return results.flat().filter((job) => job.title && /^https:\/\//.test(job.url));
}

export type JobSearch = { query: string; location: string; remoteOnly: boolean; internOnly: boolean; days: number | null; sort: "relevance" | "date" };

// a search result, with how well it suits the resume when one was given
export type JobResult = FeedJob & { fit: number | null };

// filters and ranks openings. with a resume the best fits come first, without one the newest do
export function searchJobs(jobs: FeedJob[], search: JobSearch, profile: ResumeProfile | null, limit = 60): JobResult[] {
  const words = search.query.toLowerCase().split(/\s+/).filter(Boolean);
  const place = search.location.trim().toLowerCase();
  const since = search.days ? Date.now() - search.days * 86_400_000 : null;

  const seen = new Set<string>();
  const kept: JobResult[] = [];
  for (const job of jobs) {
    const haystack = `${job.title} ${job.company}`.toLowerCase();
    if (words.length > 0 && !words.every((word) => haystack.includes(word))) continue;
    if (place && !job.location.toLowerCase().includes(place)) continue;
    if (search.remoteOnly && !job.remote) continue;
    if (search.internOnly && !job.intern) continue;
    if (since && (!job.postedAt || new Date(job.postedAt).getTime() < since)) continue;
    // the same role is often posted once per city, one card is enough
    const twin = `${job.company}|${job.title}`.toLowerCase();
    if (seen.has(twin)) continue;
    seen.add(twin);
    kept.push({ ...job, fit: profile ? fitScore(job, profile) : null });
  }

  const byDate = (a: JobResult, b: JobResult) => (b.postedAt ?? "").localeCompare(a.postedAt ?? "");
  kept.sort((a, b) => (search.sort === "date" || !profile ? byDate(a, b) : (b.fit ?? -1) - (a.fit ?? -1) || byDate(a, b)));
  // no more than a handful from any one company near the top, so one big employer does not fill the page
  const perCompany = new Map<string, number>();
  const spread = kept.filter((job) => {
    const count = (perCompany.get(job.company) ?? 0) + 1;
    perCompany.set(job.company, count);
    return count <= 6;
  });
  return spread.slice(0, limit);
}

// the full description of one opening, fetched from where it lives
export async function jobDescription(id: string): Promise<string | null> {
  const [source, token, jobId] = id.split(":");
  if (!jobId || !/^[\w-]+$/.test(jobId)) return null;
  try {
    if (source === "muse") {
      const known = Array.from(memory.muse.values()).flatMap((page) => page.jobs).find((entry: MuseJob) => entry.id === id);
      if (known) return known.description;
      const data = (await getJson(`https://www.themuse.com/api/public/jobs/${jobId}`)) as Raw;
      return htmlToText(text(data.contents)) || null;
    }
    const board = BOARDS.find((entry) => entry.source === source && entry.token === token);
    if (!board) return null;
    if (board.source === "greenhouse") return htmlToText(text(((await getJson(`https://boards-api.greenhouse.io/v1/boards/${board.token}/jobs/${jobId}`)) as Raw).content)) || null;
    if (board.source === "lever") {
      const job = (await getJson(`https://api.lever.co/v0/postings/${board.token}/${jobId}`)) as Raw;
      const lists = ((job.lists as Raw[] | undefined) ?? []).map((list) => `${text(list.text)}\n${htmlToText(text(list.content))}`).join("\n\n");
      return [text(job.descriptionPlain), lists].filter(Boolean).join("\n\n").trim() || null;
    }
    const data = (await getJson(`https://api.ashbyhq.com/posting-api/job-board/${board.token}`, 25_000)) as { jobs?: Raw[] };
    return text((data.jobs ?? []).find((job) => String(job.id) === jobId)?.descriptionPlain).trim() || null;
  } catch {
    return null;
  }
}

// finds one opening again by its id, in what we have saved or in the wider site's recent pages
export async function findJob(id: string): Promise<FeedJob | null> {
  if (id.startsWith("muse:")) {
    return Array.from(memory.muse.values()).flatMap((page) => page.jobs).find((entry: MuseJob) => entry.id === id) ?? null;
  }
  return (await savedJobs()).jobs.find((job) => job.id === id) ?? null;
}

// used by tests to start from a clean slate
export function forgetFeed(): void {
  memory.feed = null;
  memory.muse.clear();
}
