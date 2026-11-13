// the one application the web app asked us to open, remembered per tab until the browser closes.
// it only says which tracker card and which resume the fill is for. nothing is filled until the person presses the button

export type PendingApply = { jobId: string | null; resumeId: string | null };

const key = (tabId: number) => `apply:${tabId}`;

export async function getPending(tabId: number): Promise<PendingApply | null> {
  const stored = await chrome.storage.session.get(key(tabId));
  return (stored[key(tabId)] as PendingApply | undefined) ?? null;
}

export async function setPending(tabId: number, pending: PendingApply): Promise<void> {
  await chrome.storage.session.set({ [key(tabId)]: pending });
}

export async function clearPending(tabId: number): Promise<void> {
  await chrome.storage.session.remove(key(tabId));
}
