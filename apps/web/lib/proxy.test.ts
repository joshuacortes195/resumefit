import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GET as securityTxt } from "@/app/.well-known/security.txt/route";
import { proxy } from "@/proxy";

// the proxy as the live site runs it, with sign in set up and nobody signed in
function signedOut() {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://auth.test");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
  // with no session the sign in service is never asked, and if it were it would not answer
  vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 500 })));
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("the security contact file", () => {
  it("is open to someone who is not signed in, while private pages still send them to sign in", async () => {
    signedOut();
    const open = await proxy(new NextRequest("http://localhost/.well-known/security.txt"));
    expect(open.headers.get("location")).toBeNull();
    expect(open.status).toBe(200);
    // it is the same for everyone, so it is not marked private or hidden from search
    expect(open.headers.get("x-robots-tag")).toBeNull();

    const closed = await proxy(new NextRequest("http://localhost/dashboard"));
    expect(closed.headers.get("location")).toBe("http://localhost/sign-in");
    // a look alike address is not let through
    expect((await proxy(new NextRequest("http://localhost/.well-known/security.txt.bak"))).headers.get("location")).toBe("http://localhost/sign-in");
  });

  it("follows rfc 9116 with the advisory contact, the policy, a date a year out and english", async () => {
    const response = securityTxt();
    expect(response.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    const lines = (await response.text()).trim().split("\n");
    const field = (name: string) => lines.filter((line) => line.startsWith(`${name}: `)).map((line) => line.slice(name.length + 2));
    expect(field("Contact")).toEqual(["https://github.com/joshuacortes195/resumefit/security/advisories/new"]);
    expect(field("Policy")).toEqual(["https://github.com/joshuacortes195/resumefit/blob/main/SECURITY.md"]);
    expect(field("Preferred-Languages")).toEqual(["en"]);
    expect(field("Canonical")).toEqual(["https://resumefit-three.vercel.app/.well-known/security.txt"]);
    // exactly one expiry, written the way the standard asks, and still in the future. this starts failing when it is time to move the date
    const expires = field("Expires");
    expect(expires).toEqual(["2027-11-22T00:00:00.000Z"]);
    expect(new Date(expires[0] ?? "").getTime()).toBeGreaterThan(Date.now());
    // every line is a field the standard knows, nothing else
    for (const line of lines) expect(line).toMatch(/^(Contact|Expires|Policy|Preferred-Languages|Canonical): \S+$/);
  });
});
