import { Logo } from "@/components/logo";

export const metadata = { title: "Sign in" };

// sign in screen, the form is not hooked up to auth yet
export default function SignInPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-6 shadow-sm">
        <Logo />
        <h1 className="mt-6 text-xl font-semibold tracking-tight">Sign in</h1>
        <p className="mt-1 text-sm text-muted">ResumeFit is invite only for now. New here? Enter the code you were given.</p>

        {/* email and invite code fields */}
        <form className="mt-6 space-y-4">
          <div>
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="invite" className="text-sm font-medium">
              Invite code <span className="font-normal text-muted">(first time only)</span>
            </label>
            <input id="invite" name="invite" type="text" className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm uppercase" />
          </div>

          {/* disabled until auth is connected */}
          <button type="submit" disabled className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
            Email me a sign in link
          </button>
          <p className="text-center text-xs text-muted">Sign in turns on once the database and auth keys are added.</p>
        </form>
      </div>
    </main>
  );
}
