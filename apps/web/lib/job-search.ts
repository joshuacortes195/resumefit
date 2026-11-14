import { createHash } from "node:crypto";
import { and, eq, like, lt } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { htmlToText, type FeedJob } from "@/lib/jobs-feed";

// live job search: asks job sites for the title someone is after, right when they search.
// the company boards we keep a copy of only cover the companies on our list. these sites cover everyone else,
// including openings that were first posted on the big job sites, through search services that are allowed to pass them on

// an opening found by a live search, with its description kept so it can be shown without asking again
export type LiveJob = FeedJob & { description: string; via: string };

// what someone is looking for
export type LiveQuery = { what: string; where: string; remoteOnly: boolean; internOnly: boolean; days: number | null };

type Raw = Record<string, unknown>;
const text = (value: unknown) => (typeof value === "string" ? value : typeof value === "number" ? String(value) : "");
const INTERN = /\b(intern|internship|co-?op|new grad|graduate program|apprentice)\b/i;

// one place to search. keys says which settings it needs, and it is skipped while they are missing
export type Provider = {
  id: string;
  name: string;
  // how long one answer is reused, so a free plan's allowance lasts
  keepMs: number;
  ready: (env: NodeJS.ProcessEnv) => boolean;
  search: (query: LiveQuery, env: NodeJS.ProcessEnv, get: Getter) => Promise<LiveJob[]>;
};

// fetches json, swapped out in tests
export type Getter = (url: string, headers?: Record<string, string>) => Promise<unknown>;

const getJson: Getter = async (url, headers = {}) => {
  const response = await fetch(url, { signal: AbortSignal.timeout(9000), headers: { Accept: "application/json", "User-Agent": "ResumeFit job search", ...headers } });
  if (!response.ok) throw new Error(`job search answered ${response.status}`);
  return response.json();
};

// builds one opening the way the rest of the app keeps them
function job(provider: string, id: string, fields: { title: string; company: string; location: string; url: string; postedAt: string | null; description: string; remote?: boolean; via: string }): LiveJob {
  const description = htmlToText(fields.description).slice(0, 12_000);
  return {
    id: `${provider}:jobs:${id.replace(/[^\w-]/g, "_").slice(0, 120)}`,
    // some sites put bold tags around the words that matched
    title: htmlToText(fields.title).replace(/\s+/g, " ").trim(),
    company: fields.company.trim(),
    domain: "",
    location: fields.location.trim(),
    remote: fields.remote ?? /\bremote\b/i.test(`${fields.location} ${fields.title}`),
    url: fields.url,
    postedAt: fields.postedAt,
    // the skills are worked out by the caller, which has the skills list
    skills: [],
    intern: INTERN.test(fields.title),
    description,
    via: fields.via,
  };
}

// a general job index with a location search. free key from developer.adzuna.com
export const adzuna: Provider = {
  id: "adzuna",
  name: "Adzuna",
  keepMs: 60 * 60_000,
  ready: (env) => Boolean(env.ADZUNA_APP_ID && env.ADZUNA_APP_KEY),
  async search(query, env, get) {
    const params = new URLSearchParams({ app_id: env.ADZUNA_APP_ID ?? "", app_key: env.ADZUNA_APP_KEY ?? "", results_per_page: "50", what: `${query.what}${query.internOnly ? " intern" : ""}`.trim(), sort_by: "date" });
    if (query.where) params.set("where", query.where);
    if (query.days) params.set("max_days_old", String(query.days));
    const data = (await get(`https://api.adzuna.com/v1/api/jobs/us/search/1?${params}`)) as { results?: Raw[] };
    return (data.results ?? []).map((entry) =>
      job("adzuna", text(entry.id), { title: text(entry.title), company: text((entry.company as Raw | undefined)?.display_name), location: text((entry.location as Raw | undefined)?.display_name), url: text(entry.redirect_url), postedAt: text(entry.created) || null, description: text(entry.description), via: "Adzuna" }),
    );
  },
};

// a search service that gathers openings from across the web, the big job sites included. free key from rapidapi.com (JSearch)
export const jsearch: Provider = {
  id: "jsearch",
  name: "JSearch",
  // the free plan is small, so one answer is kept for a good while
  keepMs: 6 * 60 * 60_000,
  ready: (env) => Boolean(env.RAPIDAPI_KEY),
  async search(query, env, get) {
    const params = new URLSearchParams({ query: `${query.what}${query.internOnly ? " intern" : ""}${query.where ? ` in ${query.where}` : ""}`.trim(), page: "1", num_pages: "1", country: "us" });
    params.set("date_posted", query.days === 1 ? "today" : query.days === 7 ? "week" : query.days === 30 ? "month" : "all");
    if (query.remoteOnly) params.set("work_from_home", "true");
    const data = (await get(`https://jsearch.p.rapidapi.com/search?${params}`, { "X-RapidAPI-Key": env.RAPIDAPI_KEY ?? "", "X-RapidAPI-Host": "jsearch.p.rapidapi.com" })) as { data?: Raw[] };
    return (data.data ?? []).map((entry) =>
      job("jsearch", text(entry.job_id), {
        title: text(entry.job_title),
        company: text(entry.employer_name),
        location: [text(entry.job_city), text(entry.job_state)].filter(Boolean).join(", ") || text(entry.job_country),
        url: text(entry.job_apply_link),
        postedAt: text(entry.job_posted_at_datetime_utc) || null,
        description: text(entry.job_description),
        remote: entry.job_is_remote === true,
        // the site the opening was first posted on, like LinkedIn or Indeed
        via: text(entry.job_publisher) || "JSearch",
      }),
    );
  },
};

// united states government openings. free key from developer.usajobs.gov, asked for with an email address
export const usajobs: Provider = {
  id: "usajobs",
  name: "USAJOBS",
  keepMs: 60 * 60_000,
  ready: (env) => Boolean(env.USAJOBS_API_KEY && env.USAJOBS_EMAIL),
  async search(query, env, get) {
    const params = new URLSearchParams({ Keyword: `${query.what}${query.internOnly ? " intern" : ""}`.trim(), ResultsPerPage: "50" });
    if (query.where) params.set("LocationName", query.where);
    if (query.days) params.set("DatePosted", String(query.days));
    if (query.remoteOnly) params.set("RemoteIndicator", "True");
    const data = (await get(`https://data.usajobs.gov/api/search?${params}`, { Host: "data.usajobs.gov", "User-Agent": env.USAJOBS_EMAIL ?? "", "Authorization-Key": env.USAJOBS_API_KEY ?? "" })) as { SearchResult?: { SearchResultItems?: Raw[] } };
    return (data.SearchResult?.SearchResultItems ?? []).map((item) => {
      const entry = (item.MatchedObjectDescriptor ?? {}) as Raw;
      const details = ((entry.UserArea as Raw | undefined)?.Details ?? {}) as Raw;
      return job("usajobs", text(item.MatchedObjectId), {
        title: text(entry.PositionTitle),
        company: text(entry.OrganizationName) || text(entry.DepartmentName),
        location: text(entry.PositionLocationDisplay),
        url: text(entry.PositionURI),
        postedAt: text(entry.PublicationStartDate) || null,
        description: [text(details.JobSummary), text(entry.QualificationSummary)].filter(Boolean).join("\n\n"),
        via: "USAJOBS",
      });
    });
  },
};

// remote openings, no key needed. the site asks not to be called often, so an answer is kept for hours
export const remotive: Provider = {
  id: "remotive",
  name: "Remotive",
  keepMs: 6 * 60 * 60_000,
  ready: () => true,
  async search(query, _env, get) {
    const data = (await get(`https://remotive.com/api/remote-jobs?${new URLSearchParams({ search: query.what, limit: "40" })}`)) as { jobs?: Raw[] };
    return (data.jobs ?? []).map((entry) =>
      job("remotive", text(entry.id), { title: text(entry.title), company: text(entry.company_name), location: `Remote, ${text(entry.candidate_required_location) || "anywhere"}`, url: text(entry.url), postedAt: text(entry.publication_date) || null, description: text(entry.description), remote: true, via: "Remotive" }),
    );
  },
};

// more remote openings, no key needed
export const jobicy: Provider = {
  id: "jobicy",
  name: "Jobicy",
  keepMs: 6 * 60 * 60_000,
  ready: () => true,
  async search(query, _env, get) {
    const data = (await get(`https://jobicy.com/api/v2/remote-jobs?${new URLSearchParams({ count: "40", tag: query.what })}`)) as { jobs?: Raw[] };
    return (data.jobs ?? []).map((entry) =>
      job("jobicy", text(entry.id), { title: text(entry.jobTitle), company: text(entry.companyName), location: `Remote, ${text(entry.jobGeo) || "anywhere"}`, url: text(entry.url), postedAt: text(entry.pubDate) || null, description: text(entry.jobDescription) || text(entry.jobExcerpt), remote: true, via: "Jobicy" }),
    );
  },
};

export const PROVIDERS: Provider[] = [adzuna, jsearch, usajobs, remotive, jobicy];

// the places a search can reach right now, by name, for the line under the search box
export function liveSources(env: NodeJS.ProcessEnv = process.env): string[] {
  return PROVIDERS.filter((provider) => provider.ready(env)).map((provider) => provider.name);
}

// where one provider's answer to one search is kept
function cacheKey(provider: Provider, query: LiveQuery): string {
  const asked = [query.what, query.where, query.remoteOnly, query.internOnly, query.days].join("|").toLowerCase();
  return `search:${provider.id}:${createHash("sha256").update(asked).digest("hex").slice(0, 24)}`;
}

// what is held in memory between requests
const globalForSearch = globalThis as unknown as { liveSearch?: Map<string, { at: number; jobs: LiveJob[] }> };
const memory: Map<string, { at: number; jobs: LiveJob[] }> = (globalForSearch.liveSearch ??= new Map());

// one provider's openings for a search: from memory, then the saved copy, then the site itself
async function ask(provider: Provider, query: LiveQuery, env: NodeJS.ProcessEnv, get: Getter): Promise<LiveJob[]> {
  const key = cacheKey(provider, query);
  const held = memory.get(key);
  if (held && Date.now() - held.at < provider.keepMs) return held.jobs;
  const db = await getDb();
  const [row] = await db.select({ value: schema.appSettings.value, updatedAt: schema.appSettings.updatedAt }).from(schema.appSettings).where(eq(schema.appSettings.key, key)).limit(1);
  const saved = (row?.value as { jobs?: LiveJob[] } | undefined)?.jobs ?? [];
  if (row && Date.now() - row.updatedAt.getTime() < provider.keepMs) {
    memory.set(key, { at: row.updatedAt.getTime(), jobs: saved });
    return saved;
  }
  try {
    const jobs = (await provider.search(query, env, get)).filter((entry) => entry.title && /^https:\/\//.test(entry.url)).slice(0, 50);
    const value = { jobs };
    await db.insert(schema.appSettings).values({ key, value }).onConflictDoUpdate({ target: schema.appSettings.key, set: { value, updatedAt: new Date() } });
    memory.set(key, { at: Date.now(), jobs });
    return jobs;
  } catch {
    // a site that is down or out of allowance gives back what it gave last time
    return saved;
  }
}

// true when an opening is really about what was asked for. some sites answer a search loosely, with anything that mentions one of the words.
// the last word, which names the role ("analyst", "engineer"), has to be in the title, and the rest in the title or the description
export function relevant(job: Pick<LiveJob, "title" | "description">, what: string): boolean {
  const words = what.toLowerCase().split(/[^a-z0-9+#.]+/).filter((word) => word.length > 1);
  if (words.length === 0) return true;
  const title = job.title.toLowerCase();
  const body = job.description.toLowerCase();
  return title.includes(words[words.length - 1] ?? "") && words.every((word) => title.includes(word) || body.includes(word));
}

// searches every site we can reach for one title. a site that fails just adds nothing
export async function liveJobs(query: LiveQuery, env: NodeJS.ProcessEnv = process.env, get: Getter = getJson): Promise<LiveJob[]> {
  if (env.JOB_FEED_OFFLINE === "1" || query.what.trim().length < 2) return [];
  const ready = PROVIDERS.filter((provider) => provider.ready(env));
  const answers = await Promise.all(ready.map((provider) => ask(provider, query, env, get).catch(() => [] as LiveJob[])));
  return answers.flat().filter((entry) => relevant(entry, query.what));
}

// finds one opening from a live search again by its id
export async function findLiveJob(id: string): Promise<LiveJob | null> {
  const provider = PROVIDERS.find((entry) => id.startsWith(`${entry.id}:`));
  if (!provider) return null;
  for (const held of memory.values()) {
    const found = held.jobs.find((entry) => entry.id === id);
    if (found) return found;
  }
  // another copy of the app may have done the search, so look in what was saved
  const db = await getDb();
  const rows = await db.select({ value: schema.appSettings.value }).from(schema.appSettings).where(like(schema.appSettings.key, `search:${provider.id}:%`));
  return rows.flatMap((row) => (row.value as { jobs?: LiveJob[] }).jobs ?? []).find((entry) => entry.id === id) ?? null;
}

// clears out saved searches nobody has repeated in a week. called with the daily refresh
export async function sweepSearches(now = Date.now()): Promise<void> {
  const db = await getDb();
  await db.delete(schema.appSettings).where(and(like(schema.appSettings.key, "search:%"), lt(schema.appSettings.updatedAt, new Date(now - 7 * 86_400_000))));
}

// used by tests to start from a clean slate
export function forgetSearches(): void {
  memory.clear();
}
