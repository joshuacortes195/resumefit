import type { CurrentUser } from "@/lib/auth";
import { userForToken } from "@/lib/data/extension";
import { safeErrorText } from "@/lib/log";
import { RateLimitError } from "@/lib/rate-limit";

// headers that let the extension, and only an extension, call these endpoints from its own pages
export function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("origin") ?? "";
  const allowed = process.env.NEXT_PUBLIC_EXTENSION_ID ? origin === `chrome-extension://${process.env.NEXT_PUBLIC_EXTENSION_ID}` : origin.startsWith("chrome-extension://");
  return allowed ? { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Headers": "Authorization, Content-Type", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", Vary: "Origin" } : {};
}

// the answer to the browser's "may I call this" check
export function preflight(request: Request): Response {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}

// a json answer with the cors headers on it
export function extJson(request: Request, body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: corsHeaders(request) });
}

// works out who the extension is acting for from its connection key
export async function extUser(request: Request): Promise<CurrentUser | null> {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  return token ? userForToken(token) : null;
}

// wraps an extension endpoint: checks the key, catches errors, adds the headers
export function extRoute(handler: (request: Request, user: CurrentUser, context: { params: Promise<Record<string, string>> }) => Promise<unknown>) {
  return async (request: Request, context: { params: Promise<Record<string, string>> }): Promise<Response> => {
    try {
      const user = await extUser(request);
      if (!user) return extJson(request, { error: "The extension is not connected. Open ResumeFit and connect it again." }, 401);
      const result = await handler(request, user, context);
      return result instanceof Response ? result : extJson(request, result);
    } catch (error) {
      // our own messages are safe to show, anything else gets a plain one
      const known = error instanceof ExtError || error instanceof RateLimitError;
      if (!known) console.error(safeErrorText(error, "extension request failed"));
      return extJson(request, { error: known ? error.message : "Something went wrong on our side. Try again in a moment." }, known ? error.status : 500);
    }
  };
}

// a problem we can explain to the person using the extension
export class ExtError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
