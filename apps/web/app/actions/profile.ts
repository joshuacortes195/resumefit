"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/app/actions/scans";
import { getCurrentUser } from "@/lib/auth";
import { createExtensionToken, revokeExtensionTokens } from "@/lib/data/extension";

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
