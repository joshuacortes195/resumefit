// talking to the browser extension from the web app. everything here is safe to call when the extension is not installed

// the bit of chrome that lets a web page message an extension
type ChromeRuntime = { sendMessage: (extensionId: string, message: unknown, callback: (response: unknown) => void) => void; lastError?: unknown };

// remembers the extension's id on this computer, since an extension loaded by hand gets a different id on every machine
const ID_KEY = "resumefit-extension-id";

export function savedExtensionId(): string {
  return process.env.NEXT_PUBLIC_EXTENSION_ID || (typeof localStorage === "undefined" ? "" : (localStorage.getItem(ID_KEY) ?? ""));
}

export function rememberExtensionId(id: string): void {
  localStorage.setItem(ID_KEY, id.trim());
}

// asks the extension something and hands back its answer, null when it is not there or does not answer
export function askExtension<T extends { ok?: boolean }>(message: Record<string, unknown>, extensionId = savedExtensionId(), waitMs = 1500): Promise<T | null> {
  const runtime = (globalThis as unknown as { chrome?: { runtime?: ChromeRuntime } }).chrome?.runtime;
  if (!runtime?.sendMessage || !/^[a-p]{32}$/.test(extensionId)) return Promise.resolve(null);
  return new Promise((resolve) => {
    // give up quietly if nothing comes back
    const timer = setTimeout(() => resolve(null), waitMs);
    try {
      runtime.sendMessage(extensionId, message, (response) => {
        clearTimeout(timer);
        resolve((response as T | undefined) ?? null);
      });
    } catch {
      clearTimeout(timer);
      resolve(null);
    }
  });
}

// sends the extension a message, false when it is not there or does not answer
export async function tellExtension(message: Record<string, unknown>, extensionId = savedExtensionId()): Promise<boolean> {
  return Boolean((await askExtension(message, extensionId))?.ok);
}

// what the extension on this computer can do. hands free means it opens and fills applications by itself
export type ExtensionState = { installed: boolean; canApply: boolean; canSubmit: boolean; handsFree: boolean };

// finds out whether the extension is here and new enough to open and fill applications for us
export async function extensionState(): Promise<ExtensionState> {
  const answer = await askExtension<{ ok?: boolean; version?: string; handsFree?: boolean }>({ type: "resumefit-ping" });
  const [major = 0, minor = 0] = (answer?.version ?? "").split(".").map(Number);
  const atLeast = (wanted: number) => Boolean(answer?.ok) && (major > 0 || minor >= wanted);
  return { installed: Boolean(answer?.ok), canApply: atLeast(2), canSubmit: atLeast(3), handsFree: answer?.handsFree === true };
}

// one application for the extension to open and fill
export type ApplyRequest = { url: string; jobId: string; resumeId?: string };

// hands applications to the extension, which opens each one and fills it in. false when it did not take them
export async function sendApplications(jobs: ApplyRequest[]): Promise<boolean> {
  return Boolean((await askExtension({ type: "resumefit-apply", jobs }, savedExtensionId(), 4000))?.ok);
}

// the code people paste into the extension when it cannot be reached directly: the app's address and the key, packed together
export function connectionCode(token: string): string {
  return btoa(JSON.stringify({ apiBase: location.origin, token }));
}
