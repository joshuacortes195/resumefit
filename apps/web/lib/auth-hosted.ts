import { redirect } from "next/navigation";
import type { CurrentUser } from "@/lib/auth";
import { findUser } from "@/lib/data/users";
import { supabaseServer } from "@/lib/supabase/server";

// reads the signed in user from the session, sends everyone else to the sign in page
export async function hostedUser(): Promise<CurrentUser> {
  const supabase = await supabaseServer();
  const {
    data: { user: session },
  } = await supabase.auth.getUser();
  if (!session) redirect("/sign-in");
  // signed in with the provider but never let into the app, for example without an invite code
  const user = await findUser(session.id);
  if (!user) redirect("/sign-in?error=invite");
  return user;
}
