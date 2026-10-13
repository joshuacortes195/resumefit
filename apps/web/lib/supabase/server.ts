import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { publicEnv } from "@/lib/env";

// how the session cookies are set. scripts in the page cannot read them, and on the live site they only travel over https.
// nothing in the browser needs them, all sign in work happens on the server
export const SESSION_COOKIE = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const };

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
          for (const { name, value, options } of items) store.set(name, value, options);
        } catch {
          // pages cannot set cookies while they render, the proxy refreshes the session for them
        }
      },
    },
  });
}
