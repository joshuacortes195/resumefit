import { expect, test as base } from "@playwright/test";

// the app sends a page in pieces and wires each piece up for clicks and typing as it lands.
// a test that types the instant a field shows up can beat that by a few milliseconds and lose what it typed, which no person could do.
// so every full page load here waits until the page has gone quiet before the test carries on
export const test = base.extend({
  page: async ({ page }, use) => {
    const goto = page.goto.bind(page);
    page.goto = (url, options) => goto(url, { waitUntil: "networkidle", ...options });
    await use(page);
  },
});

export { expect };
