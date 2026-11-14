"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/app/actions/scans";
import { getCurrentUser } from "@/lib/auth";
import { answerWaiting } from "@/lib/data/applications";
import { saveAnswer } from "@/lib/data/profile";

const answersSchema = z.object({
  applicationId: z.uuid(),
  answers: z.array(z.object({ label: z.string().trim().min(1).max(300), value: z.string().trim().min(1, "Every question needs an answer.").max(3000), remember: z.boolean() })).max(40),
});

// keeps the person's answers to what one filled in application was waiting on.
// an answer marked to be remembered also joins their saved answers, so the same question is never asked again
export async function answerApplication(input: z.input<typeof answersSchema>): Promise<ActionResult> {
  const parsed = answersSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check your answers and try again." };
  const user = await getCurrentUser();
  const { applicationId, answers } = parsed.data;
  if (!(await answerWaiting(user.id, applicationId, answers))) return { ok: false, error: "That application could not be found." };
  for (const answer of answers) {
    // a saved question needs at least a few letters to be found again
    if (answer.remember && answer.label.length >= 3) await saveAnswer(user.id, { question: answer.label.replace(/\s*[*\u2731]+\s*$/, ""), answer: answer.value });
  }
  revalidatePath("/applications");
  revalidatePath("/dashboard");
  return { ok: true };
}
