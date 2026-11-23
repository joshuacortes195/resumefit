import { describe, expect, it, vi } from "vitest";

// whoever opens the page here is a plain member
vi.mock("@/lib/auth", () => ({
  authMode: () => "hosted",
  getCurrentUser: async () => ({ id: "00000000-0000-4000-8000-000000000001", email: "member@example.com", name: "Member", isAdmin: false }),
}));

// every lookup the page could make, so the test sees if any of them is ever asked
const lookups = vi.hoisted(() => ({ listUsers: vi.fn(), listInvites: vi.fn(), usageByDay: vi.fn(), junk: vi.fn() }));
vi.mock("@/lib/data/admin", () => ({ listUsers: lookups.listUsers, listInvites: lookups.listInvites, usageByDay: lookups.usageByDay }));
vi.mock("@/lib/data/junk-users", () => ({ countJunkSignIns: lookups.junk, JUNK_AFTER_DAYS: 7, JUNK_PER_RUN: 500 }));

describe("the admin page opened by a member", () => {
  it("answers a real 404 before any part of the page is sent, and looks nothing up", async () => {
    const { default: AdminPage } = await import("@/app/(app)/admin/page");
    // the framework turns this error into the 404 status, which only works when it is thrown before the page starts streaming
    await expect(AdminPage()).rejects.toMatchObject({ digest: "NEXT_HTTP_ERROR_FALLBACK;404" });
    for (const lookup of Object.values(lookups)) expect(lookup).not.toHaveBeenCalled();
  });
});
