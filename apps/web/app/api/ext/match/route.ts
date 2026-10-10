import { z } from "zod";
import { ANSWER_KEYS, MATCHING_SYSTEM, matchingPrompt } from "@/lib/ai/prompts/matching";
import { AiBusyError, AiLimitError, AiUnavailableError, generateJSON } from "@/lib/ai/router";
import { ExtError, extRoute, preflight } from "@/lib/ext-auth";

export const OPTIONS = preflight;

const matchSchema = z.object({
  // questions on the form that the extension did not recognize by itself
  fields: z.array(z.object({ id: z.string().min(1).max(40), label: z.string().trim().min(3).max(300), options: z.array(z.string().max(80)).max(15).optional() })).max(30),
  // the names of the answers this person has something saved for
  keys: z.array(z.string().max(40)).max(60),
});

const replyShape = z.object({ matches: z.array(z.object({ id: z.string(), key: z.string().nullable() })) });

// works out which saved answer each unrecognized question is asking for. only the form's wording goes to the model, and it can only point at an answer, never write one
export const POST = extRoute(async (request, user) => {
  const parsed = matchSchema.safeParse(await request.json());
  if (!parsed.success) throw new ExtError("Those questions could not be read.");
  const keys = parsed.data.keys.filter((key) => key in ANSWER_KEYS);
  const { fields } = parsed.data;
  if (fields.length === 0 || keys.length === 0) return { matches: [] };

  try {
    const reply = await generateJSON("matching", { system: MATCHING_SYSTEM, prompt: matchingPrompt({ fields, keys }) }, replyShape, { userId: user.id, fast: true });
    // only real questions and real answer names get through
    const ids = new Set(fields.map((field) => field.id));
    return { matches: reply.matches.filter((match): match is { id: string; key: string } => match.key !== null && ids.has(match.id) && keys.includes(match.key)) };
  } catch (error) {
    if (error instanceof AiBusyError || error instanceof AiLimitError || error instanceof AiUnavailableError) throw new ExtError(error.message, 503);
    throw error;
  }
});
