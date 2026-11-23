import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

// the sign in service, so the test can see exactly what the email link request carried
const otp = vi.hoisted(() => vi.fn(async () => ({ error: null })));

// everything around the sign in action that needs a live request or a database
function mockAround() {
  vi.doMock("next/headers", () => ({ headers: async () => new Headers({ "x-forwarded-for": "203.0.113.9" }), cookies: async () => ({ set: () => undefined }) }));
  vi.doMock("@/lib/auth", () => ({ authMode: () => "hosted" }));
  vi.doMock("@/lib/data/users", () => ({ emailKnown: async () => true, inviteProblem: async () => null, isOwnerEmail: () => false, noUsersYet: async () => false }));
  vi.doMock("@/lib/rate-limit", () => ({ clientAddress: () => "203.0.113.9", withinLimit: async () => true }));
  vi.doMock("@/lib/supabase/server", () => ({ supabaseServer: async () => ({ auth: { signInWithOtp: otp } }) }));
}

// the sign in action loaded fresh with the cloudflare key set or not
async function signIn(siteKey: string | null, fields: Record<string, string>) {
  vi.resetModules();
  if (siteKey) vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", siteKey);
  else vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "");
  mockAround();
  const { signInWithEmail } = await import("@/app/actions/auth");
  const form = new FormData();
  for (const [name, value] of Object.entries(fields)) form.set(name, value);
  return signInWithEmail({}, form);
}

afterEach(() => {
  vi.unstubAllEnvs();
  otp.mockClear();
});

describe("the cloudflare check on email sign in", () => {
  it("is not asked for at all when no site key is set, and the request to the sign in service is the same as before", async () => {
    expect(await signIn(null, { email: "member@example.com", invite: "", captcha: "anything" })).toEqual({ sent: "member@example.com" });
    expect(otp).toHaveBeenCalledTimes(1);
    expect(otp.mock.calls[0]).toEqual([{ email: "member@example.com", options: { emailRedirectTo: "http://localhost:3000/auth/callback" } }]);
  });

  it("with the key set, sends nothing until the check is done, then hands its answer to the sign in service", async () => {
    const missing = await signIn("0x4AAAAAAAtestkey", { email: "member@example.com", invite: "" });
    expect(missing.error).toMatch(/check/);
    expect(otp).not.toHaveBeenCalled();

    expect(await signIn("0x4AAAAAAAtestkey", { email: "member@example.com", invite: "", captcha: "one-time-answer" })).toEqual({ sent: "member@example.com" });
    expect(otp.mock.calls[0]).toEqual([{ email: "member@example.com", options: { emailRedirectTo: "http://localhost:3000/auth/callback", captchaToken: "one-time-answer" } }]);
  });
});

describe("the sign in form", () => {
  it("draws no check and loads nothing from cloudflare when the check is off", async () => {
    vi.resetModules();
    vi.doMock("@/app/actions/auth", () => ({ signInWithEmail: async () => ({}), signInWithGoogle: async () => undefined }));
    const { SignInForm } = await import("@/components/sign-in-form");
    const props = { inviteOnly: true, google: true, error: null, invite: "" };
    const off = renderToStaticMarkup(createElement(SignInForm, props));
    expect(off).not.toContain("challenges.cloudflare.com");
    // with the check on, the only change is one empty box the check draws itself into
    const on = renderToStaticMarkup(createElement(SignInForm, { ...props, captcha: { siteKey: "0x4AAAAAAAtestkey", nonce: "abc" } }));
    expect(on.replace("<div></div>", "")).toBe(off);
  });
});
