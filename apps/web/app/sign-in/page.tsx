import { Suspense } from "react";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { SignInForm } from "@/components/sign-in-form";
import { PRIMARY_BUTTON } from "@/components/ui/buttons";
import { authMode } from "@/lib/auth";
import { serverEnv } from "@/lib/env";

export const metadata = { title: "Sign in" };

// messages for the short error codes other pages send people here with
const ERRORS: Record<string, string> = {
  invite: "You need an invite code to join. Enter it below and sign in again.",
  google: "Google sign in did not work. Try again, or use an email link.",
};

// sign in screen
export default function SignInPage({ searchParams }: { searchParams: Promise<{ error?: string; invite?: string }> }) {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm animate-rise rounded-2xl border border-border bg-surface p-6">
        <Logo />
        <h1 className="mt-6 text-xl font-semibold tracking-tight">Sign in</h1>
        <Suspense fallback={null}>
          <SignInBody searchParams={searchParams} />
        </Suspense>
        <p className="mt-6 flex justify-center gap-4 text-xs text-muted">
          <Link href="/privacy" className="hover:text-foreground">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-foreground">
            Terms
          </Link>
        </p>
      </div>
    </main>
  );
}

// the form when sign in is set up, a note when the app is running on your own machine
async function SignInBody({ searchParams }: { searchParams: Promise<{ error?: string; invite?: string }> }) {
  const { error, invite } = await searchParams;
  if (authMode() === "local") {
    return (
      <>
        <p className="mt-1 text-sm text-muted">This copy of ResumeFit is running on your own computer, so there is nothing to sign in to. Your data stays on this machine.</p>
        <Link href="/dashboard" className={`${PRIMARY_BUTTON} mt-6 w-full`}>
          Open the app
        </Link>
      </>
    );
  }
  const inviteOnly = serverEnv().INVITE_ONLY;
  return (
    <>
      <p className="mt-1 text-sm text-muted">{inviteOnly ? "ResumeFit is invite only for now. New here? Enter the code you were given." : "No password needed. We email you a link."}</p>
      <SignInForm inviteOnly={inviteOnly} invite={(invite ?? "").slice(0, 60)} error={error ? (ERRORS[error] ?? error.slice(0, 200)) : null} />
    </>
  );
}
