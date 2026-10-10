import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { htmlToText } from "@/lib/jobs-feed";

// what we could read off a job posting's page
export type ImportedJob = { title: string; company: string; location: string; description: string };

// the biggest page we are willing to read
const MAX_BYTES = 2_000_000;
const TIMEOUT_MS = 8000;

// thrown with a message that is safe to show the person
export class ImportError extends Error {}

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

// true for addresses that point back at this machine or a private network
export function isPrivateAddress(address: string): boolean {
  const mapped = address.toLowerCase().replace(/^::ffff:/, "");
  if (isIP(mapped) === 4) {
    const [a = 0, b = 0] = mapped.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19));
  }
  return mapped === "::" || mapped === "::1" || /^f[cd]/.test(mapped) || /^fe[89ab]/.test(mapped) || /^ff/.test(mapped);
}

// only ordinary public https pages get fetched, never something inside our own network
export async function checkPublicUrl(raw: string): Promise<URL> {
  if (!URL.canParse(raw)) throw new ImportError("That does not look like a link.");
  const url = new URL(raw);
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) throw new ImportError("Use the https:// link to the job posting.");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host) || !host.includes(".") || /\.(local|internal|localhost)$/i.test(host)) throw new ImportError("That link cannot be read.");
  const addresses = await lookup(host, { all: true }).catch(() => []);
  if (addresses.length === 0 || addresses.some((entry) => isPrivateAddress(entry.address))) throw new ImportError("That link cannot be read.");
  return url;
}

// fetches a page, checking every hop of a redirect and giving up on anything huge or slow
async function fetchPublic(raw: string, accept: string): Promise<string> {
  let next = raw;
  for (let hop = 0; hop < 4; hop++) {
    const url = await checkPublicUrl(next);
    const response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(TIMEOUT_MS), headers: { Accept: accept, "User-Agent": "Mozilla/5.0 (compatible; ResumeFit job import)" } });
    const location = response.headers.get("location");
    if (response.status >= 300 && response.status < 400 && location) {
      next = new URL(location, url).toString();
      continue;
    }
    if (!response.ok) throw new ImportError("The job site would not show us that page. Paste the details in instead.");
    if (!/html|json|text/.test(response.headers.get("content-type") ?? "")) throw new ImportError("That link is not a web page.");
    // read it in pieces so a giant page is cut off instead of filling memory
    const reader = response.body?.getReader();
    if (!reader) return "";
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (size < MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      size += value.length;
    }
    void reader.cancel().catch(() => undefined);
    return Buffer.concat(chunks).toString("utf8");
  }
  throw new ImportError("That link redirects too many times.");
}

// the job boards we can ask directly, which gives cleaner details than reading the page
function boardApi(url: URL): { api: string; read: (data: unknown) => ImportedJob | null } | null {
  const parts = url.pathname.split("/").filter(Boolean);
  const pretty = (token: string) => token.replace(/[-_]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

  // greenhouse: /company/jobs/123, or an embedded board with ?gh_jid=123
  if (/(^|\.)greenhouse\.io$/.test(url.hostname)) {
    const token = url.searchParams.get("for") ?? parts[0];
    const id = url.searchParams.get("gh_jid") ?? url.searchParams.get("token") ?? parts[parts.indexOf("jobs") + 1];
    if (!token || !id || !/^\d+$/.test(id)) return null;
    return {
      api: `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(token)}/jobs/${id}`,
      read: (data) => {
        const job = data as { title?: unknown; company_name?: unknown; location?: { name?: unknown }; content?: unknown };
        return text(job.title) ? { title: text(job.title), company: text(job.company_name) || pretty(token), location: text(job.location?.name), description: htmlToText(text(job.content)) } : null;
      },
    };
  }
  // lever: /company/posting-id
  if (url.hostname === "jobs.lever.co" && parts.length >= 2) {
    const [token = "", id = ""] = parts;
    return {
      api: `https://api.lever.co/v0/postings/${encodeURIComponent(token)}/${encodeURIComponent(id)}`,
      read: (data) => {
        const job = data as { text?: unknown; categories?: { location?: unknown }; descriptionPlain?: unknown; lists?: { text?: unknown; content?: unknown }[]; additionalPlain?: unknown };
        const lists = (job.lists ?? []).map((list) => `${text(list.text)}\n${htmlToText(text(list.content))}`).join("\n\n");
        return text(job.text) ? { title: text(job.text), company: pretty(token), location: text(job.categories?.location), description: [text(job.descriptionPlain), lists, text(job.additionalPlain)].filter(Boolean).join("\n\n") } : null;
      },
    };
  }
  // ashby: /company/posting-id
  if (url.hostname === "jobs.ashbyhq.com" && parts.length >= 2) {
    const [token = "", id = ""] = parts;
    return {
      api: `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(token)}`,
      read: (data) => {
        const jobs = (data as { jobs?: { id?: unknown; title?: unknown; location?: unknown; descriptionPlain?: unknown; descriptionHtml?: unknown }[] }).jobs ?? [];
        const job = jobs.find((entry) => entry.id === id);
        return job && text(job.title) ? { title: text(job.title), company: pretty(token), location: text(job.location), description: text(job.descriptionPlain) || htmlToText(text(job.descriptionHtml)) } : null;
      },
    };
  }
  return null;
}

// what a page says about itself in its <meta> tags
function meta(html: string, name: string): string {
  const tag = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]*>`, "i"))?.[0] ?? "";
  return htmlToText(tag.match(/content=(["'])([\s\S]*?)\1/i)?.[2] ?? "");
}

// finds the job posting inside the structured data many job sites put in the page for search engines
function structuredJob(html: string): Record<string, unknown> | null {
  for (const match of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    let data: unknown;
    try {
      data = JSON.parse(match[1] ?? "");
    } catch {
      continue;
    }
    // it can be one thing, a list of things, or a "@graph" of things
    const queue: unknown[] = [data];
    while (queue.length > 0) {
      const entry = queue.shift();
      if (Array.isArray(entry)) queue.push(...entry);
      else if (entry && typeof entry === "object") {
        const thing = entry as Record<string, unknown>;
        if ([thing["@type"]].flat().includes("JobPosting")) return thing;
        if (Array.isArray(thing["@graph"])) queue.push(...thing["@graph"]);
      }
    }
  }
  return null;
}

// reads the job out of a page's html. kept apart from the fetching so it can be tested on its own
export function readJobPage(html: string): ImportedJob | null {
  const posting = structuredJob(html);
  if (posting) {
    const company = posting.hiringOrganization as { name?: unknown } | string | undefined;
    const place = [posting.jobLocation].flat()[0] as { address?: { addressLocality?: unknown; addressRegion?: unknown; addressCountry?: unknown } | string } | undefined;
    const address = place?.address;
    const country = typeof address === "object" ? address.addressCountry : "";
    const location = typeof address === "string" ? address : [text(address?.addressLocality), text(address?.addressRegion), typeof country === "string" ? country : text((country as { name?: unknown } | undefined)?.name)].filter(Boolean).join(", ");
    const title = htmlToText(text(posting.title) || text(posting.name));
    if (title) return { title, company: htmlToText(typeof company === "string" ? company : text(company?.name)), location: location || (posting.jobLocationType === "TELECOMMUTE" ? "Remote" : ""), description: htmlToText(text(posting.description)) };
  }
  // no structured data, so fall back to what the page shows when it is shared
  const title = meta(html, "og:title") || htmlToText(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");
  if (!title) return null;
  return { title, company: meta(html, "og:site_name"), location: "", description: meta(html, "og:description") || meta(html, "description") };
}

// trims everything to what the tracker stores
const tidy = (job: ImportedJob): ImportedJob => ({ title: job.title.slice(0, 200), company: job.company.slice(0, 200), location: job.location.slice(0, 200), description: job.description.slice(0, 60_000) });

// reads the title, company, location and description from a link to a job posting
export async function importJob(raw: string): Promise<ImportedJob> {
  const url = await checkPublicUrl(raw.trim());
  // linkedin does not let other sites read its postings, the extension can save those from the page itself
  if (/(^|\.)linkedin\.com$/.test(url.hostname)) throw new ImportError("LinkedIn does not let other sites read its postings. Open the job there and press Save job in the extension, or paste the details in.");
  if (/(^|\.)indeed\.com$/.test(url.hostname)) throw new ImportError("Indeed blocks other sites from reading its postings. Open the job there and press Save job in the extension, or paste the details in.");

  const board = boardApi(url);
  if (board) {
    try {
      const job = board.read(JSON.parse(await fetchPublic(board.api, "application/json")));
      if (job) return tidy(job);
    } catch (error) {
      if (!(error instanceof ImportError) && !(error instanceof SyntaxError)) throw error;
    }
  }
  const job = readJobPage(await fetchPublic(url.toString(), "text/html,application/xhtml+xml"));
  if (!job) throw new ImportError("We could not find the job details on that page. Paste them in instead.");
  return tidy(job);
}
