import { NextRequest } from "next/server";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// a pretend sign in service, so the real sign in library runs against it
vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://auth.test";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
});

// the cookie jar the callback reads and writes, kept in memory
type Jar = Map<string, { value: string; options?: Record<string, unknown> }>;
const jar: Jar = new Map();
const deleted: string[] = [];
vi.mock("next/headers", () => ({
  cookies: async () => ({
    getAll: () => [...jar].map(([name, { value }]) => ({ name, value })),
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)?.value } : undefined),
    set: (name: string, value: string, options?: Record<string, unknown>) => {
      if (options?.maxAge === 0) jar.delete(name);
      else jar.set(name, { value, options });
    },
    delete: (name: string) => {
      deleted.push(name);
      jar.delete(name);
    },
  }),
}));

// letting the person in always works here, the invite rules have their own tests
vi.mock("@/lib/data/users", () => ({ admitUser: async () => ({ ok: true }) }));

const KEY = "sb-auth-auth-token";
const DAYS_90 = 90 * 24 * 60 * 60;
const user = { id: "00000000-0000-4000-8000-0000000000aa", aud: "authenticated", email: "new@example.com", email_confirmed_at: new Date().toISOString(), app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() };
const session = { access_token: "new-access", refresh_token: "new-refresh", expires_in: 3600, token_type: "bearer", user };

// the sign in service answers a code swap, a refresh and a who am i
beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request) => {
      const url = String(input instanceof Request ? input.url : input);
      if (url.includes("/token")) return Response.json(session);
      if (url.endsWith("/user")) return Response.json(user);
      return new Response("{}", { status: 404 });
    }),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  jar.clear();
  deleted.length = 0;
});
afterAll(() => {
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
});

describe("signing in from the email link", () => {
  it("keeps the session for 90 days, not 400, and clears every code check cookie the sign in left", async () => {
    // what the browser carries back: the fixed code check, one attempt's own code check and the list of attempts
    jar.set(`${KEY}-code-verifier`, { value: JSON.stringify("verifier-one") });
    jar.set(`${KEY}-flow-abcdef0123456789-code-verifier`, { value: JSON.stringify("verifier-one") });
    jar.set(`${KEY}-flows-code-verifier`, { value: JSON.stringify(["abcdef0123456789"]) });
    // and a cookie of our own that must stay
    jar.set("rf_theme", { value: "dark" });

    const { GET } = await import("@/app/auth/callback/route");
    const response = await GET(new Request("http://localhost/auth/callback?code=one-time-code"));
    expect(response.headers.get("location")).toBe("http://localhost/dashboard");

    const left = [...jar.keys()];
    expect(left.filter((name) => name.includes("code-verifier"))).toEqual([]);
    expect(deleted).toEqual(expect.arrayContaining([`${KEY}-flow-abcdef0123456789-code-verifier`, `${KEY}-flows-code-verifier`]));
    expect(left).toContain("rf_theme");

    // the session cookie is there, locked away from scripts, and lasts 90 days
    const sessionCookies = left.filter((name) => name === KEY || name.startsWith(`${KEY}.`));
    expect(sessionCookies.length).toBeGreaterThan(0);
    for (const name of sessionCookies) expect(jar.get(name)?.options).toMatchObject({ maxAge: DAYS_90, httpOnly: true, sameSite: "lax", path: "/" });
  });

  it("leaves the cookies alone when the link did not work", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ code: 400, error_code: "bad_code", msg: "bad code" }, { status: 400 })));
    jar.set("rf_theme", { value: "dark" });
    const { GET } = await import("@/app/auth/callback/route");
    const response = await GET(new Request("http://localhost/auth/callback?code=used-code"));
    expect(response.headers.get("location")).toContain("/sign-in?error=link");
    expect(deleted).toEqual([]);
  });
});

describe("the session cookie on every visit", () => {
  it("is written again with a 90 day age when the session refreshes, so it runs out after 90 days without a visit", async () => {
    // a session whose short lived token has run out, so the proxy refreshes it
    const stale = { access_token: "old-access", refresh_token: "old-refresh", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) - 60, token_type: "bearer", user };
    const request = new NextRequest("http://localhost/dashboard", { headers: { cookie: `${KEY}=${encodeURIComponent(JSON.stringify(stale))}` } });
    const { proxy } = await import("@/proxy");
    const response = await proxy(request);

    const written = response.cookies.getAll().filter((cookie) => cookie.name === KEY || cookie.name.startsWith(`${KEY}.`));
    expect(written.length).toBeGreaterThan(0);
    for (const cookie of written) {
      expect(cookie.maxAge).toBe(DAYS_90);
      expect(cookie.httpOnly).toBe(true);
    }
    // the set cookie header itself says 90 days and never the old 400
    const header = response.headers.get("set-cookie") ?? "";
    expect(header).toContain(`Max-Age=${DAYS_90}`);
    expect(header).not.toContain(`Max-Age=${400 * 24 * 60 * 60}`);
  });
});
