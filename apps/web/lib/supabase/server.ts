import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { publicEnv } from "@/lib/env";
import { SESSION_COOKIE, signInLeftovers, withSessionAge } from "@/lib/supabase/session-cookie";

// the sign in client for server code, it keeps the session in cookies
export async function supabaseServer() {
  const url = publicEnv.NEXT_PUBLIC_SUPABASE_URL;
  const key = publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Sign in is not set up. Add the Supabase keys to the environment.");
  const store = await cookies();
  return createServerClient(url, key, {
    cookieOptions: SESSION_COOKIE,
    cookies: {
      getAll: () => store.getAll(),
      setAll: (items) => {
        try {
          // every session cookie gets our 90 day age instead of the library's 400 days
          for (const { name, value, options } of items) store.set(name, value, withSessionAge(options));
        } catch {
          // pages cannot set cookies while they render, the proxy refreshes the session for them
        }
      },
    },
  });
}

// clears the sign in helper cookies once someone is signed in, so only the session itself is left
export async function clearSignInLeftovers(): Promise<void> {
  const store = await cookies();
  for (const name of signInLeftovers(store.getAll().map((cookie) => cookie.name))) store.delete(name);
}
