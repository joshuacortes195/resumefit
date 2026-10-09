import { countSkills, type SkillTerm } from "@resumefit/scoring";

// a company's public job board and which system it runs on
export type Board = { company: string; source: "greenhouse" | "lever" | "ashby"; token: string };

// the companies we look at. each one publishes its openings through a free, public feed meant for exactly this
export const BOARDS: Board[] = [
  { company: "Stripe", source: "greenhouse", token: "stripe" },
  { company: "Airbnb", source: "greenhouse", token: "airbnb" },
  { company: "Figma", source: "greenhouse", token: "figma" },
  { company: "Duolingo", source: "greenhouse", token: "duolingo" },
  { company: "GitLab", source: "greenhouse", token: "gitlab" },
  { company: "Datadog", source: "greenhouse", token: "datadog" },
  { company: "Spotify", source: "lever", token: "spotify" },
  { company: "Palantir", source: "lever", token: "palantir" },
  { company: "Notion", source: "ashby", token: "notion" },
  { company: "Ramp", source: "ashby", token: "ramp" },
  { company: "Linear", source: "ashby", token: "linear" },
];

// one opening, in the same shape whichever board it came from
export type FeedJob = {
  // source, board and the board's own id, joined, so a job can be found again
  id: string;
  title: string;
  company: string;
  location: string;
  remote: boolean;
  url: string;
  postedAt: string | null;
  // empty for boards that only send descriptions one job at a time
  description: string;
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

// feeds are kept for half an hour, so searching does not hammer the boards
const TTL = 30 * 60 * 1000;
const globalForFeed = globalThis as unknown as { jobFeed?: Map<string, { at: number; jobs: FeedJob[] }> };
const cache = (globalForFeed.jobFeed ??= new Map());

async function getJson(url: string): Promise<unknown> {
  const response = await fetch(url, { signal: AbortSignal.timeout(12_000), headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`${url} answered ${response.status}`);
  return response.json();
}

type Raw = Record<string, unknown>;
const text = (value: unknown) => (typeof value === "string" ? value : "");

// reads one board into our own shape
async function fetchBoard(board: Board): Promise<FeedJob[]> {
  const key = (id: unknown) => `${board.source}:${board.token}:${String(id)}`;
  if (board.source === "greenhouse") {
    const data = (await getJson(`https://boards-api.greenhouse.io/v1/boards/${board.token}/jobs`)) as { jobs?: Raw[] };
    return (data.jobs ?? []).map((job) => {
      const location = text((job.location as Raw | undefined)?.name);
      return { id: key(job.id), title: text(job.title), company: board.company, location, remote: /remote/i.test(location), url: text(job.absolute_url), postedAt: text(job.first_published) || text(job.updated_at) || null, description: "" };
    });
  }
  if (board.source === "lever") {
    const data = (await getJson(`https://api.lever.co/v0/postings/${board.token}?mode=json`)) as Raw[];
    return data.map((job) => {
      const categories = (job.categories as Raw | undefined) ?? {};
      const lists = ((job.lists as Raw[] | undefined) ?? []).map((list) => `${text(list.text)}\n${htmlToText(text(list.content))}`).join("\n\n");
      const location = text(categories.location);
      return {
        id: key(job.id),
        title: text(job.text),
        company: board.company,
        location,
        remote: text(job.workplaceType) === "remote" || /remote/i.test(location),
        url: text(job.hostedUrl),
        postedAt: typeof job.createdAt === "number" ? new Date(job.createdAt).toISOString() : null,
        description: [text(job.descriptionPlain), lists].filter(Boolean).join("\n\n").trim(),
      };
    });
  }
  const data = (await getJson(`https://api.ashbyhq.com/posting-api/job-board/${board.token}`)) as { jobs?: Raw[] };
  return (data.jobs ?? [])
    .filter((job) => job.isListed !== false)
    .map((job) => ({ id: key(job.id), title: text(job.title), company: board.company, location: text(job.location), remote: job.isRemote === true, url: text(job.jobUrl), postedAt: text(job.publishedAt) || null, description: text(job.descriptionPlain).trim() }));
}

// every opening from every board. a board that is down is skipped, not fatal
export async function allJobs(boards: Board[] = BOARDS): Promise<FeedJob[]> {
  const results = await Promise.all(
    boards.map(async (board) => {
      const cacheKey = `${board.source}:${board.token}`;
      const saved = cache.get(cacheKey);
      if (saved && Date.now() - saved.at < TTL) return saved.jobs;
      try {
        const jobs = (await fetchBoard(board)).filter((job) => job.title && job.url);
        cache.set(cacheKey, { at: Date.now(), jobs });
        return jobs;
      } catch {
        // better an older copy than nothing
        return saved?.jobs ?? [];
      }
    }),
  );
  return results.flat();
}

// the full description of one opening. greenhouse sends these one at a time
export async function jobDescription(id: string): Promise<string | null> {
  const [source, token, jobId] = id.split(":");
  const board = BOARDS.find((entry) => entry.source === source && entry.token === token);
  if (!board || !jobId || !/^[\w-]+$/.test(jobId)) return null;
  const known = (await allJobs([board])).find((job) => job.id === id);
  if (!known) return null;
  if (known.description) return known.description;
  try {
    const data = (await getJson(`https://boards-api.greenhouse.io/v1/boards/${board.token}/jobs/${jobId}`)) as Raw;
    known.description = htmlToText(text(data.content));
    return known.description;
  } catch {
    return null;
  }
}

export type JobSearch = { query: string; location: string; remoteOnly: boolean; days: number | null; sort: "relevance" | "date" };

// a search result, with a rough match when a resume was given
export type JobResult = Omit<FeedJob, "description"> & { snippet: string; match: number | null };

// rough fit between a resume and an opening: the share of the opening's skills the resume has.
// boards that only send a title get no number at all, and the rest is an estimate and nothing more
export function quickMatch(job: FeedJob, resumeText: string, skills: SkillTerm[]): number | null {
  const wanted = countSkills(`${job.title}\n${job.description}`, skills);
  // a title on its own names one skill at most, which is not enough to call anything a match
  if (wanted.size === 0 || (!job.description && wanted.size < 3)) return null;
  const names = new Set(wanted.keys());
  const have = countSkills(resumeText, skills.filter((skill) => names.has(skill.name)));
  return Math.round((have.size / wanted.size) * 100);
}

// filters and sorts openings. with a resume, the best fits come first
export function searchJobs(jobs: FeedJob[], search: JobSearch, resume: { text: string; skills: SkillTerm[] } | null, limit = 60): JobResult[] {
  const words = search.query.toLowerCase().split(/\s+/).filter(Boolean);
  const place = search.location.trim().toLowerCase();
  const since = search.days ? Date.now() - search.days * 86_400_000 : null;

  const kept = jobs.filter((job) => {
    const haystack = `${job.title} ${job.company}`.toLowerCase();
    if (words.length > 0 && !words.every((word) => haystack.includes(word))) return false;
    if (place && !job.location.toLowerCase().includes(place)) return false;
    if (search.remoteOnly && !job.remote) return false;
    if (since && (!job.postedAt || new Date(job.postedAt).getTime() < since)) return false;
    return true;
  });

  // scoring every opening against a resume is only worth doing for the ones that passed the filters
  const scored = kept.slice(0, 400).map((job) => ({ job, match: resume ? quickMatch(job, resume.text, resume.skills) : null }));
  const byDate = (a: { job: FeedJob }, b: { job: FeedJob }) => (b.job.postedAt ?? "").localeCompare(a.job.postedAt ?? "");
  scored.sort((a, b) => (search.sort === "date" || !resume ? byDate(a, b) : (b.match ?? -1) - (a.match ?? -1) || byDate(a, b)));

  return scored.slice(0, limit).map(({ job, match }) => {
    const { description, ...rest } = job;
    return { ...rest, snippet: description.replace(/\s+/g, " ").slice(0, 180), match };
  });
}
