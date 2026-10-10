// what an Apply button says on a job posting
const APPLY_TEXT = /^(apply|apply now|apply here|apply today|apply online|apply for (this|the) (job|role|position)|apply to (this|the) (job|role|position)|start (your )?application|i'?m interested)$/i;

// finds where a posting's Apply button leads, so we can go straight to the form. null when there is no plain link to follow
export function findApplyLink(doc: Document, url: string): string | null {
  // greenhouse forms are often tucked into a frame on the company's own site
  const frame = doc.querySelector<HTMLIFrameElement>('iframe[src*="greenhouse.io/embed/job_app"]');
  const candidates = [frame?.getAttribute("src"), ...[...doc.querySelectorAll<HTMLAnchorElement>("a[href]")].filter((link) => APPLY_TEXT.test((link.textContent ?? "").replace(/\s+/g, " ").trim())).map((link) => link.getAttribute("href"))];
  for (const href of candidates) {
    if (!href || href.startsWith("#")) continue;
    try {
      const target = new URL(href, url);
      // only real, secure pages, and never the page we are already on
      if (target.protocol === "https:" && target.href.split("#")[0] !== url.split("#")[0]) return target.href;
    } catch {
      // not an address, try the next one
    }
  }
  return null;
}
