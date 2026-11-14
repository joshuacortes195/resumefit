// talking to the browser extension from the web app. everything here is safe to call when the extension is not installed

// the bit of chrome that lets a web page message an extension
type ChromeRuntime = { sendMessage: (extensionId: string, message: unknown, callback: (response: unknown) => void) => void; lastError?: unknown };

// remembers the extension's id on this computer, since an extension loaded by hand gets a different id on every machine
const ID_KEY = "resumefit-extension-id";

// the id every copy of the extension has since 0.7.1, which carries a key in its manifest. older copies got a different id on every machine
export const SHIPPED_EXTENSION_ID = "nhdphcemdobhiagipodpmpmgpdpcfkij";

export function savedExtensionId(): string {
  // an id set for this copy of the app wins, then one the person typed in for an older extension, then the one the download has
  return process.env.NEXT_PUBLIC_EXTENSION_ID || (typeof localStorage === "undefined" ? "" : (localStorage.getItem(ID_KEY) ?? "")) || SHIPPED_EXTENSION_ID;
}

export function rememberExtensionId(id: string): void {
  localStorage.setItem(ID_KEY, id.trim());
}

// what the extension says back. auto is true when it took the application on by itself
export type ExtensionReply = { ok: boolean; auto?: boolean; queued?: number };

// sends the extension a message and hands back its answer. ok is false when it is not there or does not answer
export function askExtension(message: Record<string, unknown>, extensionId = savedExtensionId(), waitMs = 1500): Promise<ExtensionReply> {
  const runtime = (globalThis as unknown as { chrome?: { runtime?: ChromeRuntime } }).chrome?.runtime;
  if (!runtime?.sendMessage || !/^[a-p]{32}$/.test(extensionId)) return Promise.resolve({ ok: false });
  return new Promise((resolve) => {
    // give up quietly if nothing comes back
    const timer = setTimeout(() => resolve({ ok: false }), waitMs);
    try {
      runtime.sendMessage(extensionId, message, (response) => {
        clearTimeout(timer);
        const reply = (response ?? {}) as Partial<ExtensionReply>;
        resolve({ ok: reply.ok === true, auto: reply.auto === true, queued: typeof reply.queued === "number" ? reply.queued : undefined });
      });
    } catch {
      clearTimeout(timer);
      resolve({ ok: false });
    }
  });
}

// how ready the extension is, as it tells us itself. installed is false when nothing answered
export type ExtensionState = { installed: boolean; connected: boolean; allowed: boolean; version: string | null };

// asks the extension whether it is there, connected to this copy of the app and allowed onto job pages
export function extensionState(extensionId = savedExtensionId()): Promise<ExtensionState> {
  const none: ExtensionState = { installed: false, connected: false, allowed: false, version: null };
  const runtime = (globalThis as unknown as { chrome?: { runtime?: ChromeRuntime } }).chrome?.runtime;
  if (!runtime?.sendMessage || !/^[a-p]{32}$/.test(extensionId)) return Promise.resolve(none);
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(none), 1500);
    try {
      runtime.sendMessage(extensionId, { type: "resumefit-ping" }, (response) => {
        clearTimeout(timer);
        const reply = (response ?? {}) as { ok?: boolean; connected?: boolean; allowed?: boolean; version?: string };
        resolve(reply.ok ? { installed: true, connected: reply.connected === true, allowed: reply.allowed === true, version: reply.version ?? null } : none);
      });
    } catch {
      clearTimeout(timer);
      resolve(none);
    }
  });
}

// sends the extension a message, false when it is not there or does not answer
export async function tellExtension(message: Record<string, unknown>, extensionId = savedExtensionId()): Promise<boolean> {
  return (await askExtension(message, extensionId)).ok;
}

// the code people paste into the extension when it cannot be reached directly: the app's address and the key, packed together
export function connectionCode(token: string): string {
  return btoa(JSON.stringify({ apiBase: location.origin, token }));
}

// asks the extension to open one application in a new tab, where its side panel can fill the form in for the person to check.
// false when the link is not a secure one, or the extension is not there to ask
// for a person who switched sending on, the extension works through it by itself instead, and says so with auto.
// it checks with the app before answering, so it gets a little longer
export function startAutoApply(job: { jobId: string; url: string | null; resumeId?: string | null }): Promise<ExtensionReply> {
  if (!job.url || !/^https:\/\//.test(job.url)) return Promise.resolve({ ok: false });
  return askExtension({ type: "resumefit-apply", url: job.url, jobId: job.jobId, resumeId: job.resumeId ?? null }, savedExtensionId(), 6000);
}

// hands the extension a list of saved jobs to fill in and send one after another. only works for a person who switched sending on
export function startAutoApplyMany(jobs: { jobId: string; url: string }[]): Promise<ExtensionReply> {
  const usable = jobs.filter((job) => /^https:\/\//.test(job.url));
  if (usable.length === 0) return Promise.resolve({ ok: false });
  return askExtension({ type: "resumefit-apply-many", jobs: usable.map((job) => ({ url: job.url, jobId: job.jobId, resumeId: null })) }, savedExtensionId(), 6000);
}
