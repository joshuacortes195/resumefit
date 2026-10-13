import { lookup } from "node:dns/promises";
import { request } from "node:https";
import { isIP, type LookupFunction } from "node:net";
import { createBrotliDecompress, createGunzip, createInflate } from "node:zlib";
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

// looks a site up for the connection itself and refuses a private address right there.
// checking first and connecting later would let a site answer "public" to the check and "private" to the connection
export const publicLookup: LookupFunction = (hostname, options, callback) => {
  lookup(hostname, { all: true }).then(
    (addresses) => {
      if (addresses.length === 0 || addresses.some((entry) => isPrivateAddress(entry.address))) return callback(new Error("private address"), "", 0);
      // newer versions of node ask for the whole list, older ones for a single address
      if (typeof options === "object" && options.all) return callback(null, addresses);
      const first = addresses[0];
      if (first) callback(null, first.address, first.family);
    },
    (error: NodeJS.ErrnoException) => callback(error, "", 0),
  );
};

type Page = { status: number; location: string | null; type: string; body: string };

// one request to one address, connecting only to the address that passed the check, and cutting off anything huge or slow
function getPage(url: URL, accept: string): Promise<Page> {
  return new Promise((resolve, reject) => {
    const give = (error: unknown) => reject(error instanceof ImportError ? error : new ImportError("The job site would not show us that page. Paste the details in instead."));
    const call = request(url, { method: "GET", lookup: publicLookup, signal: AbortSignal.timeout(TIMEOUT_MS), headers: { Accept: accept, "Accept-Encoding": "gzip, deflate, br", "User-Agent": "Mozilla/5.0 (compatible; ResumeFit job import)" } }, (response) => {
      const status = response.statusCode ?? 0;
      const location = response.headers.location ?? null;
      // a redirect or a refusal has no body worth reading
      if (status < 200 || status >= 300) {
        response.destroy();
        return resolve({ status, location, type: "", body: "" });
      }
      // pages usually arrive squeezed, so they are unpacked on the way in
      const encoding = String(response.headers["content-encoding"] ?? "").toLowerCase();
      const unpack = encoding === "br" ? createBrotliDecompress() : encoding === "gzip" || encoding === "x-gzip" ? createGunzip() : encoding === "deflate" ? createInflate() : null;
      const stream = unpack ? response.pipe(unpack) : response;
      const chunks: Buffer[] = [];
      let size = 0;
      let stopped = false;
      const done = () => resolve({ status, location, type: String(response.headers["content-type"] ?? ""), body: Buffer.concat(chunks).subarray(0, MAX_BYTES).toString("utf8") });
      stream.on("data", (chunk: Buffer) => {
        // nothing is kept once the page has been cut off
        if (stopped) return;
        chunks.push(chunk);
        size += chunk.length;
        // a giant page is cut off here instead of filling memory. the size is counted after unpacking,
        // and the unpacking is stopped too, or a few bytes built to unpack into gigabytes would keep going
        if (size >= MAX_BYTES) {
          stopped = true;
          unpack?.destroy();
          response.destroy();
          done();
        }
      });
      stream.on("end", done);
      stream.on("error", (error) => (size > 0 ? done() : give(error)));
      response.on("error", give);
    });
    call.on("error", give);
    call.end();
  });
}

// fetches a page, checking every hop of a redirect and giving up on anything huge or slow
async function fetchPublic(raw: string, accept: string): Promise<string> {
  let next = raw;
  for (let hop = 0; hop < 4; hop++) {
    const url = await checkPublicUrl(next);
    const page = await getPage(url, accept);
    if (page.status >= 300 && page.status < 400 && page.location) {
      next = new URL(page.location, url).toString();
      continue;
    }
    if (page.status < 200 || page.status >= 300) throw new ImportError("The job site would not show us that page. Paste the details in instead.");
    if (!/html|json|text/.test(page.type)) throw new ImportError("That link is not a web page.");
    return page.body;
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

// the longest a single tag is allowed to be before it is taken for junk
const MAX_TAG = 4000;

// every tag with a given name, each with what sits between it and its closing tag when asked for.
// the page is walked once from start to end, so a page full of unfinished tags costs no more than an ordinary one
function tags(html: string, lower: string, name: string, withBody: boolean): { tag: string; body: string }[] {
  const found: { tag: string; body: string }[] = [];
  let at = 0;
  while (found.length < 500) {
    const open = lower.indexOf(`<${name}`, at);
    if (open === -1) break;
    const close = lower.indexOf(">", open);
    // a tag that never ends means there are no more whole tags after it
    if (close === -1) break;
    at = close + 1;
    if (close - open > MAX_TAG) continue;
    const tag = html.slice(open, close + 1);
    if (!withBody) {
      found.push({ tag, body: "" });
      continue;
    }
    const end = lower.indexOf(`</${name}`, close);
    // no closing tag from here on, so none for anything later either
    if (end === -1) break;
    found.push({ tag, body: html.slice(close + 1, end) });
    at = end;
  }
  return found;
}

// what a page says about itself in its <meta> tags
function meta(metaTags: string[], name: string): string {
  const wanted = new RegExp(`(?:property|name)=["']${name}["']`, "i");
  const tag = metaTags.find((candidate) => wanted.test(candidate)) ?? "";
  return htmlToText(tag.match(/content=(["'])([\s\S]*?)\1/i)?.[2] ?? "");
}

// finds the job posting inside the structured data many job sites put in the page for search engines
function structuredJob(html: string, lower: string): Record<string, unknown> | null {
  for (const script of tags(html, lower, "script", true)) {
    if (!/type=["']application\/ld\+json["']/i.test(script.tag)) continue;
    let data: unknown;
    try {
      data = JSON.parse(script.body);
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
  const lower = html.toLowerCase();
  const posting = structuredJob(html, lower);
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
  const metaTags = tags(html, lower, "meta", false).map((entry) => entry.tag);
  const title = meta(metaTags, "og:title") || htmlToText(tags(html, lower, "title", true)[0]?.body ?? "");
  if (!title) return null;
  return { title, company: meta(metaTags, "og:site_name"), location: "", description: meta(metaTags, "og:description") || meta(metaTags, "description") };
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
