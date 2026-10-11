import { expect, test } from "./fixtures";

const MISSING = "00000000-0000-0000-0000-000000000000";

// addresses that point at nothing: ids that are not ids, ids nobody has, a tab that does not exist and a page that was never there
const GONE = ["/scans/abc", `/scans/${MISSING}`, `/tracker/${MISSING}/job`, "/tracker/abc/job", `/tracker/${MISSING}/nonsense`, `/optimize/${MISSING}`, `/builder/${MISSING}`, `/interview/${MISSING}`, `/linkedin/${MISSING}`, "/no-such-page"];

test("an address that points at nothing answers 404 with our own page", async ({ page }) => {
  for (const path of GONE) {
    const response = await page.goto(path);
    expect(response?.status(), `${path} answered ${response?.status()}`).toBe(404);
    await expect(page.getByRole("heading", { name: "We could not find that page" })).toBeVisible();
    // the framework's own plain black page never shows
    await expect(page.getByText("This page could not be found")).toHaveCount(0);
  }

  // inside the app the menu is still there, and the way back works
  await page.goto("/scans/abc");
  await expect(page.getByRole("link", { name: "Application Tracker" }).first()).toBeVisible();
  await page.getByRole("link", { name: "Go to the dashboard" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("pages that are there still answer 200", async ({ request }) => {
  for (const path of ["/dashboard", "/scans", "/tracker", "/scans/sample", "/help"]) expect((await request.get(path)).status(), path).toBe(200);
});
