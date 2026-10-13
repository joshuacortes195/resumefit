import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { admitUser } from "@/lib/data/users";
import { inviteErrorCode } from "@/lib/invite";
import { supabaseServer } from "@/lib/supabase/server";

// where the email link and google send people back to: finish signing in, then let them into the app
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const back = (error: string) => NextResponse.redirect(new URL(`/sign-in?error=${encodeURIComponent(error)}`, url.origin));
  if (!code) return back("link");

  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user?.email) return back("link");

  // new people need the invite code they typed before leaving for their email
  const store = await cookies();
  const meta = data.user.user_metadata as { full_name?: string; name?: string; avatar_url?: string };
  // whether the provider has seen proof that this person owns the email, which the owner rule depends on
  const confirmed = Boolean(data.user.email_confirmed_at);
  const admitted = await admitUser({ id: data.user.id, email: data.user.email, name: meta.full_name ?? meta.name ?? null, avatar: meta.avatar_url ?? null, confirmed }, store.get("rf_invite")?.value ?? null);
  store.delete("rf_invite");
  if ("error" in admitted) {
    // signed in with the provider but not allowed in, so do not leave a session behind
    await supabase.auth.signOut();
    return back(inviteErrorCode(admitted.error));
  }
  return NextResponse.redirect(new URL("/dashboard", url.origin));
}
