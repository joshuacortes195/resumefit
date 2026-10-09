import { z } from "zod";

// turns "true" / "false" strings from the env file into real booleans
const flag = (fallback: boolean) =>
  z
    .enum(["true", "false"])
    .default(fallback ? "true" : "false")
    .transform((value) => value === "true");

// everything the server reads from the environment
const serverSchema = z.object({
  DATABASE_URL: z.string().min(1).optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  INVITE_ONLY: flag(true),
  ENCRYPTION_KEY: z.string().min(32).optional(),
  // free ai providers, all optional so the app runs without them
  AI_PROVIDER_ORDER: z.string().default("gemini,groq,cloudflare"),
  GEMINI_API_KEY: z.string().min(1).optional(),
  GEMINI_MODEL: z.string().min(1).optional(),
  GEMINI_MODEL_FAST: z.string().min(1).optional(),
  GROQ_API_KEY: z.string().min(1).optional(),
  GROQ_MODEL: z.string().min(1).optional(),
  CF_ACCOUNT_ID: z.string().min(1).optional(),
  CF_API_TOKEN: z.string().min(1).optional(),
  CF_MODEL: z.string().min(1).optional(),
});

// the values that are safe to ship to the browser
const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_EXTENSION_ID: z.string().regex(/^[a-p]{32}$/).optional(),
});

// prints which env vars are wrong instead of a wall of zod output
function parse<T extends z.ZodType>(schema: T, values: unknown): z.infer<T> {
  const result = schema.safeParse(values);
  if (!result.success) {
    const problems = result.error.issues.map((issue) => `  ${issue.path.join(".")}: ${issue.message}`);
    throw new Error(`Invalid environment variables:\n${problems.join("\n")}`);
  }
  return result.data;
}

// public vars have to be read by name so next can inline them
export const publicEnv = parse(publicSchema, {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_EXTENSION_ID: process.env.NEXT_PUBLIC_EXTENSION_ID || undefined,
});

// only call this on the server
export function serverEnv() {
  return parse(serverSchema, process.env);
}

// the order we try the ai providers in
export function aiProviderOrder(): string[] {
  return serverEnv()
    .AI_PROVIDER_ORDER.split(",")
    .map((name) => name.trim().toLowerCase())
    .filter(Boolean);
}
