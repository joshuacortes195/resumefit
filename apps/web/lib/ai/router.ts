import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { plainAnswer } from "@/lib/ai/clean";
import { decrypt } from "@/lib/ai/crypto";
import { globalCapReached, logFailure, logUsage, remainingToday, userCapReached, type AiFeature } from "@/lib/ai/limits";
import { mockCall } from "@/lib/ai/mock";
import { encryptionSecret } from "@/lib/ai/secret";
import { cloudflareCall, DEFAULT_MODELS, geminiCall, groqCall, isModelProblem, PROVIDERS, ProviderError, type ProviderCall, type ProviderName } from "@/lib/ai/providers";
import { aiProviderOrder, serverEnv } from "@/lib/env";
import { withinLimit } from "@/lib/rate-limit";

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
// own marks a key the person saved themselves, its faults say nothing about the shared ones
export type ReadyProvider = { name: ProviderName; call: ProviderCall; model: string; fastModel: string; own?: boolean };

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
    // a call that worked clears the old problem, so settings stops showing a fault that is over
    entry.lastError = null;
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
    if (key) ready.push({ name: "gemini", call: geminiCall(key), model: env.GEMINI_MODEL ?? DEFAULT_MODELS.gemini.main, fastModel: env.GEMINI_MODEL_FAST ?? DEFAULT_MODELS.gemini.fast, own: true });
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
    // one person's share of the day, then how fast they are going, then the allowance everyone shares
    if (await userCapReached(options.userId)) throw new AiLimitError("You have used all of your AI actions for today. They reset at midnight.");
    if (!(await withinLimit(options.userId, "ai"))) throw new AiLimitError("That is a lot of AI requests in a short time. Wait a minute and try again.");
    if (await globalCapReached()) throw new AiLimitError("The shared AI allowance for today is used up. It resets at midnight.");
  }
  return providers;
}

// how long one model gets to answer before the next one is tried. people are waiting on these, so it is kept short
const DEFAULT_TIMEOUT_MS = 15_000;
// a model that fails this many times in a row is left alone for a while, so nobody waits out its timeout again and again
const BREAKER_FAILS = 2;
const BREAKER_REST_MS = 10 * 60_000;

// which models are being rested and until when, by "provider/model"
type Breakers = Record<string, { fails: number; until: number }>;
const globalForBreakers = globalThis as unknown as { aiBreakers?: Breakers };
const breakers = (globalForBreakers.aiBreakers ??= {});

// the rested models, with what other copies of the app wrote to the database mixed in
async function loadBreakers(): Promise<Breakers> {
  try {
    const db = await getDb();
    const [row] = await db.select({ value: schema.appSettings.value }).from(schema.appSettings).where(eq(schema.appSettings.key, "ai-breakers")).limit(1);
    for (const [key, saved] of Object.entries((row?.value ?? {}) as Breakers)) {
      const mine = breakers[key];
      if (!mine || saved.until > mine.until) breakers[key] = saved;
    }
  } catch {
    // memory alone still works, it just forgets sooner
  }
  return breakers;
}

// writes the rested models down so every copy of the app skips them, quietly giving up if that fails
async function saveBreakers(): Promise<void> {
  try {
    const db = await getDb();
    await db.insert(schema.appSettings).values({ key: "ai-breakers", value: breakers }).onConflictDoUpdate({ target: schema.appSettings.key, set: { value: breakers } });
  } catch {
    // never a reason to fail a request
  }
}

// notes a failed call against a model and starts its rest once it has failed enough. a rate limit is not counted, that clears on its own
async function tripBreaker(key: string, error: unknown): Promise<void> {
  if (error instanceof ProviderError && error.status === 429) return;
  const entry = (breakers[key] ??= { fails: 0, until: 0 });
  entry.fails += 1;
  if (entry.fails < BREAKER_FAILS) return;
  entry.until = Date.now() + BREAKER_REST_MS;
  console.warn(`ai model ${key} failed ${entry.fails} times in a row, skipping it for ${BREAKER_REST_MS / 60_000} minutes`);
  await saveBreakers();
}

// a good answer ends a model's rest and clears its count
async function resetBreaker(key: string): Promise<void> {
  if (!breakers[key]) return;
  const wasResting = breakers[key].until > 0;
  delete breakers[key];
  if (wasResting) await saveBreakers();
}

// for tests, forgets every rested model here and in the database
export async function clearBreakers(): Promise<void> {
  for (const key of Object.keys(breakers)) delete breakers[key];
  const db = await getDb();
  await db.delete(schema.appSettings).where(eq(schema.appSettings.key, "ai-breakers"));
}

// tries each provider in turn until one gives a usable answer
async function attempt<T>(
  feature: AiFeature,
  options: GenerateOptions,
  run: (provider: ReadyProvider, model: string, signal: AbortSignal) => Promise<{ value: T; tokensIn: number; tokensOut: number }>,
): Promise<T> {
  const providers = await prepare(feature, options);
  // every model that could be asked, in order: the one that was wanted first, then the provider's smaller one in case the first is not on offer for this key
  const candidates = providers.flatMap((provider) => {
    const wanted = options.fast ? provider.fastModel : provider.model;
    const models = wanted === provider.fastModel ? [wanted] : [wanted, provider.fastModel];
    return models.map((model) => ({ provider, model, key: `${provider.name}/${model}`, wantedKey: `${provider.name}/${wanted}` }));
  });
  // models that keep failing are skipped while they rest. if that would leave nobody to ask, everyone gets a try anyway
  const rested = options.untracked ? {} : await loadBreakers();
  // a provider's smaller model is only a stand in for a main one that is missing, so while the main one rests the stand in is skipped too
  const asleep = (key: string) => (rested[key]?.until ?? 0) > Date.now();
  const resting = (candidate: (typeof candidates)[number]) => !candidate.provider.own && (asleep(candidate.key) || asleep(candidate.wantedKey));
  const awake = candidates.filter((candidate) => !resting(candidate));
  const queue = awake.length > 0 ? awake : candidates;
  // a provider that failed for a reason that is not about one model is done for this request
  const givenUp = new Set<ReadyProvider>();

  for (const { provider, model, key } of queue) {
    if (givenUp.has(provider)) continue;
    try {
      const { value, tokensIn, tokensOut } = await run(provider, model, AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS));
      // the first good call on this copy of the app is written down, and so is one that follows a problem. that is what lets a saved problem be cleared
      const worthSaving = !options.untracked && (!health[provider.name]?.lastOk || Boolean(health[provider.name]?.lastError));
      if (!options.untracked) record(provider.name);
      if (worthSaving) await saveHealth(provider.name);
      if (!options.untracked && !provider.own) await resetBreaker(key);
      if (!options.untracked) await logUsage({ userId: options.userId, feature, provider: provider.name, model, tokensIn, tokensOut });
      // fancy dashes, quotes and spaces are swapped for plain ones before anything is shown or saved
      return plainAnswer(value);
    } catch (error) {
      // rate limits, outages, timeouts and unusable answers all mean "try the next one"
      // someone trying out a key of their own is not news about the shared providers, so nothing is noted down for that
      if (!options.untracked) {
        record(provider.name, error instanceof Error ? error : new Error("unknown error"));
        // also into the server log and the database, so the reason can be found afterwards
        console.error(`ai provider ${provider.name} (${model}) failed for ${feature}: ${health[provider.name]?.lastError ?? "unknown"}`);
        await saveHealth(provider.name);
        if (!provider.own) await tripBreaker(key, error);
      }
      // "wants billing", "not allowed" and "no such model" are about that one model, so the smaller one is worth a try.
      // anything else, like a rate limit, is about the whole provider, so move on to the next
      // groq says a retired model with a 400, so the reason it gives counts too, not only the status
      if (!isModelProblem(error)) givenUp.add(provider);
    }
  }
  // nobody answered. it still cost calls to the providers, so it is counted
  if (!options.untracked) await logFailure(options.userId, feature);
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
