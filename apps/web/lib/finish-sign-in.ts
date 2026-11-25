import { cookies } from "next/headers";
import type { User } from "@supabase/supabase-js";
import { admitUser } from "@/lib/data/users";
import { inviteErrorCode } from "@/lib/invite";
import { clearSignInLeftovers, supabaseServer } from "@/lib/supabase/server";

// the last step of every sign in (email link, typed code, google): let the person into the app or turn them away.
// gives back where to send them, the dashboard or the sign in page with an error code
export async function finishSignIn(user: User | null | undefined): Promise<string> {
  if (!user?.email) return "/sign-in?error=link";
  // the sign in is done, so the code check cookies it needed go too
  await clearSignInLeftovers();

  // new people need the invite code they typed before leaving for their email
  const store = await cookies();
  const meta = user.user_metadata as { full_name?: string; name?: string; avatar_url?: string };
  // whether the provider has seen proof that this person owns the email, which the owner rule depends on
  const confirmed = Boolean(user.email_confirmed_at);
  const admitted = await admitUser({ id: user.id, email: user.email, name: meta.full_name ?? meta.name ?? null, avatar: meta.avatar_url ?? null, confirmed }, store.get("rf_invite")?.value ?? null);
  store.delete("rf_invite");
  if ("error" in admitted) {
    // signed in with the provider but not allowed in, so do not leave a session behind
    await (await supabaseServer()).auth.signOut();
    return `/sign-in?error=${encodeURIComponent(inviteErrorCode(admitted.error))}`;
  }
  return "/dashboard";
}
