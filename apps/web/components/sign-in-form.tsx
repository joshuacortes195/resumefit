"use client";

import { useActionState } from "react";
import { MailCheck } from "lucide-react";
import { signInWithEmail, signInWithGoogle, type SignInState } from "@/app/actions/auth";
import { INPUT, PRIMARY_BUTTON, SECONDARY_BUTTON } from "@/components/ui/buttons";

// email link or google, with the invite code for first timers
export function SignInForm({ inviteOnly, error }: { inviteOnly: boolean; error: string | null }) {
  const [state, action, pending] = useActionState<SignInState, FormData>(signInWithEmail, {});

  // once the link is on its way, say so instead of showing the form again
  if (state.sent) {
    return (
      <div className="mt-6 animate-rise text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary-soft text-primary">
          <MailCheck className="size-6" aria-hidden />
        </span>
        <p className="mt-3 font-semibold">Check your email</p>
        <p className="mt-1 text-sm text-muted">We sent a sign in link to {state.sent}. It works once and expires in an hour.</p>
      </div>
    );
  }

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
          <input name="invite" type="text" autoComplete="off" className={`${INPUT} mt-1 font-normal uppercase`} />
        </label>
      )}
      {problem && (
        <p role="alert" className="text-sm text-danger">
          {problem}
        </p>
      )}
      <button type="submit" disabled={pending} className={`${PRIMARY_BUTTON} w-full`}>
        {pending ? "Sending..." : "Email me a sign in link"}
      </button>
      {/* google uses the same invite code box */}
      <button type="submit" formAction={signInWithGoogle} formNoValidate className={`${SECONDARY_BUTTON} w-full`}>
        Continue with Google
      </button>
    </form>
  );
}
