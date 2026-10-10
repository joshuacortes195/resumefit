import { adapterFor, HANDS_FREE_ORIGINS } from "./lib/adapters";
import { api, getConnection, type Connection } from "./lib/api";
import { fillEverything, pickResume, tally, type Ask } from "./lib/pipeline";
import { clearRun, getRun, newRun, setRun } from "./lib/runs";
import type { BarState, PageInfo, Run, WorkerRequest } from "./lib/types";
import { localToday } from "./sidepanel/page";

// the background worker: opens the side panel, owns the right click menu, takes the connection from the web app
// and, when the web app asks, opens an application and fills it in. it never presses submit

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

// the web app offers a connection, or asks us to get ready to fill a job it just opened.
// an offer is only parked here. it becomes the real connection once the person agrees to it in the side panel,
// so a web page can never point the extension at a different account by itself
chrome.runtime.onMessageExternal.addListener((message: { type?: string; token?: string; apiBase?: string; jobId?: string; jobs?: ApplyRequest[] }, sender, respond) => {
  const origin = sender.url ? new URL(sender.url).origin : "";
  if (message.type === "resumefit-connect" && message.token && message.apiBase === origin) {
    const offer: Connection = { apiBase: origin, token: message.token };
    void chrome.storage.session.set({ connectionOffer: offer }).then(() => respond({ ok: true }));
    if (sender.tab?.id) void chrome.sidePanel.open({ tabId: sender.tab.id }).catch(() => undefined);
    return true;
  }
  if (message.type === "resumefit-autofill" && message.jobId) {
    // only the site we are already connected to may line up a job
    void getConnection().then(async (connection) => {
      if (connection?.apiBase !== origin) return respond({ ok: false });
      await chrome.storage.session.set({ pendingJobId: message.jobId });
      respond({ ok: true });
    });
    return true;
  }
  if (message.type === "resumefit-apply" && Array.isArray(message.jobs)) {
    // Auto Apply was pressed: open each application in a tab of its own and fill it in when it has loaded
    void getConnection().then(async (connection) => {
      if (connection?.apiBase !== origin) return respond({ ok: false });
      const jobs = (message.jobs ?? []).filter((job): job is ApplyRequest & { url: string } => typeof job?.url === "string" && /^https:\/\//.test(job.url)).slice(0, MAX_AT_ONCE);
      let opened = 0;
      for (const job of jobs) {
        // the first one opens in front, the rest wait behind it
        const tab = await chrome.tabs.create({ url: job.url, active: opened === 0, windowId: sender.tab?.windowId, index: sender.tab ? sender.tab.index + 1 + opened : undefined });
        if (!tab.id) continue;
        const run = newRun(job.url, typeof job.jobId === "string" ? job.jobId : null, typeof job.resumeId === "string" ? job.resumeId : null);
        await setRun(tab.id, run);
        void report(run, "queued", null);
        opened++;
      }
      respond({ ok: opened > 0, opened });
    });
    return true;
  }
  if (message.type === "resumefit-ping") {
    // also says whether we may fill the big job sites without being opened by hand
    void chrome.permissions.contains({ origins: HANDS_FREE_ORIGINS }).then((handsFree) => respond({ ok: true, version: chrome.runtime.getManifest().version, handsFree }));
    return true;
  }
  return false;
});

// one application the web app wants opened
type ApplyRequest = { url?: string; jobId?: string; resumeId?: string };

// how many applications one press may open, so nobody ends up with a wall of tabs
const MAX_AT_ONCE = 5;

// tells the web app how an application is going. a failed report never stops the fill
function report(run: Run, status: "queued" | "autofilling" | "needs_review" | "applied" | "failed", ats: string | null): Promise<unknown> {
  return api.reportApplication({ jobId: run.jobId, ats, applyUrl: run.url, status, fieldsFilled: run.filled, fieldsNeedingAttention: run.needs, today: localToday() }).catch(() => undefined);
}

// the run's tab finished loading, or the person asked for another go: find the form and fill it
async function advance(tabId: number, force = false): Promise<void> {
  let run = await getRun(tabId);
  if (!run || run.stage === "filling" || run.stage === "applied") return;
  const ask: Ask = (request) => chrome.tabs.sendMessage(tabId, request);
  const say = (bar: BarState) => ask({ type: "show-bar", bar }).catch(() => undefined);

  // put our page script in. on a site we were never let onto this fails, and the side panel takes over
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
  } catch {
    await setRun(tabId, { ...run, stage: "blocked" });
    void chrome.action.setBadgeBackgroundColor({ color: "#a34707" });
    void chrome.action.setBadgeText({ tabId, text: "1" });
    void chrome.notifications?.create({ type: "basic", iconUrl: "icon-128.png", title: "One click to fill this application", message: "Click the ResumeFit icon in the toolbar and we fill it in." });
    return;
  }
  void chrome.action.setBadgeText({ tabId, text: "" });

  try {
    const page = await ask<PageInfo>({ type: "read-page" });

    // the form is gone and the page says thanks: the person sent it
    if (run.stage === "review" && page.confirmed && !page.hasForm) return await finish(tabId);

    if (!page.hasForm) {
      // after a fill, a page without a form just means they moved on
      if (run.stage === "review") return;
      // a posting, not the form: follow its Apply link, a couple of times at most
      const link = run.hops < 2 ? await ask<string | null>({ type: "find-apply" }) : null;
      if (link) {
        await setRun(tabId, { ...run, hops: run.hops + 1 });
        await chrome.tabs.update(tabId, { url: link });
      } else await say({ state: "no-form" });
      return;
    }

    // a form that is already filled in is left alone, unless the person asked for another go
    if (run.stage === "review" && !force && page.fields.some((field) => field.status !== "skipped")) return;

    run = { ...run, stage: "filling", url: page.url };
    await setRun(tabId, run);
    await say({ state: "working" });
    void report(run, "autofilling", page.ats?.name ?? null);

    const account = await api.me();
    const fields = await fillEverything(ask, account, { resumeId: pickResume(account, run.jobId, run.resumeId), jobId: run.jobId, jdText: page.job?.description ?? "" });
    run = { ...run, ...tally(fields), stage: "review" };
    await setRun(tabId, run);
    void report(run, "needs_review", page.ats?.name ?? null);
    await say({ state: "done", filled: run.filled, needs: run.needs, captcha: page.captcha, multiPage: adapterFor(new URL(page.url).hostname).multiPage === true });
  } catch (problem) {
    // back to waiting, so Fill again or a reload can have another go
    await setRun(tabId, { ...run, stage: "opening" });
    void report(run, "failed", null);
    await say({ state: "error", message: problem instanceof Error ? problem.message : "Something went wrong. Try again." });
  }
}

// the application went through: move the job to Applied and say so
async function finish(tabId: number): Promise<void> {
  const run = await getRun(tabId);
  if (!run || run.stage !== "review") return;
  await setRun(tabId, { ...run, stage: "applied" });
  const adapter = adapterFor(new URL(run.url).hostname);
  await report({ ...run, needs: 0 }, "applied", adapter.id === "generic" ? null : adapter.name);
  void chrome.notifications?.create({ type: "basic", iconUrl: "icon-128.png", title: "Application sent", message: "We marked it as applied on your tracker." });
  void chrome.tabs.sendMessage(tabId, { type: "show-bar", bar: { state: "applied" } }).catch(() => undefined);
}

// every page load in a tab with a run moves that run along
chrome.tabs.onUpdated.addListener((tabId, change) => {
  if (change.status === "complete") void advance(tabId);
});

// a closed tab takes its run with it
chrome.tabs.onRemoved.addListener((tabId) => void clearRun(tabId));

// the bar on the page and the side panel ask for things here
chrome.runtime.onMessage.addListener((message: WorkerRequest, sender) => {
  const tabId = message.type === "rf-advance" ? message.tabId : sender.tab?.id;
  if (!tabId) return false;
  if (message.type === "rf-confirmed") void finish(tabId);
  else if (message.type === "rf-refill" || message.type === "rf-advance") {
    void (async () => {
      const run = await getRun(tabId);
      // Fill again on a page we did not open still works, it just has no job to tie to
      if (!run) await setRun(tabId, newRun(sender.tab?.url ?? ""));
      else if (run.stage === "blocked") await setRun(tabId, { ...run, stage: "opening" });
      await advance(tabId, true);
    })();
  }
  return false;
});
