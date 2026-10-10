"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { authMode } from "@/lib/auth";
import { emailKnown, inviteProblem, noUsersYet } from "@/lib/data/users";
import { publicEnv, serverEnv } from "@/lib/env";
import { inviteErrorCode } from "@/lib/invite";
import { supabaseServer } from "@/lib/supabase/server";

// what the sign in form shows after a try
export type SignInState = { error?: string; sent?: string };

// the cookie that carries the invite code from the form to the moment the person comes back signed in
const INVITE_COOKIE = "rf_invite";

// checks the invite code for someone new and remembers it for when they come back from their email or google
async function holdInvite(email: string | null, code: string): Promise<string | null> {
  const isNew = email ? !(await emailKnown(email)) : true;
  if (serverEnv().INVITE_ONLY && isNew && !(await noUsersYet())) {
    // with google we do not know the email yet, so a code is only checked when one was typed
    if (email || code) {
      const problem = await inviteProblem(code);
      if (problem) return problem;
    }
  }
  if (code) (await cookies()).set(INVITE_COOKIE, code, { httpOnly: true, sameSite: "lax", secure: true, maxAge: 60 * 60, path: "/" });
  return null;
}

// emails a sign in link
export async function signInWithEmail(_previous: SignInState, form: FormData): Promise<SignInState> {
  if (authMode() === "local") return { error: "Sign in is not set up on this copy of the app." };
  const parsed = z.object({ email: z.email("That email does not look right."), invite: z.string().trim().max(60) }).safeParse({ email: form.get("email"), invite: form.get("invite") ?? "" });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check your email address." };

  const problem = await holdInvite(parsed.data.email, parsed.data.invite);
  if (problem) return { error: problem };

  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signInWithOtp({ email: parsed.data.email, options: { emailRedirectTo: `${publicEnv.NEXT_PUBLIC_APP_URL}/auth/callback` } });
  if (error) return { error: error.status === 429 ? "Too many tries. Wait a minute and try again." : "We could not send the email. Try again in a moment." };
  return { sent: parsed.data.email };
}

// starts sign in with google
export async function signInWithGoogle(form: FormData): Promise<void> {
  if (authMode() === "local") redirect("/dashboard");
  const problem = await holdInvite(null, String(form.get("invite") ?? "").trim().slice(0, 60));
  if (problem) redirect(`/sign-in?error=${inviteErrorCode(problem)}`);
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${publicEnv.NEXT_PUBLIC_APP_URL}/auth/callback` } });
  if (error || !data.url) redirect("/sign-in?error=google");
  redirect(data.url);
}

// signs out and goes back to the sign in page
export async function signOut(): Promise<void> {
  if (authMode() === "hosted") await (await supabaseServer()).auth.signOut();
  redirect("/sign-in");
}
