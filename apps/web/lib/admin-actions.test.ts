import { describe, expect, it, vi } from "vitest";
import { createInviteAction, revokeInviteAction, saveCapsAction, saveFlagsAction } from "@/app/actions/admin";
import { getDb, schema } from "@/db";
import { featureFlags } from "@/lib/data/settings";

// whoever is signed in for these tests is a plain member, never an admin
vi.mock("@/lib/auth", () => ({
  authMode: () => "hosted",
  forgetLocalUser: () => undefined,
  getCurrentUser: async () => ({ id: "00000000-0000-4000-8000-000000000001", email: "member@example.com", name: "Member", isAdmin: false }),
}));

// the page refreshes after a save, which needs the framework, so it does nothing here
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));

describe("admin actions called by someone who is not an admin", () => {
  it("refuses every one of them on the server, even with the admin page never opened", async () => {
    await expect(createInviteAction({ maxUses: 5, expiresInDays: 7 })).rejects.toThrow("Not allowed.");
    await expect(revokeInviteAction("ANYCODE1")).rejects.toThrow("Not allowed.");
    await expect(saveCapsAction({ optimize: 1000 })).rejects.toThrow("Not allowed.");
    await expect(saveFlagsAction({ autoApply: true })).rejects.toThrow("Not allowed.");
  });

  it("leaves no invite behind and no setting changed", async () => {
    const before = await featureFlags();
    await saveFlagsAction({ autoApply: !before.autoApply }).catch(() => undefined);
    await createInviteAction({ maxUses: 5, expiresInDays: null }).catch(() => undefined);
    expect(await featureFlags()).toEqual(before);
    expect(await (await getDb()).select().from(schema.inviteCodes)).toEqual([]);
  });
});
