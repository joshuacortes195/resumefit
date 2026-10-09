import { expect, test } from "@playwright/test";

// this file runs last on purpose: its final test deletes the account the other tests share

test("the admin page creates invite codes and changes caps", async ({ page }) => {
  await page.goto("/settings");
  await page.getByRole("link", { name: "Open the admin page" }).click();
  await expect(page.getByRole("heading", { name: "Invite codes" })).toBeVisible();

  // a code that can be used three times
  await page.getByLabel("Uses").fill("3");
  await page.getByRole("button", { name: "Create code" }).click();
  await expect(page.getByText("Invite code created.")).toBeVisible();
  const row = page.getByRole("row", { name: /0 of 3/ });
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: /Revoke/ }).click();
  await expect(page.getByRole("row", { name: /0 of 3/ })).toHaveCount(0);

  // caps have to be sensible numbers
  await page.getByLabel("Cover letters").fill("-4");
  await page.getByRole("button", { name: "Save caps" }).click();
  await expect(page.getByText("Caps have to be whole numbers from 0 to 1000.")).toBeVisible();
  await page.getByLabel("Cover letters").fill("7");
  await page.getByRole("button", { name: "Save caps" }).click();
  await expect(page.getByText("Caps saved.")).toBeVisible();
  await page.goto("/settings");
  await expect(page.locator("#ai").getByText("Cover letters").locator("..")).toContainText(/[0-7]$/);

  // the other tests used the writing features, and it shows here
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "AI usage, last 14 days" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Users \(\d+\)/ })).toBeVisible();
});

test("the help page answers open when clicked", async ({ page }) => {
  await page.goto("/help");
  await page.getByText("What score should I aim for?").click();
  await expect(page.getByText(/75% or more/)).toBeVisible();
});

test("download everything, then delete the account", async ({ page }) => {
  // something to export
  await page.goto("/tracker");
  await page.getByRole("button", { name: "Add Job" }).click();
  await page.getByLabel("Job title").fill("Last Job Standing");
  await page.getByRole("button", { name: "Add job", exact: true }).click();
  await expect(page.getByRole("link", { name: /Last Job Standing/ })).toBeVisible();

  await page.goto("/settings");
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download everything" }).click();
  expect((await download).suggestedFilename()).toBe("resumefit-export.zip");

  // deleting needs the words typed out
  await page.getByRole("button", { name: "Delete my account" }).click();
  const confirm = page.getByRole("button", { name: "Delete everything" });
  await expect(confirm).toBeDisabled();
  await page.getByLabel(/Type delete my account to confirm/).fill("delete my account");
  await confirm.click();
  await expect(page).toHaveURL(/\/sign-in$/);

  // a fresh start: nothing from before is left
  await page.goto("/tracker");
  await expect(page.getByRole("button", { name: "Add Job" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Last Job Standing/ })).toHaveCount(0);
  await page.goto("/scans");
  await expect(page.getByText("No scans yet")).toBeVisible();
});
