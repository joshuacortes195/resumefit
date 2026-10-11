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
