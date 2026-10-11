import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// pages anyone can open without signing in
const PUBLIC = /^\/(sign-in|auth\/|privacy|terms|api\/ext\/|api\/health$|api\/cron\/feed$|scans\/sample)/;

// pages that are the same for everyone, so a shared cache may keep them. everything else is one person's own
const SAME_FOR_EVERYONE = /^\/(sign-in|privacy|terms|scans\/sample)?$/;

// marks an answer as private. nothing that depends on who is signed in may be kept by a cache that other people share
function keepPrivate(request: NextRequest, response: NextResponse): NextResponse {
  if (!SAME_FOR_EVERYONE.test(request.nextUrl.pathname)) response.headers.set("Cache-Control", "private, no-store");
  return response;
}

// the names this computer goes by
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

// runs before every page: keeps the sign in session fresh and sends signed out visitors to the sign in page
export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  // on your own machine there is no sign in, so the app must only ever answer this computer.
  // without this, anyone on the same wifi could open it and read everything
  if (!url || !key) {
    const host = (request.headers.get("host") ?? "").replace(/:\d+$/, "");
    if (!LOCAL_HOSTS.has(host)) return new NextResponse("ResumeFit is running in local mode and only answers on this computer.", { status: 403 });
    return keepPrivate(request, NextResponse.next());
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
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
    if (pathname.startsWith("/api/")) return keepPrivate(request, NextResponse.json({ error: "Sign in first." }, { status: 401 }));
    const signIn = request.nextUrl.clone();
    signIn.pathname = "/sign-in";
    signIn.search = "";
    return NextResponse.redirect(signIn);
  }
  return keepPrivate(request, response);
}

// skip files like images and the framework's own assets
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"] };
