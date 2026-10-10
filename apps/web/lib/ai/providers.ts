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

// a failed call, with the http status when there was one
export class ProviderError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
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
  if (!response.ok) throw new ProviderError(`Request failed with status ${response.status}`, response.status);
  return (await response.json()) as Record<string, unknown>;
}

// groq, which speaks the same format as openai
export function groqCall(apiKey: string): ProviderCall {
  return async ({ system, prompt, json, model, signal }) => {
    const data = await postJson(
      "https://api.groq.com/openai/v1/chat/completions",
      apiKey,
      {
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
        ...(json ? { response_format: { type: "json_object" } } : {}),
      },
      signal,
    );
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
