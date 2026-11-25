import { Suspense } from "react";
import { headers } from "next/headers";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { SignInForm } from "@/components/sign-in-form";
import { PRIMARY_BUTTON } from "@/components/ui/buttons";
import { authMode } from "@/lib/auth";
import { publicEnv, serverEnv } from "@/lib/env";
import { SIGN_IN_ERRORS } from "@/lib/invite";

export const metadata = { title: "Sign in" };

// the clay tips floating around the sign in sheet on wide screens: what each says, its color and where it sits
const BUBBLES = [
  { text: "no password", color: "var(--clay-mint)", place: "left-[8%] top-[18%]" },
  { text: "free, no credits", color: "var(--clay-butter)", place: "right-[9%] top-[26%]" },
  { text: "a link or a code", color: "var(--clay-peach)", place: "left-[12%] bottom-[20%]" },
];

// sign in screen: a white sheet pinned on blueprint paper, with its title block along the bottom
export default function SignInPage({ searchParams }: { searchParams: Promise<{ error?: string; invite?: string }> }) {
  return (
    <main className="blueprint blueprint-grid brand relative flex min-h-screen items-center justify-center overflow-hidden p-4">
      {/* the floating tips, hidden on phones where they would sit on the form */}
      {BUBBLES.map((bubble) => (
        <span key={bubble.text} aria-hidden style={{ background: bubble.color }} className={`clay float absolute hidden rounded-full px-4 py-2 text-sm font-semibold lg:block ${bubble.place}`}>
          {bubble.text}
        </span>
      ))}

      <div className="relative w-full max-w-sm animate-rise">
        {/* the small print over the sheet */}
        <p className="mb-3 font-drawing text-[11px] uppercase tracking-[0.1em] text-[var(--bp-hot)]">Sheet 00 / the way in</p>

        {/* the sheet itself, back in normal light colors */}
        <div className="rounded-xl bg-surface p-6 text-foreground shadow-[0_20px_50px_rgb(5_20_50/0.45)]">
          <Logo />
          <h1 className="mt-6 text-2xl font-extrabold tracking-tight">Sign in</h1>
          <Suspense fallback={null}>
            <SignInBody searchParams={searchParams} />
          </Suspense>

          {/* title block across the bottom, like the corner of a drawing */}
          <dl className="-mx-6 -mb-6 mt-6 grid grid-cols-3 border-t border-border font-drawing text-[10px] uppercase tracking-[0.08em] text-muted">
            <div className="px-3 py-2">
              <dt>Dwg</dt>
              <dd className="text-foreground">RF-00</dd>
            </div>
            <div className="border-l border-border px-3 py-2">
              <dt>Price</dt>
              <dd className="text-foreground">$0</dd>
            </div>
            <div className="border-l border-border px-3 py-2">
              <dt>Rev</dt>
              <dd className="text-foreground">B</dd>
            </div>
          </dl>
        </div>

        <p className="mt-5 flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs text-[var(--bp-muted)] [&_a:hover]:text-[var(--bp-text)]">
          {/* for people who landed here without knowing what the app is */}
          <Link href="/">
            What is ResumeFit?
          </Link>
          <Link href="/scans/sample">
            Sample scan
          </Link>
          <Link href="/privacy">
            Privacy Policy
          </Link>
          <Link href="/terms">
            Terms of Service
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
