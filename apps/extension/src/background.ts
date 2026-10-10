import { getConnection, type Connection } from "./lib/api";

// the background worker: opens the side panel, owns the right click menu and takes the connection from the web app

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
chrome.runtime.onMessageExternal.addListener((message: { type?: string; token?: string; apiBase?: string; jobId?: string }, sender, respond) => {
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
  if (message.type === "resumefit-ping") respond({ ok: true, version: chrome.runtime.getManifest().version });
  return false;
});
