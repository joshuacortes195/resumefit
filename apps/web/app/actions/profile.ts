"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/app/actions/scans";
import { getCurrentUser } from "@/lib/auth";
import { createExtensionToken, revokeExtensionTokens } from "@/lib/data/extension";
import { NoSecretError, saveProfile } from "@/lib/data/profile";
import { profileSchema, type ProfileInput } from "@/lib/profile";

// saves the application profile form
export async function saveProfileAction(input: ProfileInput): Promise<ActionResult> {
  // a saved answer row that was added and left empty is just dropped
  const filled = { ...input, qaBank: (Array.isArray(input?.qaBank) ? input.qaBank : []).filter((entry) => entry?.question?.trim() || entry?.answer?.trim()) };
  const parsed = profileSchema.safeParse(filled);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    // a saved answer needs both halves, and the plain message for that is clearer than the built in one
    if (issue?.path[0] === "qaBank") return { ok: false, error: "Each saved answer needs a question and an answer." };
    return { ok: false, error: issue ? `${issue.message}` : "Check the form and try again." };
  }
  const { desiredSalaryMin: low, desiredSalaryMax: high } = parsed.data;
  if (low !== null && high !== null && low > high) return { ok: false, error: "The lowest salary is higher than the highest one." };
  const user = await getCurrentUser();
  try {
    await saveProfile(user.id, parsed.data);
  } catch (problem) {
    if (problem instanceof NoSecretError) return { ok: false, error: problem.message };
    throw problem;
  }
  revalidatePath("/settings", "layout");
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
