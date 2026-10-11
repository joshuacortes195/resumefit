import { expect, test } from "@playwright/test";

// every page and endpoint that shows one person's data
const PRIVATE = ["/dashboard", "/tracker", "/scans", "/scans/new", "/resumes", "/jobs", "/builder", "/optimize", "/cover-letter", "/linkedin", "/interview", "/extension", "/settings", "/api/export", "/api/ext/me"];

test("nothing that depends on who is signed in can be kept by a shared cache", async ({ request }) => {
  for (const path of PRIVATE) {
    const response = await request.get(path, { maxRedirects: 0 });
    const cache = response.headers()["cache-control"] ?? "";
    expect(cache, `${path} answered with cache-control "${cache}"`).toContain("private");
    expect(cache, `${path} answered with cache-control "${cache}"`).toContain("no-store");
    expect(cache).not.toContain("public");
  }
});

// pages that load the most script: the board, the report, the builder and the forms
const PAGES = ["/sign-in", "/dashboard", "/tracker", "/scans", "/scans/new", "/scans/sample", "/resumes", "/jobs", "/builder", "/optimize", "/cover-letter", "/linkedin", "/interview", "/extension", "/settings", "/help", "/privacy"];

test("scripts only run with this request's code, and no page trips the content policy", async ({ page, request }) => {
  // the policy names a code, never lets inline script through, and the code is new every time
  const policies = await Promise.all([request.get("/dashboard"), request.get("/dashboard")].map(async (response) => (await response).headers()["content-security-policy"] ?? ""));
  const scripts = (policy: string) => policy.split(";").find((part) => part.trim().startsWith("script-src")) ?? "";
  expect(scripts(policies[0] ?? "")).toMatch(/'nonce-[A-Za-z0-9+/=]+'/);
  expect(scripts(policies[0] ?? "")).not.toContain("unsafe-inline");
  expect(scripts(policies[0] ?? "")).not.toContain("unsafe-eval");
  expect(scripts(policies[0] ?? "")).not.toBe(scripts(policies[1] ?? ""));

  // anything the browser refuses to run or load shows up here
  const refused: string[] = [];
  page.on("console", (message) => {
    if (/content security policy/i.test(message.text())) refused.push(`${page.url()}: ${message.text()}`);
  });
  for (const path of PAGES) {
    await page.goto(path);
    // the page has to come alive, not just arrive: a blocked script would leave it dead
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await page.waitForLoadState("networkidle");
  }
  // and the menu still works, which needs the page's own scripts to have run
  await page.goto("/dashboard");
  await page.getByRole("link", { name: "Scan History" }).first().click();
  await expect(page).toHaveURL(/\/scans$/);
  expect(refused).toEqual([]);
});

test("script written into the page without the code is refused", async ({ page }) => {
  await page.goto("/help");
  const result = await page.evaluate(async () => {
    const refused: string[] = [];
    document.addEventListener("securitypolicyviolation", (event) => refused.push(event.violatedDirective));
    // the ways injected markup tries to run: a handler written on an element, and a link that is really script
    const holder = document.createElement("div");
    holder.innerHTML = '<img src="/missing.png" onerror="window.__handler = true"><a id="trap" href="javascript:window.__link = true">x</a>';
    document.body.appendChild(holder);
    document.getElementById("trap")?.click();
    await new Promise((resolve) => setTimeout(resolve, 500));
    const flags = window as unknown as { __handler?: boolean; __link?: boolean };
    return { handler: flags.__handler === true, link: flags.__link === true, refused };
  });
  expect(result.handler).toBe(false);
  expect(result.link).toBe(false);
  expect(result.refused.length).toBeGreaterThanOrEqual(2);
});
