import { GoogleGenAI } from "@google/genai";

// the free services we can send writing requests to
export const PROVIDERS = ["gemini", "groq", "cloudflare"] as const;
export type ProviderName = (typeof PROVIDERS)[number];

// one request to a provider
export type ProviderRequest = {
  system: string;
  prompt: string;
  // ask for a json reply
  json: boolean;
  // the shape the json has to follow, for providers that can enforce it
  jsonSchema?: unknown;
  model: string;
  signal: AbortSignal;
};

export type ProviderReply = { text: string; tokensIn: number; tokensOut: number };

// a failed call, with the http status when there was one and the provider's own short code for what went wrong
export class ProviderError extends Error {
  constructor(
    message: string,
    public status?: number,
    public code?: string,
  ) {
    super(message);
  }
}

// true when the fault is with the one model that was asked for, not the provider or the request: retired, renamed, or not on offer for this key
export function isModelProblem(error: unknown): boolean {
  if (!(error instanceof ProviderError)) return false;
  return error.status === 402 || error.status === 403 || error.status === 404 || /model_(decommissioned|not_found|not_active)|model.*(decommission|not found|does not exist|no longer)/i.test(`${error.code ?? ""} ${error.message}`);
}

// the reason a provider gave for turning a request down, read from the body of its answer.
// groq and cloudflare each have their own shape. this only ever goes to the server log and the admin page
export function errorDetail(body: string): { code?: string; message?: string } {
  try {
    const data = JSON.parse(body) as { error?: { code?: unknown; type?: unknown; message?: unknown } | string; errors?: { code?: unknown; message?: unknown }[] };
    const first = typeof data.error === "object" && data.error ? data.error : data.errors?.[0];
    if (typeof data.error === "string") return { message: data.error.slice(0, 200) };
    if (!first) return {};
    const code = first.code ?? (first as { type?: unknown }).type;
    return { code: code === undefined || code === null ? undefined : String(code).slice(0, 60), message: typeof first.message === "string" ? first.message.slice(0, 200) : undefined };
  } catch {
    return {};
  }
}

// something that can answer a request, the real ones below or a fake one in tests
export type ProviderCall = (request: ProviderRequest) => Promise<ProviderReply>;

// the models used when the environment does not name one, all on free tiers
export const DEFAULT_MODELS: Record<ProviderName, { main: string; fast: string }> = {
  gemini: { main: "gemini-3.8-flash", fast: "gemini-3.5-flash-lite" },
  // groq retired its llama models on the free tier in august 2026, these are the replacements it names
  groq: { main: "openai/gpt-oss-120b", fast: "openai/gpt-oss-20b" },
  cloudflare: { main: "@cf/meta/llama-3.3-70b-instruct-fp8-fast", fast: "@cf/meta/llama-3.1-8b-instruct" },
};

// pulls a status code out of whatever a library throws
function statusOf(error: unknown): number | undefined {
  const status = (error as { status?: unknown })?.status;
  return typeof status === "number" ? status : undefined;
}

// google gemini through its own library
export function geminiCall(apiKey: string): ProviderCall {
  const client = new GoogleGenAI({ apiKey });
  return async ({ system, prompt, json, jsonSchema, model, signal }) => {
    const run = (withSchema: boolean) =>
      client.models.generateContent({
        model,
        contents: prompt,
        config: {
          systemInstruction: system,
          abortSignal: signal,
          ...(json ? { responseMimeType: "application/json" } : {}),
          ...(json && withSchema && jsonSchema ? { responseJsonSchema: jsonSchema } : {}),
        },
      });
    try {
      let response;
      try {
        response = await run(true);
      } catch (error) {
        // some schemas are too fancy for the api, in that case ask again without one
        if (statusOf(error) !== 400 || !jsonSchema) throw error;
        response = await run(false);
      }
      return { text: response.text ?? "", tokensIn: response.usageMetadata?.promptTokenCount ?? 0, tokensOut: response.usageMetadata?.candidatesTokenCount ?? 0 };
    } catch (error) {
      throw new ProviderError(error instanceof Error ? error.message : "Gemini request failed", statusOf(error));
    }
  };
}

// reads a json answer from a plain http call, turning bad statuses into errors
async function postJson(url: string, token: string, body: unknown, signal: AbortSignal): Promise<Record<string, unknown>> {
  const response = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body), signal });
  if (!response.ok) {
    const answer = await response.text().catch(() => "");
    // the shape of what was sent and the provider's own answer, in the server log only. the text of the prompt is left out, its size is enough
    const sent = body as { model?: unknown; messages?: { role?: string; content?: string }[]; response_format?: unknown } & Record<string, unknown>;
    console.error(
      `ai request refused: ${response.status} from ${new URL(url).host}, model ${String(sent.model ?? "(in the address)")}, fields [${Object.keys(sent).join(", ")}], messages ${(sent.messages ?? []).map((message) => `${message.role}:${message.content?.length ?? 0} chars`).join(" + ")}, response_format ${JSON.stringify(sent.response_format ?? null)}. answer: ${answer.slice(0, 600)}`,
    );
    // keep what the provider said about why. a bare "status 400" tells nobody what to fix
    const detail = errorDetail(answer);
    const reason = [detail.code, detail.message].filter(Boolean).join(": ");
    throw new ProviderError(`Request failed with status ${response.status}${reason ? ` (${reason})` : ""}`, response.status, detail.code);
  }
  return (await response.json()) as Record<string, unknown>;
}

// groq, which speaks the same format as openai
export function groqCall(apiKey: string): ProviderCall {
  return async ({ system, prompt, json, model, signal }) => {
    const send = (strictJson: boolean) =>
      postJson(
        "https://api.groq.com/openai/v1/chat/completions",
        apiKey,
        {
          model,
          messages: [
            { role: "system", content: system },
            { role: "user", content: prompt },
          ],
          ...(strictJson ? { response_format: { type: "json_object" } } : {}),
        },
        signal,
      );
    let data: Record<string, unknown>;
    try {
      data = await send(json);
    } catch (error) {
      // in json mode groq answers 400 when the model's own output is not valid json, or the model does not do json mode.
      // the prompt already asks for json and the reply is checked afterwards, so ask once more without the strict mode
      if (!json || !(error instanceof ProviderError) || error.status !== 400 || isModelProblem(error)) throw error;
      data = await send(false);
    }
    const choices = data.choices as { message?: { content?: string } }[] | undefined;
    const usage = data.usage as { prompt_tokens?: number; completion_tokens?: number } | undefined;
    return { text: choices?.[0]?.message?.content ?? "", tokensIn: usage?.prompt_tokens ?? 0, tokensOut: usage?.completion_tokens ?? 0 };
  };
}

// cloudflare workers ai
export function cloudflareCall(accountId: string, apiToken: string): ProviderCall {
  return async ({ system, prompt, json, model, signal }) => {
    const data = await postJson(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`,
      apiToken,
      {
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
        ...(json ? { response_format: { type: "json_object" } } : {}),
      },
      signal,
    );
    const result = data.result as { response?: unknown; usage?: { prompt_tokens?: number; completion_tokens?: number } } | undefined;
    // json replies sometimes come back already parsed
    const text = typeof result?.response === "string" ? result.response : JSON.stringify(result?.response ?? "");
    return { text, tokensIn: result?.usage?.prompt_tokens ?? 0, tokensOut: result?.usage?.completion_tokens ?? 0 };
  };
}
