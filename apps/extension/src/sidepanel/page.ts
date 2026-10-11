import type { PageInfo, PageRequest } from "../lib/types";

// what we ask chrome for, once: to read the page the panel is opened on. job postings live on every kind of site, so it covers them all.
// it is only ever used on the page the person has the panel open on
export const SITE_ACCESS = ["https://*/*"];

// thrown when chrome has not let us onto the page yet. the panel shows an Allow button for it
export class NeedsAccess extends Error {
  constructor() {
    super("ResumeFit is not allowed to read this page yet. Press Allow and it will look for a job posting here.");
  }
}

// the tab the side panel is sitting next to
export async function activeTab(): Promise<chrome.tabs.Tab | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab ?? null;
}

// puts our page script into the tab. it is only ever added when the person asks for something
async function inject(tabId: number): Promise<void> {
  await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
}

// asks the page script something, adding it to the page first when it is not there yet
export async function askPage<T>(request: PageRequest): Promise<T> {
  const tab = await activeTab();
  if (!tab?.id) throw new Error("Open a job posting in this tab first.");
  // chrome only tells us a tab's address once we are allowed onto it, so a missing address means "not allowed yet", not "wrong page"
  if (tab.url && !/^https?:/.test(tab.url)) throw new Error("Open a job posting in this tab first.");
  try {
    return (await chrome.tabs.sendMessage(tab.id, request)) as T;
  } catch {
    // not there yet, or the page was reloaded since
  }
  try {
    await inject(tab.id);
  } catch {
    // we were not invited onto this site yet, so ask. chrome only lets us ask from a click, so opening the panel by itself ends up in the catch
    const granted = await chrome.permissions.request({ origins: SITE_ACCESS }).catch(() => false);
    if (!granted) throw new NeedsAccess();
    await inject(tab.id);
  }
  return (await chrome.tabs.sendMessage(tab.id, request)) as T;
}

export const readPage = () => askPage<PageInfo>({ type: "read-page" });

