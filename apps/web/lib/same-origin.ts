// what a browser says about where a request came from when it leaves out the origin. only these two mean another site
const OTHER_SITE = new Set(["cross-site", "same-site"]);

// true when a request that changes something through the api was sent by a page on another site.
// browsers say where such a request came from, and the app's own pages are the only ones that should be making them.
// the extension's endpoints are left out, they are opened to it on purpose and ask for its key instead of a session
export function fromAnotherSite(request: Request): boolean {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return false;
  const { pathname, host } = new URL(request.url);
  if (!pathname.startsWith("/api/") || pathname.startsWith("/api/ext/")) return false;
  const origin = request.headers.get("origin");
  // no origin at all: fall back on the browser's own note about the sender, so a page that gets its origin stripped is still turned away.
  // a request with neither comes from a script or a tool, not a browser, so it carries no one's cookies by accident
  if (!origin) return OTHER_SITE.has(request.headers.get("sec-fetch-site") ?? "");
  try {
    const from = new URL(origin).host;
    return from !== host && from !== request.headers.get("host");
  } catch {
    // "null" and anything else that is not a real address, like a sandboxed frame or a file
    return true;
  }
}
