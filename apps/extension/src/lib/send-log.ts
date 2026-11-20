import type { Account } from "./types";
import { withLocalCap } from "./send";

// this browser's own list of when it sent an application for the person, kept so the daily number holds
// even when a report to the app goes missing

const KEY = "sentLog";
const DAY_MS = 86_400_000;

// the sends from the last day
async function recent(): Promise<number[]> {
  const stored = (await chrome.storage.local.get(KEY)) as { sentLog?: unknown };
  const now = Date.now();
  return Array.isArray(stored.sentLog) ? stored.sentLog.filter((at): at is number => typeof at === "number" && now - at < DAY_MS) : [];
}

// the account with this browser's count of sends taken into account too
export async function cappedAccount(account: Account): Promise<Account> {
  return withLocalCap(account, await recent().catch(() => []));
}

// writes down one send, dropping anything older than a day
export async function noteSend(): Promise<void> {
  const list = await recent().catch(() => []);
  await chrome.storage.local.set({ [KEY]: [...list, Date.now()].slice(-50) });
}
