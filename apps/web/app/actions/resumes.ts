"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/app/actions/scans";
import { getCurrentUser } from "@/lib/auth";
import { deleteResume, duplicateResume, renameResume, setBaseResume } from "@/lib/data/resumes";
import { safeErrorText } from "@/lib/log";

const id = z.uuid();
const fail = (error: string): ActionResult => ({ ok: false, error });

// makes a resume the base one, the one scans start from
export async function makeBaseResume(resumeId: string): Promise<ActionResult> {
  if (!id.safeParse(resumeId).success) return fail("We could not find that resume.");
  const user = await getCurrentUser();
  await setBaseResume(user.id, resumeId);
  revalidatePath("/resumes");
  return { ok: true };
}

// gives a resume a new name
export async function renameResumeAction(resumeId: string, name: string): Promise<ActionResult> {
  const parsed = z.object({ resumeId: id, name: z.string().trim().min(1, "Give the resume a name.").max(120, "Keep the name under 120 characters.") }).safeParse({ resumeId, name });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the name.");
  const user = await getCurrentUser();
  await renameResume(user.id, parsed.data.resumeId, parsed.data.name);
  revalidatePath("/resumes");
  return { ok: true };
}

// copies a resume
export async function duplicateResumeAction(resumeId: string): Promise<ActionResult> {
  if (!id.safeParse(resumeId).success) return fail("We could not find that resume.");
  const user = await getCurrentUser();
  if (!(await duplicateResume(user.id, resumeId))) return fail("We could not find that resume.");
  revalidatePath("/resumes");
  return { ok: true };
}

// deletes a resume and its file
export async function deleteResumeAction(resumeId: string): Promise<ActionResult> {
  if (!id.safeParse(resumeId).success) return fail("We could not find that resume.");
  const user = await getCurrentUser();
  try {
    await deleteResume(user.id, resumeId);
  } catch (error) {
    console.error(safeErrorText(error, "could not delete a resume"));
    return fail("We could not delete that resume just now, so it was kept. Try again in a moment.");
  }
  revalidatePath("/resumes");
  return { ok: true };
}
