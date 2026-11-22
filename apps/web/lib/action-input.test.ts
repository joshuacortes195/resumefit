import { describe, expect, it, vi } from "vitest";

// none of these should ever get as far as asking who is signed in, so that step fails loudly if it is reached
vi.mock("@/lib/auth", () => ({
  getCurrentUser: async () => {
    throw new Error("reached the signed in user with bad input");
  },
  authMode: () => "local",
  forgetLocalUser: () => undefined,
}));

const { setJobArchived } = await import("@/app/actions/jobs");
const { archiveScans } = await import("@/app/actions/scans");
const { deleteMyAccount, revokeInviteAction, saveCapsAction, saveFlagsAction } = await import("@/app/actions/admin");

const ID = "5d6f2a52-3c1e-4c55-9a51-2f3a7c1d9b10";

// server actions can be called with anything, not only what our own forms send
describe("server actions turn away input that is the wrong shape", () => {
  it("only takes a real yes or no for archiving", async () => {
    expect(await setJobArchived(ID, "yes" as never)).toMatchObject({ ok: false });
    expect(await archiveScans([ID], 1 as never)).toMatchObject({ ok: false });
  });

  it("does not trip over a missing or odd value in the admin and account actions", async () => {
    expect(await revokeInviteAction({} as never)).toMatchObject({ ok: false });
    expect(await saveCapsAction(null as never)).toMatchObject({ ok: false });
    expect(await saveFlagsAction("all" as never)).toMatchObject({ ok: false });
    expect(await deleteMyAccount(42 as never)).toMatchObject({ ok: false });
  });
});
