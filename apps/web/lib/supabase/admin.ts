import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { AuthAdmin } from "@/lib/data/junk-users";
import { publicEnv, serverEnv } from "@/lib/env";

// the sign in service's admin api, with the service key. only ever made on the server, and only when sign in and the key are set up
export function authAdmin(): AuthAdmin | null {
  const url = publicEnv.NEXT_PUBLIC_SUPABASE_URL;
  const key = serverEnv().SUPABASE_SERVICE_ROLE_KEY ?? serverEnv().SUPABASE_SECRET_KEY;
  if (!url || !publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY || !key) return null;
  // nothing is kept between calls, this client never signs anyone in
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }).auth.admin;
}
