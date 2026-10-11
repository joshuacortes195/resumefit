import { expect, test } from "./fixtures";

// pages that show dates or times. by this point in the run the earlier tests have left scans, resumes, jobs and sessions behind
const PAGES = ["/scans", "/resumes", "/tracker", "/dashboard", "/interview", "/linkedin", "/extension", "/admin", "/settings", "/jobs"];

// two timezones at the far ends of the clock. whatever the time is when this runs, in at least one of them
// today's date is not the same as the server's, which is exactly when the server and the browser used to write different text
for (const timezoneId of ["Pacific/Kiritimati", "Pacific/Pago_Pago"]) {
  test.describe(`a reader in ${timezoneId}`, () => {
    test.use({ timezoneId });

    test("no page writes one thing on the server and another in the browser", async ({ page }) => {
      const problems: string[] = [];
      const note = (text: string) => {
        if (/hydrat|#418|#423|#425|did not match|server rendered/i.test(text)) problems.push(`${page.url()}: ${text.slice(0, 200)}`);
      };
      page.on("pageerror", (error) => note(error.message));
      page.on("console", (message) => {
        if (message.type() === "error") note(message.text());
      });
      for (const path of PAGES) await page.goto(path);
      // a job's card has interview and practice dates on it too
      await page.goto("/tracker");
      const card = page.getByRole("listitem").getByRole("link").first();
      if (await card.count()) {
        await card.click();
        await expect(page).toHaveURL(/\/tracker\/[0-9a-f-]{36}\//);
        await page.reload();
      }
      expect(problems).toEqual([]);
    });

    test("dates are the reader's own, not the server's", async ({ page }) => {
      await page.goto("/scans");
      const shown = page.locator("tbody time").first();
      await expect(shown).toBeVisible();
      const iso = (await shown.getAttribute("datetime")) ?? "";
      // what that moment is called on this reader's calendar
      const local = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: timezoneId }).format(new Date(iso));
      await expect(shown).toHaveText(local);
    });
  });
}
