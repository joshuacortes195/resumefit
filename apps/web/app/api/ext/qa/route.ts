import { saveAnswer } from "@/lib/data/profile";
import { ExtError, extRoute, preflight } from "@/lib/ext-auth";
import { qaSchema } from "@/lib/profile";

export const OPTIONS = preflight;

// saves an answer to the question bank so it is reused next time
export const POST = extRoute(async (request, user) => {
  const parsed = qaSchema.safeParse(await request.json());
  if (!parsed.success) throw new ExtError("There is no answer to save yet.");
  await saveAnswer(user.id, parsed.data);
  return { saved: true };
});
