import { api, getConnection, type Connection } from "./lib/api";
import { clearPending, setPending } from "./lib/pending";
import { runApplication, type RunJob, type RunOutcome } from "./lib/runner";
import type { PageRequest } from "./lib/types";

// the background worker: opens the side panel, owns the right click menu, takes the connection from the web app
// and opens applications in a new tab when the web app asks. for a person who switched sending on, it also fills and sends them here

// clicking the toolbar button opens the side panel
chrome.runtime.onInstalled.addListener(() => {
  void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  chrome.contextMenus.create({ id: "resumefit-scan-selection", title: "Scan this job description with ResumeFit", contexts: ["selection"] });
});

// right click on highlighted text: remember it and open the panel, which picks it up from there
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== "resumefit-scan-selection" || !info.selectionText || !tab?.id) return;
  void chrome.storage.session.set({ pendingScan: { text: info.selectionText, url: tab.url ?? "", title: tab.title ?? "" } });
  void chrome.sidePanel.open({ tabId: tab.id });
});

// the web app offers a connection.
// an offer is only parked here. it becomes the real connection once the person agrees to it in the side panel,
// so a web page can never point the extension at a different account by itself
chrome.runtime.onMessageExternal.addListener((message: { type?: string; token?: string; apiBase?: string; url?: string; jobId?: string; resumeId?: string; jobs?: unknown }, sender, respond) => {
  const origin = sender.url ? new URL(sender.url).origin : "";
  if (message.type === "resumefit-connect" && message.token && message.apiBase === origin) {
    const offer: Connection = { apiBase: origin, token: message.token };
    void chrome.storage.session.set({ connectionOffer: offer }).then(() => respond({ ok: true }));
    if (sender.tab?.id) void chrome.sidePanel.open({ tabId: sender.tab.id }).catch(() => undefined);
    return true;
  }
  if (message.type === "resumefit-apply" && typeof message.url === "string") {
    // Auto Apply was pressed on a tracker card: open that one posting next to the app and remember which card it is for.
    // only the copy of the app we are connected to may ask, and only for a real https page
    const url = message.url;
    void getConnection().then(async (connection) => {
      if (connection?.apiBase !== origin || !/^https:\/\//.test(url)) return respond({ ok: false });
      const job: RunJob = { url, jobId: typeof message.jobId === "string" ? message.jobId : null, resumeId: typeof message.resumeId === "string" ? message.resumeId : null };
      // a person who asked for their applications to be sent gets this one worked through without the panel
      if (await canRunAlone()) {
        await enqueue([job]);
        return respond({ ok: true, auto: true });
      }
      const tab = await chrome.tabs.create({ url, active: true, windowId: sender.tab?.windowId, index: sender.tab ? sender.tab.index + 1 : undefined });
      if (!tab.id) return respond({ ok: false });
      await setPending(tab.id, { jobId: job.jobId, resumeId: job.resumeId });
      // chrome may refuse to open the panel without a click, the toolbar button does it then
      void chrome.sidePanel.open({ tabId: tab.id }).catch(() => undefined);
      respond({ ok: true, auto: false });
    });
    return true;
  }
  if (message.type === "resumefit-apply-many" && Array.isArray(message.jobs)) {
    // a list of saved jobs to work through one after another. only for a person who switched sending on
    const jobs = (message.jobs as Partial<RunJob>[])
      .filter((job): job is RunJob => typeof job.url === "string" && /^https:\/\//.test(job.url))
      .map((job) => ({ url: job.url, jobId: typeof job.jobId === "string" ? job.jobId : null, resumeId: typeof job.resumeId === "string" ? job.resumeId : null }))
      .slice(0, MAX_QUEUE);
    void getConnection().then(async (connection) => {
      if (connection?.apiBase !== origin || jobs.length === 0 || !(await canRunAlone())) return respond({ ok: false });
      await enqueue(jobs);
      respond({ ok: true, auto: true, queued: jobs.length });
    });
    return true;
  }
  // says we are here, and that this version knows how to fill in applications
  if (message.type === "resumefit-ping") respond({ ok: true, version: chrome.runtime.getManifest().version, autoApply: true, autoSend: true });
  return false;
});

// a closed tab takes its note about which job it was for with it
chrome.tabs.onRemoved.addListener((tabId) => void clearPending(tabId));

// ---- applications worked through without the panel, for a person who switched sending on ----

// the most applications that can wait in line at once
const MAX_QUEUE = 25;
// how long a page gets to load before we carry on with what is there
const LOAD_MS = 30_000;

const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// today's date on the person's own calendar
function today(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

// true when the person switched sending on, has sends left today, and has let us onto pages
async function canRunAlone(): Promise<boolean> {
  const account = await api.me().catch(() => null);
  if (!account?.autoApply || !account.profile || (account.profile.autoSend ?? "off") === "off" || (account.sendsLeft ?? 0) <= 0) return false;
  return chrome.permissions.contains({ origins: ["https://*/*"] });
}

// waits until a tab has finished loading, or long enough
async function loaded(tabId: number): Promise<void> {
  for (let waited = 0; waited < LOAD_MS; waited += 500) {
    const tab = await chrome.tabs.get(tabId).catch(() => null);
    if (!tab) throw new Error("The tab was closed.");
    if (tab.status === "complete") break;
    await pause(500);
  }
  // forms built in the browser need a moment after the page itself is done
  await pause(1500);
}

// asks the page script in one tab something, adding it to the page first when it is not there
async function askTab<T>(tabId: number, request: PageRequest): Promise<T> {
  try {
    return (await chrome.tabs.sendMessage(tabId, request)) as T;
  } catch {
    // not there yet, or the page moved on since
  }
  await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
  return (await chrome.tabs.sendMessage(tabId, request)) as T;
}

// adds jobs to the line and starts on it
async function enqueue(jobs: RunJob[]): Promise<void> {
  const { applyQueue = [] } = (await chrome.storage.session.get("applyQueue")) as { applyQueue?: RunJob[] };
  await chrome.storage.session.set({ applyQueue: [...applyQueue, ...jobs].slice(0, MAX_QUEUE) });
  void drain();
}

// true while the line is being worked through, so two runs never overlap
let draining = false;

// works through the line one application at a time
async function drain(): Promise<void> {
  if (draining) return;
  draining = true;
  let sent = 0;
  let left = 0;
  try {
    for (;;) {
      const { applyQueue = [] } = (await chrome.storage.session.get("applyQueue")) as { applyQueue?: RunJob[] };
      const [job, ...rest] = applyQueue;
      if (!job) break;
      await chrome.storage.session.set({ applyQueue: rest });
      const outcome = await runOne(job);
      if (outcome.sent) sent++;
      else left++;
    }
  } finally {
    draining = false;
  }
  if (sent + left > 1) note("Auto Apply finished", `${sent} sent, ${left} left filled in for you to finish.`);
}

// one application from start to finish in a tab of its own
async function runOne(job: RunJob): Promise<RunOutcome> {
  let tabId: number | undefined;
  let outcome: RunOutcome;
  try {
    // the person's rules are read fresh every time, so a change or a used up day takes hold at once
    const account = await api.me();
    if ((account.profile?.autoSend ?? "off") === "off" || (account.sendsLeft ?? 0) <= 0) throw new Error("You have reached the number of applications you let us send in a day.");
    const tab = await chrome.tabs.create({ url: job.url, active: false });
    tabId = tab.id;
    if (tabId === undefined) throw new Error("The tab could not be opened.");
    const id = tabId;
    await setPending(id, { jobId: job.jobId, resumeId: job.resumeId });
    await loaded(id);
    outcome = await runApplication(account, job, {
      ask: (request) => askTab(id, request),
      goTo: async (url) => {
        await chrome.tabs.update(id, { url });
        await pause(500);
        await loaded(id);
      },
      report: api.reportApplication,
      today: today(),
    });
  } catch (problem) {
    outcome = { sent: false, reason: problem instanceof Error ? problem.message : "Something went wrong.", filled: 0, needs: 0 };
  }
  if (outcome.sent) {
    // a sent application has nothing left to look at
    if (tabId !== undefined) void chrome.tabs.remove(tabId).catch(() => undefined);
    note("Application sent", "It is on your tracker under Applied, with the answers that went out.");
  } else {
    note("Application left for you", `${outcome.reason ?? "It was not sent."} The tab is open with what we filled in.`);
  }
  return outcome;
}

// a small heads up from the corner of the screen
function note(title: string, message: string): void {
  void chrome.notifications?.create({ type: "basic", iconUrl: "icon-128.png", title, message });
}

// the worker can be put to sleep mid line, so anything still waiting is picked up when it wakes
void drain();
