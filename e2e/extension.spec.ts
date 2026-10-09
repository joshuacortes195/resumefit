import path from "node:path";
import { chromium, expect, test } from "@playwright/test";

// where the built extension lives, see apps/extension/build.mjs
const EXTENSION = path.join(__dirname, "../apps/extension/dist");

test("the built extension loads and connects with a pasted code", async () => {
  // extensions only load in a browser profile of their own
  const context = await chromium.launchPersistentContext("", { channel: "chromium", args: [`--disable-extensions-except=${EXTENSION}`, `--load-extension=${EXTENSION}`] });
  try {
    // the background worker starting up is the sign that the manifest and scripts are valid
    const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"));
    const extensionId = new URL(worker.url()).host;

    // the side panel opens on the connect screen
    const panel = await context.newPage();
    await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`);
    await expect(panel.getByRole("heading", { name: "Connect to ResumeFit" })).toBeVisible();

    // junk is turned away
    await panel.getByLabel("Connection code").fill("not a real code");
    await panel.getByRole("button", { name: "Connect" }).click();
    await expect(panel.getByRole("alert")).toContainText("does not look like a connection code");

    // so is a code that points at an address that is not secure
    await panel.getByLabel("Connection code").fill(btoa(JSON.stringify({ apiBase: "http://evil.example", token: "rf_x" })));
    await panel.getByRole("button", { name: "Connect" }).click();
    await expect(panel.getByRole("alert")).toContainText("does not look like a connection code");

    // only the permissions it needs up front, sites are asked for one at a time
    const manifest = await worker.evaluate(() => chrome.runtime.getManifest());
    expect(manifest.host_permissions ?? []).toEqual([]);
    expect(manifest.permissions).not.toContain("<all_urls>");
    expect(manifest.optional_host_permissions).toContain("https://*/*");
  } finally {
    await context.close();
  }
});
