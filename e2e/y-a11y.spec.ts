import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// this file runs near the end on purpose, so the pages are full of what the other tests made

// the pages people spend their time on
const PAGES = ["/dashboard", "/scans/sample", "/scans", "/tracker", "/resumes", "/builder", "/optimize", "/cover-letter", "/linkedin", "/interview", "/jobs", "/extension", "/settings", "/help", "/sign-in", "/privacy"];

// runs the accessibility checker and returns the problems that would really get in someone's way
async function problems(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  return results.violations.filter((violation) => violation.impact === "serious" || violation.impact === "critical").map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(" ")).slice(0, 3).join(" | ")}`);
}

test("pages pass the accessibility checks", async ({ page }) => {
  test.setTimeout(120_000);
  for (const path of PAGES) {
    await page.goto(path);
    // let the content and the little entrance animations settle
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(700);
    expect(await problems(page), path).toEqual([]);
  }
});

test("pages fit a phone screen without scrolling sideways", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 740 });
  for (const path of PAGES) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `${path} is ${overflow}px wider than the screen`).toBeLessThanOrEqual(1);
  }
});
