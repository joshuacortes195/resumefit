import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// the same settings the server side sign in client uses, so the session cookies cannot be read by scripts in the page
const SESSION_COOKIE = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const };

// pages anyone can open without signing in
const PUBLIC = /^\/(sign-in|auth\/|privacy|terms|api\/ext\/|api\/health$|api\/cron\/feed$|scans\/sample)/;

// pages that are the same for everyone, so a shared cache may keep them. everything else is one person's own
const SAME_FOR_EVERYONE = /^\/(sign-in|privacy|terms|scans\/sample)?$/;

// the last touches on every answer: the content policy, and a private mark on anything that depends on who is signed in,
// so it is never kept by a cache that other people share
function finish(request: NextRequest, response: NextResponse): NextResponse {
  response.headers.set("Content-Security-Policy", request.headers.get("Content-Security-Policy") ?? "");
  if (!SAME_FOR_EVERYONE.test(request.nextUrl.pathname)) response.headers.set("Cache-Control", "private, no-store");
  return response;
}

// what the browser is allowed to load and where it may send things. scripts only run when they carry this request's code,
// or were loaded by one that does, so a script someone manages to inject is refused. the dev server needs eval for hot reloading
function contentPolicy(nonce: string): string {
  const dev = process.env.NODE_ENV !== "production";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    // styles written on an element, like the fill of a score ring, cannot carry a code
    "style-src 'self' 'unsafe-inline'",
    // company logos on the job pages come straight from those sites
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src 'self' https://*.supabase.co${dev ? " ws: http://localhost:*" : ""}`,
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
  ].join("; ");
}

// the names this computer goes by
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

// runs before every page: keeps the sign in session fresh and sends signed out visitors to the sign in page
export async function proxy(request: NextRequest) {
  // a new code for every request. it rides on the request so the page can put it on its own scripts
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  request.headers.set("x-nonce", nonce);
  request.headers.set("Content-Security-Policy", contentPolicy(nonce));

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  // on your own machine there is no sign in, so the app must only ever answer this computer.
  // without this, anyone on the same wifi could open it and read everything
  if (!url || !key) {
    const host = (request.headers.get("host") ?? "").replace(/:\d+$/, "");
    if (!LOCAL_HOSTS.has(host)) return new NextResponse("ResumeFit is running in local mode and only answers on this computer.", { status: 403 });
    return finish(request, NextResponse.next({ request }));
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookieOptions: SESSION_COOKIE,
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (items) => {
        // refreshed session cookies go onto both the request and the answer
        for (const { name, value } of items) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of items) response.cookies.set(name, value, options);
      },
    },
  });
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  if (!user && !PUBLIC.test(pathname) && pathname !== "/") {
    // api calls get a plain "not signed in", pages get sent to sign in
    if (pathname.startsWith("/api/")) return finish(request, NextResponse.json({ error: "Sign in first." }, { status: 401 }));
    const signIn = request.nextUrl.clone();
    signIn.pathname = "/sign-in";
    signIn.search = "";
    return finish(request, NextResponse.redirect(signIn));
  }
  return finish(request, response);
}

// skip files like images and the framework's own assets
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"] };
