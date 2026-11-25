import { Suspense } from "react";
import { headers } from "next/headers";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { SignInDiagram } from "@/components/sign-in-diagram";
import { SignInForm } from "@/components/sign-in-form";
import { PRIMARY_BUTTON } from "@/components/ui/buttons";
import { authMode } from "@/lib/auth";
import { publicEnv, serverEnv } from "@/lib/env";
import { SIGN_IN_ERRORS } from "@/lib/invite";

export const metadata = { title: "Sign in" };

// what the app does, listed under the form on phones where the drawing is hidden
const FEATURES = ["Match rate", "Rewrites", "Cover letters", "Tracker", "Find Jobs", "Interviews"];

// sign in screen: a white sheet pinned on blueprint paper, next to a drawing of what the app does
export default function SignInPage({ searchParams }: { searchParams: Promise<{ error?: string; invite?: string }> }) {
  return (
    <main className="blueprint blueprint-grid brand flex min-h-screen items-center justify-center overflow-hidden p-4 sm:p-8">
      <div className="grid w-full max-w-6xl items-center gap-12 lg:grid-cols-[1.25fr_1fr]">
        {/* the drawing, wide screens only, it would push the form down on a phone */}
        <div className="hidden lg:block">
          <p className="font-drawing text-[11px] uppercase tracking-[0.1em] text-[var(--bp-hot)]">Fig. 1 / how it works</p>
          <p className="mt-3 max-w-md font-display text-3xl font-extrabold leading-tight tracking-tight">
            Your resume against the job, <span className="text-[var(--bp-hot)]">and everything after.</span>
          </p>
          <div className="mt-8 max-w-[560px]">
            <SignInDiagram />
          </div>
        </div>

        <div className="mx-auto w-full max-w-sm animate-rise">
          {/* the small print over the sheet */}
          <p className="mb-3 font-drawing text-[11px] uppercase tracking-[0.1em] text-[var(--bp-hot)]">Sheet 00 / the way in</p>

          {/* the sheet itself, back in normal light colors */}
          <div className="rounded-xl bg-surface p-6 text-foreground shadow-[0_20px_50px_rgb(5_20_50/0.45)]">
            <Logo />
            <h1 className="mt-6 text-2xl font-extrabold tracking-tight">Sign in</h1>
            <Suspense fallback={null}>
              <SignInBody searchParams={searchParams} />
            </Suspense>
          </div>

          {/* what the app does, as small clay chips, phones only */}
          <ul className="mt-5 flex flex-wrap justify-center gap-2 lg:hidden" aria-label="What ResumeFit does">
            {FEATURES.map((feature) => (
              <li key={feature} className="clay rounded-full bg-[var(--clay-cloud)] px-3 py-1 text-xs font-semibold">
                {feature}
              </li>
            ))}
          </ul>

          <p className="mt-5 flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs text-[var(--bp-muted)] [&_a:hover]:text-[var(--bp-text)]">
            {/* for people who landed here without knowing what the app is */}
            <Link href="/">What is ResumeFit?</Link>
            <Link href="/scans/sample">Sample scan</Link>
            <Link href="/privacy">Privacy Policy</Link>
            <Link href="/terms">Terms of Service</Link>
          </p>
        </div>
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
  const { INVITE_ONLY: inviteOnly, GOOGLE_SIGN_IN: google } = serverEnv();
  // the cloudflare check is only handed to the form when its key is set, so without it the page is exactly as before.
  // its script needs this request's code to get past the content policy
  const siteKey = publicEnv.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const captcha = siteKey ? { captcha: { siteKey, nonce: (await headers()).get("x-nonce") ?? "" } } : {};
  return (
    <>
      <p className="mt-1 text-sm text-muted">{inviteOnly ? "ResumeFit is invite only for now. New here? Enter the code you were given." : "No password needed. We email you a link."}</p>
      <SignInForm inviteOnly={inviteOnly} google={google} invite={(invite ?? "").slice(0, 60)} error={error ? (SIGN_IN_ERRORS[error] ?? SIGN_IN_ERRORS.link ?? null) : null} {...captcha} />
    </>
  );
}
