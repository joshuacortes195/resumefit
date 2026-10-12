"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { authMode } from "@/lib/auth";
import { emailKnown, inviteProblem, noUsersYet } from "@/lib/data/users";
import { appUrl, serverEnv } from "@/lib/env";
import { inviteErrorCode } from "@/lib/invite";
import { supabaseServer } from "@/lib/supabase/server";

// what the sign in form shows after a try
export type SignInState = { error?: string; sent?: string };

// the cookie that carries the invite code from the form to the moment the person comes back signed in
const INVITE_COOKIE = "rf_invite";

// keeps the invite code for when the person comes back from their email or google
async function rememberInvite(code: string): Promise<void> {
  if (code) (await cookies()).set(INVITE_COOKIE, code, { httpOnly: true, sameSite: "lax", secure: true, maxAge: 60 * 60, path: "/" });
}

// emails a sign in link
export async function signInWithEmail(_previous: SignInState, form: FormData): Promise<SignInState> {
  if (authMode() === "local") return { error: "Sign in is not set up on this copy of the app." };
  const parsed = z.object({ email: z.email("That email does not look right."), invite: z.string().trim().max(60) }).safeParse({ email: form.get("email"), invite: form.get("invite") ?? "" });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check your email address." };
  const { email, invite } = parsed.data;

  // while invites are needed, the form answers "check your email" whatever was typed, so it cannot be used to find out
  // who is a member. a link only really goes out to someone who is already in, or who typed a code that works
  if (serverEnv().INVITE_ONLY && !(await noUsersYet()) && !(await emailKnown(email)) && (await inviteProblem(invite))) return { sent: email };
  await rememberInvite(invite);

  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: `${appUrl()}/auth/callback` } });
  if (error) return { error: error.status === 429 ? "Too many tries. Wait a minute and try again." : "We could not send the email. Try again in a moment." };
  return { sent: email };
}

// starts sign in with google
export async function signInWithGoogle(form: FormData): Promise<void> {
  if (authMode() === "local") redirect("/dashboard");
  const invite = String(form.get("invite") ?? "").trim().slice(0, 60);
  // with google we do not know the email yet, so a code is only checked when one was typed
  const problem = invite && serverEnv().INVITE_ONLY && !(await noUsersYet()) ? await inviteProblem(invite) : null;
  if (problem) redirect(`/sign-in?error=${inviteErrorCode(problem)}`);
  await rememberInvite(invite);
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${appUrl()}/auth/callback` } });
  if (error || !data.url) redirect("/sign-in?error=google");
  redirect(data.url);
}

// signs out and goes back to the sign in page
export async function signOut(): Promise<void> {
  if (authMode() === "hosted") await (await supabaseServer()).auth.signOut();
  redirect("/sign-in");
}
