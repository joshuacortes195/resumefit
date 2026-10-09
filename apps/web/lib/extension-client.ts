// talking to the browser extension from the web app. everything here is safe to call when the extension is not installed

// the bit of chrome that lets a web page message an extension
type ChromeRuntime = { sendMessage: (extensionId: string, message: unknown, callback: (response: unknown) => void) => void; lastError?: unknown };

// remembers the extension's id on this computer, since an extension loaded by hand gets a different id on every machine
const ID_KEY = "resumefit-extension-id";

export function savedExtensionId(): string {
  return process.env.NEXT_PUBLIC_EXTENSION_ID ?? (typeof localStorage === "undefined" ? "" : (localStorage.getItem(ID_KEY) ?? ""));
}

export function rememberExtensionId(id: string): void {
  localStorage.setItem(ID_KEY, id.trim());
}

// sends the extension a message, false when it is not there or does not answer
export function tellExtension(message: Record<string, unknown>, extensionId = savedExtensionId()): Promise<boolean> {
  const runtime = (globalThis as unknown as { chrome?: { runtime?: ChromeRuntime } }).chrome?.runtime;
  if (!runtime?.sendMessage || !/^[a-p]{32}$/.test(extensionId)) return Promise.resolve(false);
  return new Promise((resolve) => {
    // give up quietly if nothing comes back
    const timer = setTimeout(() => resolve(false), 1500);
    try {
      runtime.sendMessage(extensionId, message, (response) => {
        clearTimeout(timer);
        resolve(Boolean((response as { ok?: boolean } | undefined)?.ok));
      });
    } catch {
      clearTimeout(timer);
      resolve(false);
    }
  });
}

// the code people paste into the extension when it cannot be reached directly: the app's address and the key, packed together
export function connectionCode(token: string): string {
  return btoa(JSON.stringify({ apiBase: location.origin, token }));
}
