import type { LinkedinImport } from "./types";

// true on a linkedin profile page, like linkedin.com/in/jordan-lee
export function isLinkedinProfile(url: string): boolean {
  if (!URL.canParse(url)) return false;
  const { hostname, pathname } = new URL(url);
  return /(^|\.)linkedin\.com$/.test(hostname) && /^\/in\/[^/]+/.test(pathname);
}

const clean = (text: string | null | undefined) => (text ?? "").replace(/\s+/g, " ").trim();

// buttons and counters that sit in between the real text
const NOISE = /^(show all\b.*|…?\s*see more|see less|show more|show less|show credential|·.*|\d+ endorsements?|endorsed by .*|\d+ (experiences?|educations?) (at|across) .*|passed linkedin skill assessment)$/i;

// the lines a person sees in one part of the profile.
// linkedin writes each visible line in a span marked aria-hidden, with a hidden copy next to it for screen readers
function visibleLines(root: Element): string[] {
  const spans = [...root.querySelectorAll('span[aria-hidden="true"]')].map((span) => clean(span.textContent));
  const raw = spans.some(Boolean) ? spans : (root.textContent ?? "").split("\n").map(clean);
  const lines: string[] = [];
  for (const line of raw) {
    if (!line || NOISE.test(line) || lines.at(-1) === line) continue;
    lines.push(line);
  }
  return lines;
}

// one part of the profile, found by the anchor linkedin puts at its top, without its own heading
function part(doc: Document, id: string): string[] {
  const section = doc.getElementById(id)?.closest("section") ?? doc.querySelector(`section[data-section="${id}"]`);
  if (!section) return [];
  const lines = visibleLines(section);
  return lines[0]?.toLowerCase() === id ? lines.slice(1) : lines;
}

// reads the profile the person is looking at: headline, about, experience and the skills on show
export function readLinkedinProfile(doc: Document, url: string): LinkedinImport {
  const main = doc.querySelector("main") ?? doc.body;
  const name = clean(main.querySelector("h1")?.textContent);
  // the headline is the line right under the name
  let headline = clean(main.querySelector(".text-body-medium")?.textContent);
  if (!headline && name) {
    const top = main.querySelector("h1")?.closest("section");
    const lines = top ? (top.textContent ?? "").split("\n").map(clean).filter(Boolean) : [];
    headline = lines.slice(lines.indexOf(name) + 1).find((line) => line.length > 10 && !/^(he|she|they)\b|\b(1st|2nd|3rd)\b|contact info|connections|followers/i.test(line)) ?? "";
  }
  // the address without anything linkedin tacked on after the name
  const address = URL.canParse(url) ? `linkedin.com${new URL(url).pathname.match(/^\/in\/[^/]+/)?.[0] ?? ""}` : "";
  return {
    headline: headline.slice(0, 400),
    about: part(doc, "about").join("\n").slice(0, 6000),
    experience: part(doc, "experience").join("\n").slice(0, 20_000),
    // skill names are short, anything long is a description that slipped in
    skills: [...new Set(part(doc, "skills").filter((line) => line.length <= 50))].slice(0, 100),
    url: address,
  };
}
