import type { Run } from "./types";

// the applications being opened and filled, remembered per tab until the browser closes

const key = (tabId: number) => `run:${tabId}`;

export async function getRun(tabId: number): Promise<Run | null> {
  const stored = await chrome.storage.session.get(key(tabId));
  return (stored[key(tabId)] as Run | undefined) ?? null;
}

export async function setRun(tabId: number, run: Run): Promise<void> {
  await chrome.storage.session.set({ [key(tabId)]: run });
}

export async function clearRun(tabId: number): Promise<void> {
  await chrome.storage.session.remove(key(tabId));
}

// the storage key the side panel listens on to hear about a tab's run
export const runKey = key;

// a run that has just been asked for
export const newRun = (url: string, jobId: string | null = null, resumeId: string | null = null): Run => ({ jobId, resumeId, hops: 0, stage: "opening", url, filled: 0, needs: 0 });
