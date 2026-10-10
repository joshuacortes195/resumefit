import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { decrypt } from "@/lib/ai/crypto";
import { globalCapReached, logUsage, remainingToday, type AiFeature } from "@/lib/ai/limits";
import { mockCall } from "@/lib/ai/mock";
import { encryptionSecret } from "@/lib/ai/secret";
import { cloudflareCall, DEFAULT_MODELS, geminiCall, groqCall, PROVIDERS, ProviderError, type ProviderCall, type ProviderName } from "@/lib/ai/providers";
import { aiProviderOrder, serverEnv } from "@/lib/env";

// shown when every provider is rate limited or down
export class AiBusyError extends Error {
  constructor() {
    super("AI is busy, try again in a bit.");
  }
}

// shown when no provider has a key set up
export class AiUnavailableError extends Error {
  constructor() {
    super("AI features are not set up yet. Add a free Gemini key in Settings to turn them on.");
  }
}

// shown when someone has used a feature as many times as the day allows
export class AiLimitError extends Error {
  constructor(message = "You have used all of today's AI actions for this. They reset at midnight.") {
    super(message);
  }
}

// a provider that is ready to be called
export type ReadyProvider = { name: ProviderName; call: ProviderCall; model: string; fastModel: string };

export type GenerateOptions = {
  userId: string;
  // the smaller, quicker model is enough for short jobs
  fast?: boolean;
  // tests pass their own providers here instead of the real ones
  providers?: ReadyProvider[];
  timeoutMs?: number;
  // skips the daily cap check and the usage log, used when testing a key
  untracked?: boolean;
};

// what the last call to each provider looked like, for the admin page
export type ProviderHealth = { lastOk: Date | null; lastError: string | null; lastErrorAt: Date | null; rateLimitHits: number };
const globalForAi = globalThis as unknown as { aiHealth?: Record<string, ProviderHealth> };
const health = (globalForAi.aiHealth ??= {});

export function providerHealth(): Record<string, ProviderHealth> {
  return health;
}

// the same notes, kept in the database. on a host that runs many short lived copies of the app,
// memory alone would lose the reason a provider failed before anyone could read it
export async function savedProviderHealth(): Promise<Record<string, ProviderHealth>> {
  try {
    const db = await getDb();
    const [row] = await db.select({ value: schema.appSettings.value }).from(schema.appSettings).where(eq(schema.appSettings.key, "ai-health")).limit(1);
    const saved = (row?.value ?? {}) as Record<string, { lastOk: string | null; lastError: string | null; lastErrorAt: string | null; rateLimitHits: number }>;
    return Object.fromEntries(Object.entries(saved).map(([name, entry]) => [name, { ...entry, lastOk: entry.lastOk ? new Date(entry.lastOk) : null, lastErrorAt: entry.lastErrorAt ? new Date(entry.lastErrorAt) : null }]));
  } catch {
    return health;
  }
}

// writes the notes for one provider to the database, quietly giving up if that fails
async function saveHealth(name: string): Promise<void> {
  try {
    const entry = health[name];
    if (!entry) return;
    const all = { ...(await savedProviderHealth()), [name]: entry };
    const db = await getDb();
    await db.insert(schema.appSettings).values({ key: "ai-health", value: all }).onConflictDoUpdate({ target: schema.appSettings.key, set: { value: all } });
  } catch {
    // health notes are a nice to have, never a reason to fail a request
  }
}

// notes down how a call went
function record(name: string, error?: ProviderError | Error) {
  const entry = (health[name] ??= { lastOk: null, lastError: null, lastErrorAt: null, rateLimitHits: 0 });
  if (!error) {
    entry.lastOk = new Date();
    return;
  }
  // the status code says most of what went wrong: 429 is a rate limit, 404 a model that does not exist, 400 a request the provider would not take
  const status = error instanceof ProviderError && error.status ? `${error.status}: ` : "";
  entry.lastError = `${status}${error.message}`.slice(0, 300);
  entry.lastErrorAt = new Date();
  if (error instanceof ProviderError && error.status === 429) entry.rateLimitHits += 1;
}

// the providers that have keys, in the order from the environment, with the user's own key first
export async function readyProviders(userId?: string): Promise<ReadyProvider[]> {
  const env = serverEnv();
  const ready: ReadyProvider[] = [];
  // the browser tests switch this on so they never need a real key
  if (process.env.AI_MOCK === "1") return [{ name: "gemini", call: mockCall, model: "mock", fastModel: "mock" }];

  // someone who saved their own gemini key gets it tried before the shared ones
  const secret = encryptionSecret();
  if (userId && secret) {
    const db = await getDb();
    const [own] = await db
      .select({ encryptedKey: schema.userAiKeys.encryptedKey })
      .from(schema.userAiKeys)
      .where(and(eq(schema.userAiKeys.userId, userId), eq(schema.userAiKeys.provider, "gemini")))
      .limit(1);
    const key = own ? decrypt(own.encryptedKey, secret) : null;
    if (key) ready.push({ name: "gemini", call: geminiCall(key), model: env.GEMINI_MODEL ?? DEFAULT_MODELS.gemini.main, fastModel: env.GEMINI_MODEL_FAST ?? DEFAULT_MODELS.gemini.fast });
  }

  for (const name of aiProviderOrder()) {
    if (!(PROVIDERS as readonly string[]).includes(name)) continue;
    if (name === "gemini" && env.GEMINI_API_KEY) {
      ready.push({ name, call: geminiCall(env.GEMINI_API_KEY), model: env.GEMINI_MODEL ?? DEFAULT_MODELS.gemini.main, fastModel: env.GEMINI_MODEL_FAST ?? DEFAULT_MODELS.gemini.fast });
    } else if (name === "groq" && env.GROQ_API_KEY) {
      ready.push({ name, call: groqCall(env.GROQ_API_KEY), model: env.GROQ_MODEL ?? DEFAULT_MODELS.groq.main, fastModel: DEFAULT_MODELS.groq.fast });
    } else if (name === "cloudflare" && env.CF_ACCOUNT_ID && env.CF_API_TOKEN) {
      ready.push({ name, call: cloudflareCall(env.CF_ACCOUNT_ID, env.CF_API_TOKEN), model: env.CF_MODEL ?? DEFAULT_MODELS.cloudflare.main, fastModel: DEFAULT_MODELS.cloudflare.fast });
    }
  }
  return ready;
}

// true when at least one provider can be called
export async function aiAvailable(userId?: string): Promise<boolean> {
  return (await readyProviders(userId)).length > 0;
}

// models like to wrap json in a code fence, this takes it off
function unwrapJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = (fenced?.[1] ?? text).trim();
  const start = body.search(/[{[]/);
  return start > 0 ? body.slice(start) : body;
}

// reads a reply as json and checks it against the shape we asked for
function parseReply<T>(text: string, shape: z.ZodType<T>): { ok: true; value: T } | { ok: false; problem: string } {
  try {
    const result = shape.safeParse(JSON.parse(unwrapJson(text)));
    if (result.success) return { ok: true, value: result.data };
    return { ok: false, problem: result.error.issues.slice(0, 5).map((issue) => `${issue.path.join(".") || "reply"}: ${issue.message}`).join("; ") };
  } catch {
    return { ok: false, problem: "the reply was not valid JSON" };
  }
}

// checks the caps before a call and picks the providers to try
async function prepare(feature: AiFeature, options: GenerateOptions): Promise<ReadyProvider[]> {
  const providers = options.providers ?? (await readyProviders(options.userId));
  if (providers.length === 0) throw new AiUnavailableError();
  if (!options.untracked) {
    if ((await remainingToday(options.userId, feature)) === 0) throw new AiLimitError();
    if (await globalCapReached()) throw new AiLimitError("The shared AI allowance for today is used up. It resets at midnight.");
  }
  return providers;
}

// tries each provider in turn until one gives a usable answer
async function attempt<T>(
  feature: AiFeature,
  options: GenerateOptions,
  run: (provider: ReadyProvider, model: string, signal: AbortSignal) => Promise<{ value: T; tokensIn: number; tokensOut: number }>,
): Promise<T> {
  const providers = await prepare(feature, options);
  for (const provider of providers) {
    const model = options.fast ? provider.fastModel : provider.model;
    try {
      const { value, tokensIn, tokensOut } = await run(provider, model, AbortSignal.timeout(options.timeoutMs ?? 25_000));
      record(provider.name);
      if (health[provider.name]?.lastError) await saveHealth(provider.name);
      if (!options.untracked) await logUsage({ userId: options.userId, feature, provider: provider.name, model, tokensIn, tokensOut });
      return value;
    } catch (error) {
      // rate limits, outages, timeouts and unusable answers all mean "try the next one"
      record(provider.name, error instanceof Error ? error : new Error("unknown error"));
      // also into the server log and the database, so the reason can be found afterwards
      console.error(`ai provider ${provider.name} (${model}) failed for ${feature}: ${health[provider.name]?.lastError ?? "unknown"}`);
      await saveHealth(provider.name);
    }
  }
  throw new AiBusyError();
}

// asks for a json answer in a given shape, with one chance to fix a bad reply
export async function generateJSON<T>(feature: AiFeature, request: { system: string; prompt: string }, shape: z.ZodType<T>, options: GenerateOptions): Promise<T> {
  const jsonSchema = z.toJSONSchema(shape);
  const system = `${request.system}\n\nReply with a single JSON object and nothing else. It must match this JSON schema:\n${JSON.stringify(jsonSchema)}`;

  return attempt(feature, options, async (provider, model, signal) => {
    const first = await provider.call({ system, prompt: request.prompt, json: true, jsonSchema, model, signal });
    const parsed = parseReply(first.text, shape);
    if (parsed.ok) return { value: parsed.value, tokensIn: first.tokensIn, tokensOut: first.tokensOut };

    // tell the model what was wrong and let it try once more
    const repairPrompt = `${request.prompt}\n\nYour last reply could not be used: ${parsed.problem}.\nYour last reply was:\n${first.text.slice(0, 4000)}\n\nSend the corrected JSON object only.`;
    const second = await provider.call({ system, prompt: repairPrompt, json: true, jsonSchema, model, signal });
    const repaired = parseReply(second.text, shape);
    if (!repaired.ok) throw new ProviderError(`Reply did not match the expected shape: ${repaired.problem}`);
    return { value: repaired.value, tokensIn: first.tokensIn + second.tokensIn, tokensOut: first.tokensOut + second.tokensOut };
  });
}

// asks for plain text
export async function generateText(feature: AiFeature, request: { system: string; prompt: string }, options: GenerateOptions): Promise<string> {
  return attempt(feature, options, async (provider, model, signal) => {
    const reply = await provider.call({ system: request.system, prompt: request.prompt, json: false, model, signal });
    if (!reply.text.trim()) throw new ProviderError("Empty reply");
    return { value: reply.text.trim(), tokensIn: reply.tokensIn, tokensOut: reply.tokensOut };
  });
}
