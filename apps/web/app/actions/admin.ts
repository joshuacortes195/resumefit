"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionResult } from "@/app/actions/scans";
import { AI_FEATURES, DAILY_CAPS, type AiFeature } from "@/lib/ai/limits";
import { authMode, forgetLocalUser, getCurrentUser } from "@/lib/auth";
import { deleteAccount } from "@/lib/data/account";
import { createInvite, revokeInvite } from "@/lib/data/admin";
import { FLAGS, saveDailyCaps, saveFeatureFlags, type Flag } from "@/lib/data/settings";
import { publicEnv, serverEnv } from "@/lib/env";
import { safeErrorText } from "@/lib/log";
import { supabaseServer } from "@/lib/supabase/server";

// every admin action starts by making sure the caller really is one
async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user.isAdmin) throw new Error("Not allowed.");
  return user;
}

// makes a new invite code
export async function createInviteAction(input: { maxUses: number; expiresInDays: number | null }): Promise<ActionResult & { code?: string }> {
  const parsed = z.object({ maxUses: z.number().int().min(1).max(500), expiresInDays: z.number().int().min(1).max(365).nullable() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Uses has to be between 1 and 500, and days between 1 and 365." };
  const admin = await requireAdmin();
  const code = await createInvite(admin.id, parsed.data.maxUses, parsed.data.expiresInDays);
  revalidatePath("/admin");
  return { ok: true, code };
}

// takes an invite code out of use
export async function revokeInviteAction(code: string): Promise<ActionResult> {
  await requireAdmin();
  await revokeInvite(code.slice(0, 60));
  revalidatePath("/admin");
  return { ok: true };
}

// saves the daily caps for each writing feature
export async function saveCapsAction(caps: Record<string, number>): Promise<ActionResult> {
  await requireAdmin();
  const cleaned: Partial<Record<AiFeature, number>> = {};
  for (const feature of AI_FEATURES) {
    const value = caps[feature];
    if (DAILY_CAPS[feature] === null || value === undefined) continue;
    if (!Number.isInteger(value) || value < 0 || value > 1000) return { ok: false, error: "Caps have to be whole numbers from 0 to 1000." };
    cleaned[feature] = value;
  }
  await saveDailyCaps(cleaned);
  revalidatePath("/admin");
  return { ok: true };
}

// turns features on and off
export async function saveFlagsAction(flags: Record<string, boolean>): Promise<ActionResult> {
  await requireAdmin();
  const cleaned = Object.fromEntries((Object.keys(FLAGS) as Flag[]).map((flag) => [flag, flags[flag] === true])) as Record<Flag, boolean>;
  await saveFeatureFlags(cleaned);
  revalidatePath("/", "layout");
  return { ok: true };
}

// deletes the signed in person's account and everything in it. there is no undo
export async function deleteMyAccount(confirmation: string): Promise<ActionResult> {
  if (confirmation.trim().toLowerCase() !== "delete my account") return { ok: false, error: 'Type "delete my account" to confirm.' };
  const user = await getCurrentUser();
  let leftover = false;
  try {
    leftover = (await deleteAccount(user.id)).filesLeft;
  } catch (error) {
    // nothing is half done at this point: the account and its data are all still there
    console.error(safeErrorText(error, "could not delete an account"));
    return { ok: false, error: "We could not delete your stored files just now, so nothing was deleted. Try again in a moment." };
  }

  if (authMode() === "hosted") {
    // remove the sign in record too, so the email can be used again later
    if (!(await removeSignInRecord(user.id))) leftover = true;
    await (await supabaseServer()).auth.signOut();
  } else forgetLocalUser();
  // when something could not be removed the person is told, instead of being left to think it all went
  redirect(leftover ? "/sign-in?error=leftover" : "/sign-in");
}

// deletes the sign in record kept by the sign in service, trying a few times. true when it is gone
async function removeSignInRecord(userId: string): Promise<boolean> {
  const key = serverEnv().SUPABASE_SERVICE_ROLE_KEY ?? serverEnv().SUPABASE_SECRET_KEY;
  if (!key) {
    console.error("could not remove a sign in record: no service key is set");
    return false;
  }
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(`${publicEnv.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/users/${userId}`, { method: "DELETE", headers: { Authorization: `Bearer ${key}`, apikey: key } }).catch(() => null);
    // a record that is already gone counts as removed
    if (response && (response.ok || response.status === 404)) return true;
    if (attempt === 2) console.error(`could not remove a sign in record (${response?.status ?? "no answer"})`);
  }
  return false;
}
