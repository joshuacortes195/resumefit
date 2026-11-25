"use client";

import { useActionState } from "react";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { signInWithCode, signInWithEmail, signInWithGoogle, type SignInState } from "@/app/actions/auth";
import { Turnstile } from "@/components/turnstile";
import { INPUT, PRIMARY_BUTTON, SECONDARY_BUTTON } from "@/components/ui/buttons";
import { MINIMUM_AGE } from "@/lib/legal";

// email link, and google when it is switched on, with the invite code for first timers.
// captcha is only passed when the cloudflare check is set up
export function SignInForm({ inviteOnly, google, error, invite, captcha }: { inviteOnly: boolean; google: boolean; error: string | null; invite: string; captcha?: { siteKey: string; nonce: string } }) {
  const [state, action, pending] = useActionState<SignInState, FormData>(signInWithEmail, {});

  // once the link is on its way, say so and offer the code box instead of showing the form again
  if (state.sent) return <CheckEmail email={state.sent} inviteOnly={inviteOnly} />;

  const problem = state.error ?? error;
  return (
    <form action={action} className="mt-6 space-y-4">
      <label className="block text-sm font-medium">
        Email
        <input name="email" type="email" autoComplete="email" required className={`${INPUT} mt-1 font-normal`} />
      </label>
      {inviteOnly && (
        <label className="block text-sm font-medium">
          Invite code <span className="font-normal text-muted">(first time only)</span>
          <input name="invite" type="text" autoComplete="off" defaultValue={invite} className={`${INPUT} mt-1 font-normal uppercase`} />
        </label>
      )}
      {/* the "are you a person" check, only there when it is set up */}
      {captcha && <Turnstile siteKey={captcha.siteKey} nonce={captcha.nonce} retry={state} />}
      {problem && (
        <p role="alert" className="text-sm text-danger">
          {problem}
        </p>
      )}
      <button type="submit" disabled={pending} className={`${PRIMARY_BUTTON} w-full`}>
        {pending ? "Sending..." : "Email me a sign in link"}
      </button>
      {/* only shown when google sign in is switched on. it uses the same invite code box */}
      {google && (
        <button type="submit" formAction={signInWithGoogle} formNoValidate className={`${SECONDARY_BUTTON} w-full`}>
          Continue with Google
        </button>
      )}
      {/* signing in for the first time makes the account, so the agreement is spelled out right here */}
      <p className="text-center text-xs text-muted">
        By creating an account or signing in, you agree to the{" "}
        <Link href="/terms" className="underline hover:text-foreground">
          Terms of Service
        </Link>{" "}
        and the{" "}
        <Link href="/privacy" className="underline hover:text-foreground">
          Privacy Policy
        </Link>
        , and confirm you are at least {MINIMUM_AGE}.
      </p>
    </form>
  );
}

// the "check your email" screen, with a box for the code in the email so sign in works on any device
function CheckEmail({ email, inviteOnly }: { email: string; inviteOnly: boolean }) {
  const [state, action, pending] = useActionState<SignInState, FormData>(signInWithCode, {});
  return (
    <div className="mt-6 animate-rise">
      <div className="text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary-soft text-primary">
          <MailCheck className="size-6" aria-hidden />
        </span>
        <p className="mt-3 font-semibold">Check your email</p>
        <p className="mt-1 text-sm text-muted">We sent a sign in link to {email}. Open it in this browser, or type the code from the email below. Only the newest email works, for an hour.</p>
      </div>
      {/* the typed code works anywhere, even when the email opens in another browser or on a phone */}
      <form action={action} className="mt-5 space-y-3">
        <input type="hidden" name="email" value={email} />
        <label className="block text-sm font-medium">
          Code from the email
          <input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,12}" maxLength={12} required className={`${INPUT} mt-1 text-center font-mono text-lg tracking-[0.3em]`} />
        </label>
        {state.error && (
          <p role="alert" className="text-sm text-danger">
            {state.error}
          </p>
        )}
        <button type="submit" disabled={pending} className={`${PRIMARY_BUTTON} w-full`}>
          {pending ? "Checking..." : "Sign in with code"}
        </button>
      </form>
      {/* shown to everyone, since the form never says whether an email already has an account */}
      <p className="mt-4 text-center text-sm text-muted">
        Nothing after a few minutes? Check spam. Only a few emails can go out per hour, so wait a bit before asking again.
        {inviteOnly && " If this is your first time here you need an invite code."}{" "}
        <a href="/sign-in" className="underline hover:text-foreground">
          Start over
        </a>
      </p>
    </div>
  );
}
