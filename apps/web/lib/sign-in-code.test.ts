import { afterEach, describe, expect, it, vi } from "vitest";

// the sign in service's check of a code or link hash, and the admit step after it
const verify = vi.hoisted(() => vi.fn<(args: unknown) => Promise<{ data: { user: unknown }; error: null | { message: string } }>>(async () => ({ data: { user: { id: "u1", email: "member@example.com" } }, error: null })));
const finish = vi.hoisted(() => vi.fn<(user: unknown) => Promise<string>>(async () => "/dashboard"));
const limited = vi.hoisted(() => ({ ok: true }));

// everything around sign in that needs a live request or a database
function mockAround() {
  vi.doMock("next/headers", () => ({ headers: async () => new Headers(), cookies: async () => ({ set: () => undefined, get: () => undefined, delete: () => undefined, getAll: () => [] }) }));
  vi.doMock("next/navigation", () => ({
    redirect: (to: string) => {
      throw new Error(`redirect:${to}`);
    },
  }));
  vi.doMock("@/lib/auth", () => ({ authMode: () => "hosted" }));
  vi.doMock("@/lib/data/users", () => ({ emailKnown: async () => true, inviteProblem: async () => null, isOwnerEmail: () => false, noUsersYet: async () => false }));
  vi.doMock("@/lib/rate-limit", () => ({ clientAddress: () => "203.0.113.9", withinLimit: async () => limited.ok }));
  vi.doMock("@/lib/supabase/server", () => ({ supabaseServer: async () => ({ auth: { verifyOtp: verify } }) }));
  vi.doMock("@/lib/finish-sign-in", () => ({ finishSignIn: finish }));
}

// the code action loaded fresh
async function typeCode(code: string) {
  vi.resetModules();
  mockAround();
  const { signInWithCode } = await import("@/app/actions/auth");
  const form = new FormData();
  form.set("email", "member@example.com");
  form.set("code", code);
  return signInWithCode({}, form);
}

// the confirm route loaded fresh, opened with the given address
async function openLink(query: string) {
  vi.resetModules();
  mockAround();
  const { GET } = await import("@/app/auth/confirm/route");
  const response = await GET(new Request(`https://app.example.com/auth/confirm${query}`));
  return new URL(response.headers.get("location") ?? "").pathname + new URL(response.headers.get("location") ?? "").search;
}

afterEach(() => {
  verify.mockClear();
  finish.mockClear();
  limited.ok = true;
});

describe("signing in with the code from the email", () => {
  it("checks the typed code with the sign in service, spaces dropped, then lets the person in", async () => {
    await expect(typeCode("123 456")).rejects.toThrow("redirect:/dashboard");
    expect(verify.mock.calls[0]?.[0]).toEqual({ email: "member@example.com", token: "123456", type: "email" });
    expect(finish).toHaveBeenCalledTimes(1);
  });

  it("says so when the code is wrong and stays on the code screen", async () => {
    verify.mockResolvedValueOnce({ data: { user: null }, error: { message: "Token has expired or is invalid" } });
    const result = await typeCode("000000");
    expect(result.sent).toBe("member@example.com");
    expect(result.error).toMatch(/did not work/);
    expect(finish).not.toHaveBeenCalled();
  });

  it("turns away letters and short codes without asking the sign in service", async () => {
    expect((await typeCode("12ab")).error).toMatch(/only numbers/);
    expect(verify).not.toHaveBeenCalled();
  });

  it("stops after too many tries", async () => {
    limited.ok = false;
    expect((await typeCode("123456")).error).toMatch(/Too many/);
    expect(verify).not.toHaveBeenCalled();
  });
});

describe("the email link that works in any browser", () => {
  it("checks the hash in the link and lets the person in", async () => {
    expect(await openLink("?token_hash=abc123&type=email")).toBe("/dashboard");
    expect(verify.mock.calls[0]?.[0]).toEqual({ token_hash: "abc123", type: "email" });
  });

  it("sends a used or old link back to sign in with a message that says so", async () => {
    verify.mockResolvedValueOnce({ data: { user: null }, error: { message: "Email link is invalid or has expired" } });
    expect(await openLink("?token_hash=abc123&type=email")).toBe("/sign-in?error=used");
    expect(finish).not.toHaveBeenCalled();
  });

  it("does not ask the sign in service about a link with no hash or an odd type", async () => {
    expect(await openLink("")).toBe("/sign-in?error=link");
    expect(await openLink("?token_hash=abc&type=admin")).toBe("/sign-in?error=link");
    expect(verify).not.toHaveBeenCalled();
  });
});
