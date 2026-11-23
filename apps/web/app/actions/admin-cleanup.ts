"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { deleteJunkSignIns } from "@/lib/data/junk-users";
import { safeErrorText } from "@/lib/log";
import { authAdmin } from "@/lib/supabase/admin";

// makes sure the caller really is the admin, on the server, every time
async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user.isAdmin) throw new Error("Not allowed.");
  return user;
}

// deletes sign in records that never got into the app and are over a week old, up to one run's worth.
// anyone in the app and the admin are never touched
export async function deleteJunkSignInsAction(): Promise<{ ok: true; deleted: number; failed: number } | { ok: false; error: string }> {
  const admin = await requireAdmin();
  const client = authAdmin();
  if (!client) return { ok: false, error: "This needs sign in and the service key to be set up." };
  try {
    const result = await deleteJunkSignIns(client, { id: admin.id, email: admin.email });
    revalidatePath("/admin");
    return { ok: true, ...result };
  } catch (error) {
    console.error(safeErrorText(error, "could not clean up sign in records"));
    return { ok: false, error: "We could not clean up the sign in records just now. Try again in a moment." };
  }
}
