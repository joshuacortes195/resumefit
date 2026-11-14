import type { PageJob } from "./types";

// where well known job sites keep the title, company, location and description
const SITES: { hosts: RegExp; title: string; company: string; location: string; description: string }[] = [
  {
    hosts: /linkedin\.com$/,
    title: ".job-details-jobs-unified-top-card__job-title, .top-card-layout__title, .jobs-unified-top-card__job-title",
    company: ".job-details-jobs-unified-top-card__company-name, .topcard__org-name-link, .jobs-unified-top-card__company-name",
    location: ".job-details-jobs-unified-top-card__primary-description-container span, .topcard__flavor--bullet",
    description: "#job-details, .jobs-description__content, .show-more-less-html__markup",
  },
  {
    hosts: /indeed\.com$/,
    title: '[data-testid="jobsearch-JobInfoHeader-title"], .jobsearch-JobInfoHeader-title',
    company: '[data-testid="inlineHeader-companyName"], [data-company-name="true"]',
    location: '[data-testid="inlineHeader-companyLocation"], [data-testid="job-location"]',
    description: "#jobDescriptionText",
  },
  {
    hosts: /glassdoor\.[a-z.]+$/,
    title: '[data-test="job-title"], h1[id^="jd-job-title"]',
    company: '[data-test="employer-name"], [class*="EmployerProfile_employerName"]',
    location: '[data-test="location"]',
    description: '[class*="JobDetails_jobDescription"], .jobDescriptionContent',
  },
  { hosts: /greenhouse\.io$/, title: "h1.app-title, .job__title h1, h1", company: ".company-name, .job__header .company", location: ".location, .job__location", description: "#content, .job__description" },
  { hosts: /lever\.co$/, title: ".posting-headline h2", company: ".main-header-logo img", location: ".posting-categories .location", description: '[data-qa="job-description"], .section-wrapper.page-full-width' },
  { hosts: /ashbyhq\.com$/, title: "h1", company: 'meta[property="og:site_name"]', location: '[class*="_location"]', description: '[class*="_descriptionText"], #overview' },
];

// the text of the first element that matches, images give their alt text and meta tags their content
function read(doc: Document, selector: string): string {
  if (!selector) return "";
  const element = doc.querySelector(selector);
  if (!element) return "";
  const text = element.getAttribute("content") ?? element.getAttribute("alt") ?? blockText(element);
  return text.replace(/[ \t]+/g, " ").trim();
}

// text with line breaks kept between blocks, so a description still reads as a list of requirements
function blockText(element: Element): string {
  const parts: string[] = [];
  const walk = (node: Node) => {
    if (node.nodeType === 3) parts.push(node.textContent ?? "");
    else if (node.nodeType === 1) {
      const tag = (node as Element).tagName;
      if (/^(SCRIPT|STYLE|NOSCRIPT|SVG)$/.test(tag)) return;
      const block = /^(P|DIV|LI|UL|OL|H[1-6]|BR|SECTION|TR)$/.test(tag);
      if (block) parts.push("\n");
      if (tag === "LI") parts.push("• ");
      node.childNodes.forEach(walk);
      if (block) parts.push("\n");
    }
  };
  walk(element);
  return parts
    .join("")
    .replace(/[ \t]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// takes the tags out of a description that came as html inside structured data.
// it is parsed into a separate, inert document, so images in it never load and scripts in it never run
function stripTags(html: string, doc: Document): string {
  const View = doc.defaultView ?? window;
  const inert = new View.DOMParser().parseFromString(html, "text/html");
  return blockText(inert.body);
}

// structured data that job sites publish for search engines, the cleanest source when it is there
function fromStructuredData(doc: Document): Partial<PageJob> | null {
  for (const script of doc.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const parsed: unknown = JSON.parse(script.textContent ?? "");
      const items = (Array.isArray(parsed) ? parsed : [parsed, ...(((parsed as { "@graph"?: unknown[] })?.["@graph"] as unknown[]) ?? [])]) as Record<string, unknown>[];
      const posting = items.find((item) => item?.["@type"] === "JobPosting");
      if (!posting) continue;
      const organization = posting.hiringOrganization as { name?: string } | undefined;
      const place = [posting.jobLocation].flat()[0] as { address?: { addressLocality?: string; addressRegion?: string } } | undefined;
      return {
        title: String(posting.title ?? ""),
        company: organization?.name ?? "",
        location: [place?.address?.addressLocality, place?.address?.addressRegion].filter(Boolean).join(", "),
        description: stripTags(String(posting.description ?? ""), doc),
      };
    } catch {
      // not valid json, try the next one
    }
  }
  return null;
}

// the biggest block of text on the page, which on a job page is nearly always the description
function biggestBlock(doc: Document): string {
  let best = "";
  for (const element of doc.querySelectorAll("main, article, section, [role='main'], div")) {
    // skip wrappers that are mostly links or form fields
    if (element.querySelectorAll("input, select, textarea").length > 3) continue;
    const text = blockText(element);
    const links = [...element.querySelectorAll("a")].reduce((total, link) => total + (link.textContent?.length ?? 0), 0);
    if (text.length > best.length && text.length < 30_000 && links < text.length * 0.3 && /experience|responsibilit|qualificat|requirement|skills/i.test(text)) best = text;
  }
  return best;
}

// reads the job posting off the page the person is looking at, null when it does not look like one
// the company named in a tab title like "Engineer @ Acme", "Job Application for Engineer at Acme" or "Acme - Engineer"
export function companyFromTitle(pageTitle: string, jobTitle: string): string {
  const text = pageTitle.replace(/\s+/g, " ").trim();
  const at = text.match(/(?:\s@\s|\sat\s)([^|@]+?)\s*(?:\||$)/i);
  if (at?.[1] && ((jobTitle && text.includes(jobTitle)) || /^job application for/i.test(text))) return at[1].trim();
  // "Company - Title" or "Title - Company": whichever side is not the job's own title
  const parts = text.split(/\s+[-|–]\s+/).map((part) => part.trim()).filter(Boolean);
  if (jobTitle && parts.length === 2) {
    const other = parts.find((part) => part.toLowerCase() !== jobTitle.toLowerCase());
    if (other && parts.some((part) => part.toLowerCase() === jobTitle.toLowerCase())) return other;
  }
  return "";
}

export function readJob(doc: Document, url: string): PageJob | null {
  const hostname = new URL(url).hostname;
  const site = SITES.find((entry) => entry.hosts.test(hostname));
  const structured = fromStructuredData(doc);

  const title = structured?.title || (site && read(doc, site.title)) || read(doc, "h1") || read(doc, 'meta[property="og:title"]');
  const description = structured?.description || (site && read(doc, site.description)) || biggestBlock(doc);
  if (!title || description.length < 200) return null;

  return {
    title: title.slice(0, 200),
    // a logo's description often ends in the word logo, and when the page names no company its tab title usually does
    company: ((structured?.company || (site && read(doc, site.company)) || read(doc, 'meta[property="og:site_name"]')).replace(/\s+logo$/i, "") || companyFromTitle(doc.title, title)).slice(0, 200),
    location: (structured?.location || (site && read(doc, site.location)) || "").slice(0, 200),
    description: description.slice(0, 40_000),
    url,
  };
}

// the kinds of captcha a form can carry. background: the page scores the visit by itself when the form is sent and asks nothing of anyone.
// challenge: a box to tick or a puzzle to solve, which only the person can do
export type CaptchaKind = "none" | "background" | "challenge";

// true when an element is really on screen
function showing(element: Element): boolean {
  const view = element.ownerDocument.defaultView;
  for (let node: Element | null = element; node; node = node.parentElement) {
    const style = view?.getComputedStyle(node);
    if (node.hasAttribute("hidden") || style?.display === "none" || style?.visibility === "hidden" || style?.opacity === "0") return false;
  }
  return true;
}

// works out which kind of captcha the page has. anything it is not sure about counts as a challenge
export function captchaKind(doc: Document): CaptchaKind {
  // a puzzle that has popped up, whatever kind of captcha it started as
  const puzzle = [...doc.querySelectorAll('iframe[src*="recaptcha"][src*="bframe"], iframe[src*="hcaptcha"][src*="challenge"]')].some((frame) => showing(frame) && (frame as HTMLElement).offsetHeight !== 0);
  if (puzzle || doc.querySelector("#px-captcha, .cf-turnstile, iframe[src*='turnstile']")) return "challenge";
  // google's: the little frame that holds either a box to tick or, when the site asked for it, nothing to see at all
  const anchors = [...doc.querySelectorAll<HTMLIFrameElement>('iframe[src*="recaptcha"][src*="anchor"]')];
  const widgets = [...doc.querySelectorAll(".g-recaptcha")];
  const google = anchors.length > 0 || widgets.length > 0 || doc.querySelector(".grecaptcha-badge") !== null;
  const googleHidden = anchors.every((frame) => /[?&]size=invisible/.test(frame.getAttribute("src") ?? "")) && widgets.every((widget) => widget.getAttribute("data-size") === "invisible");
  // hcaptcha's, which shows a box to tick unless the site set it up to stay out of sight
  const boxes = [...doc.querySelectorAll(".h-captcha")];
  const other = boxes.length > 0 || doc.querySelector('iframe[src*="hcaptcha"]') !== null;
  const otherHidden = boxes.length > 0 && boxes.every((box) => box.getAttribute("data-size") === "invisible");
  if ((google && !googleHidden) || (other && !otherHidden)) return "challenge";
  if (google || other) return "background";
  // a site key with nothing else we know is some captcha we have not met
  return doc.querySelector("[data-sitekey]") ? "challenge" : "none";
}

// true when the page has a captcha that only the person can do
export function hasCaptcha(doc: Document): boolean {
  return captchaKind(doc) === "challenge";
}

// the words a person can actually see inside an element. scripts, styles and hidden parts are left out,
// because job sites keep their "thank you" message tucked away in the page long before it is shown
function visibleText(element: Element, limit: number): string {
  const parts: string[] = [];
  let length = 0;
  const walk = (node: Node) => {
    if (length > limit) return;
    if (node.nodeType === 3) {
      parts.push(node.textContent ?? "");
      length += node.textContent?.length ?? 0;
    } else if (node.nodeType === 1) {
      const child = node as HTMLElement;
      if (/^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE|SVG)$/i.test(child.tagName) || child.hidden || child.getAttribute("aria-hidden") === "true") return;
      // the browser knows best whether something is on screen
      if (typeof child.checkVisibility === "function" && !child.checkVisibility()) return;
      child.childNodes.forEach(walk);
    }
  };
  walk(element);
  return parts.join(" ").replace(/\s+/g, " ");
}

// true when the page reads like the application went through
export function looksConfirmed(doc: Document): boolean {
  const main = doc.querySelector("main, [role='main'], body");
  const text = main ? visibleText(main, 6000).slice(0, 6000) : "";
  const THANKS = /thank(s| you) for (applying|your (application|interest in (applying|joining)))|application (has been |was )?(successfully |now )?(submitted|received|sent)|(successfully|already) (applied|submitted)|we('ve| have)? (got|received) your application|your application is (complete|in)\b/i;
  // a line about what will happen later, like "once your application is submitted", is not a thank you
  return text.split(/(?<=[.!?])\s+|\n/).some((line) => THANKS.test(line) && !/\b(once|when|after|if|until|before|as soon as)\b/i.test(line.slice(0, line.search(THANKS))));
}
