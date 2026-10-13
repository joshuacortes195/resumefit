import type { Account, LinkedinImport } from "./types";

// where the web app lives and the key that lets us act for the person
export type Connection = { apiBase: string; token: string };

// the saved connection, null when the extension has not been connected yet
export async function getConnection(): Promise<Connection | null> {
  const { connection } = await chrome.storage.local.get("connection");
  return (connection as Connection | undefined) ?? null;
}

export async function saveConnection(connection: Connection | null): Promise<void> {
  if (connection) await chrome.storage.local.set({ connection });
  else await chrome.storage.local.remove(["connection", "account"]);
}

// the copies of the web app this extension was built to talk to, taken from its own manifest.
// someone who hosts their own copy puts its address there and rebuilds
export function trustedApps(): string[] {
  const matches = (chrome.runtime.getManifest() as { externally_connectable?: { matches?: string[] } }).externally_connectable?.matches ?? [];
  return matches.map((match) => match.replace(/\/\*$/, ""));
}

// reads a connection code pasted from the web app. the code is the address and the key, packed together.
// the address has to be one this extension trusts, so a code from a stranger cannot point it at their server
export function parseConnectionCode(code: string, trusted: string[] = trustedApps()): Connection | null {
  try {
    const parsed = JSON.parse(atob(code.trim())) as Partial<Connection>;
    if (typeof parsed.apiBase !== "string" || typeof parsed.token !== "string") return null;
    const url = new URL(parsed.apiBase);
    // a trusted copy of the app over https, or your own machine while developing
    const ownMachine = url.hostname === "localhost";
    if (!ownMachine && (url.protocol !== "https:" || !trusted.includes(url.origin))) return null;
    return { apiBase: url.origin, token: parsed.token };
  } catch {
    return null;
  }
}

// asks the web app whose account a connection is for, without saving anything. null when the key does not work
export async function accountBehind(connection: Connection): Promise<string | null> {
  try {
    const response = await fetch(`${connection.apiBase}/api/ext/me`, { headers: { Authorization: `Bearer ${connection.token}` } });
    if (!response.ok) return null;
    const account = (await response.json()) as Partial<Account>;
    return typeof account.user?.email === "string" ? account.user.email : null;
  } catch {
    return null;
  }
}

// a failed call, with a message that can be shown as is
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

// calls the web app as the connected person
async function call<T>(path: string, body?: unknown): Promise<T> {
  const connection = await getConnection();
  if (!connection) throw new ApiError("Connect the extension to your ResumeFit account first.", 401);
  let response: Response;
  try {
    response = await fetch(`${connection.apiBase}/api/ext/${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: { Authorization: `Bearer ${connection.token}`, ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError("Could not reach ResumeFit. Check your connection and try again.", 0);
  }
  const data = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new ApiError(data.error ?? "Something went wrong. Try again.", response.status);
  return data;
}

export const api = {
  me: () => call<Account>("me"),
  saveJob: (job: { title: string; company?: string; location?: string; url?: string; description?: string }) => call<{ jobId: string; alreadySaved: boolean }>("jobs", job),
  scan: (input: { jdText: string; title?: string; company?: string; url?: string; resumeId?: string; jobId?: string }) => call<{ scanId: string; matchRate: number; missing: string[]; resumeName: string; jobId: string | null }>("scan", input),
  importLinkedin: (profile: LinkedinImport) => call<{ saved: boolean }>("linkedin", profile),
};

