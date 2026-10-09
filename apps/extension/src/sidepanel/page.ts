import type { PageInfo, PageRequest } from "../lib/types";

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
  if (!tab?.id || !tab.url || !/^https?:/.test(tab.url)) throw new Error("Open a job posting or an application form in this tab first.");
  try {
    return (await chrome.tabs.sendMessage(tab.id, request)) as T;
  } catch {
    // not there yet, or the page was reloaded since
  }
  try {
    await inject(tab.id);
  } catch {
    // we were not invited onto this site yet, so ask for it, for this one site only
    const granted = await chrome.permissions.request({ origins: [`${new URL(tab.url).origin}/*`] });
    if (!granted) throw new Error("ResumeFit needs your OK to read this page. Press the button again and choose Allow.");
    await inject(tab.id);
  }
  return (await chrome.tabs.sendMessage(tab.id, request)) as T;
}

export const readPage = () => askPage<PageInfo>({ type: "read-page" });

// today's date where the person is, as 2026-10-08
export function localToday(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
