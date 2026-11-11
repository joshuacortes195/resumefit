import { cache } from "react";
import { redirect } from "next/navigation";
import type { CurrentUser } from "@/lib/auth";
import { findUser } from "@/lib/data/users";
import { supabaseServer } from "@/lib/supabase/server";

// reads the signed in user from the session, sends everyone else to the sign in page.
// a page asks who is signed in from several places while it is put together. the answer is remembered for that one request,
// so the trip to the sign in service and the user lookup happen once instead of once per section
export const hostedUser = cache(async (): Promise<CurrentUser> => {
  const supabase = await supabaseServer();
  const {
    data: { user: session },
  } = await supabase.auth.getUser();
  if (!session) redirect("/sign-in");
  // signed in with the provider but never let into the app, for example without an invite code
  const user = await findUser(session.id);
  if (!user) redirect("/sign-in?error=invite");
  return user;
});
