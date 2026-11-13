import { getConnection, type Connection } from "./lib/api";
import { clearPending, setPending } from "./lib/pending";

// the background worker: opens the side panel, owns the right click menu, takes the connection from the web app
// and opens one application in a new tab when the web app asks. it never fills or sends anything itself

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
chrome.runtime.onMessageExternal.addListener((message: { type?: string; token?: string; apiBase?: string; url?: string; jobId?: string; resumeId?: string }, sender, respond) => {
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
      const tab = await chrome.tabs.create({ url, active: true, windowId: sender.tab?.windowId, index: sender.tab ? sender.tab.index + 1 : undefined });
      if (!tab.id) return respond({ ok: false });
      await setPending(tab.id, { jobId: typeof message.jobId === "string" ? message.jobId : null, resumeId: typeof message.resumeId === "string" ? message.resumeId : null });
      // chrome may refuse to open the panel without a click, the toolbar button does it then
      void chrome.sidePanel.open({ tabId: tab.id }).catch(() => undefined);
      respond({ ok: true });
    });
    return true;
  }
  // says we are here, and that this version knows how to fill in applications
  if (message.type === "resumefit-ping") respond({ ok: true, version: chrome.runtime.getManifest().version, autoApply: true });
  return false;
});

// a closed tab takes its note about which job it was for with it
chrome.tabs.onRemoved.addListener((tabId) => void clearPending(tabId));
