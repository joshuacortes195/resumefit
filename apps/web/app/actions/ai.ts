"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import type { ActionResult } from "@/app/actions/scans";
import { getDb, schema } from "@/db";
import { encrypt } from "@/lib/ai/crypto";
import { DEFAULT_MODELS, geminiCall } from "@/lib/ai/providers";
import { generateText } from "@/lib/ai/router";
import { encryptionSecret } from "@/lib/ai/secret";
import { getCurrentUser } from "@/lib/auth";
import { serverEnv } from "@/lib/env";

const keySchema = z.string().trim().min(20, "That key looks too short. Copy the whole thing from Google AI Studio.").max(200, "That key looks too long.");

// asks gemini for one word with the given key, to see if the key works
async function tryKey(userId: string, key: string): Promise<string | null> {
  const env = serverEnv();
  const model = env.GEMINI_MODEL_FAST ?? DEFAULT_MODELS.gemini.fast;
  try {
    await generateText("bullets", { system: "Reply with the single word: ready", prompt: "Are you there?" }, { userId, untracked: true, timeoutMs: 12_000, providers: [{ name: "gemini", call: geminiCall(key), model, fastModel: model }] });
    return null;
  } catch {
    return "Gemini did not accept that key. Check that you copied all of it and that the Gemini API is turned on for it.";
  }
}

// checks a gemini key without saving it
export async function testOwnKey(key: string): Promise<ActionResult> {
  const parsed = keySchema.safeParse(key);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the key." };
  const user = await getCurrentUser();
  const problem = await tryKey(user.id, parsed.data);
  return problem ? { ok: false, error: problem } : { ok: true };
}

// saves someone's own gemini key, encrypted, after making sure it works
export async function saveOwnKey(key: string): Promise<ActionResult> {
  const parsed = keySchema.safeParse(key);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the key." };
  const secret = encryptionSecret();
  if (!secret) return { ok: false, error: "Saving keys is not set up on this server yet. The ENCRYPTION_KEY setting is missing." };
  const user = await getCurrentUser();
  const problem = await tryKey(user.id, parsed.data);
  if (problem) return { ok: false, error: problem };

  const encryptedKey = encrypt(parsed.data, secret);
  const db = await getDb();
  await db
    .insert(schema.userAiKeys)
    .values({ userId: user.id, provider: "gemini", encryptedKey })
    .onConflictDoUpdate({ target: [schema.userAiKeys.userId, schema.userAiKeys.provider], set: { encryptedKey } });
  revalidatePath("/settings");
  return { ok: true };
}

// forgets the saved key
export async function removeOwnKey(): Promise<ActionResult> {
  const user = await getCurrentUser();
  const db = await getDb();
  await db.delete(schema.userAiKeys).where(and(eq(schema.userAiKeys.userId, user.id), eq(schema.userAiKeys.provider, "gemini")));
  revalidatePath("/settings");
  return { ok: true };
}
