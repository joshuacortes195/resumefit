"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/app/actions/scans";
import { getCurrentUser } from "@/lib/auth";
import { createExtensionToken, revokeExtensionTokens, saveAutoSubmit } from "@/lib/data/extension";
import { saveProfile } from "@/lib/data/profile";
import { profileSchema, type ProfileInput } from "@/lib/profile";

// saves the profile and preferences form
export async function saveProfileAction(input: ProfileInput): Promise<ActionResult> {
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: issue ? `${issue.message}` : "Check the form and try again." };
  }
  const { desiredSalaryMin: low, desiredSalaryMax: high } = parsed.data;
  if (low !== null && high !== null && low > high) return { ok: false, error: "The lowest salary is higher than the highest one." };
  const user = await getCurrentUser();
  await saveProfile(user.id, parsed.data);
  revalidatePath("/settings");
  revalidatePath("/auto-apply");
  return { ok: true };
}

// switches "Submit for me" on or off for Auto Apply
export async function setAutoSubmit(on: boolean): Promise<ActionResult> {
  const user = await getCurrentUser();
  await saveAutoSubmit(user.id, on === true);
  revalidatePath("/auto-apply");
  return { ok: true };
}

// makes a fresh connection code for the extension. it replaces any older one
export async function connectExtension(): Promise<{ ok: true; token: string }> {
  const user = await getCurrentUser();
  const token = await createExtensionToken(user.id);
  revalidatePath("/extension");
  return { ok: true, token };
}

// cuts the extension off
export async function disconnectExtension(): Promise<ActionResult> {
  const user = await getCurrentUser();
  await revokeExtensionTokens(user.id);
  revalidatePath("/extension");
  return { ok: true };
}
