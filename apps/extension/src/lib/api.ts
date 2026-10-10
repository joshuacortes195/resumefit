import type { Account, FieldKey, LinkedinImport } from "./types";

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

// reads a connection code pasted from the web app. the code is the address and the key, packed together
export function parseConnectionCode(code: string): Connection | null {
  try {
    const parsed = JSON.parse(atob(code.trim())) as Partial<Connection>;
    if (typeof parsed.apiBase !== "string" || typeof parsed.token !== "string") return null;
    const url = new URL(parsed.apiBase);
    // only secure addresses, or your own machine while developing
    if (url.protocol !== "https:" && url.hostname !== "localhost") return null;
    return { apiBase: url.origin, token: parsed.token };
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
  scan: (input: { jdText: string; title?: string; company?: string; url?: string; resumeId?: string; jobId?: string }) => call<{ scanId: string; matchRate: number; missing: string[]; resumeName: string }>("scan", input),
  resumeFile: (id: string) => call<{ name: string; type: string; base64: string }>(`resumes/${id}`),
  answer: (input: { question: string; jdText: string; resumeId?: string; jobId?: string }) => call<{ answer: string; source: "saved" | "ai"; remaining?: number | null }>("answer", input),
  saveAnswer: (entry: { question: string; answer: string }) => call<{ saved: boolean }>("qa", entry),
  importLinkedin: (profile: LinkedinImport) => call<{ saved: boolean }>("linkedin", profile),
  reportApplication: (report: { jobId: string | null; ats: string | null; applyUrl: string; status: string; fieldsFilled: number; fieldsNeedingAttention: number; today?: string }) => call<{ id: string }>("applications", report),
};

// used when filling, kept here so the panel and the tests agree on the shape
export type Values = Partial<Record<FieldKey, string>>;
