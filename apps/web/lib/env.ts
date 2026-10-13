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
  // the newer name for the same secret
  SUPABASE_SECRET_KEY: z.string().min(1).optional(),
  INVITE_ONLY: flag(true),
  // shows the google button on the sign in page. only turn it on once google is set up as a provider in supabase
  GOOGLE_SIGN_IN: flag(false),
  ENCRYPTION_KEY: z.string().min(32).optional(),
  // the owner's email. whoever signs in with it needs no invite code and is always an admin, which is the way back in if the admin account is ever lost
  ADMIN_EMAIL: z.email().optional(),
  // sent by the host with its scheduled visits, so nobody else can set off the daily job refresh
  CRON_SECRET: z.string().min(16).optional(),
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
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || undefined,
  // supabase now calls this the publishable key, either name works
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || undefined,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || undefined,
  NEXT_PUBLIC_EXTENSION_ID: process.env.NEXT_PUBLIC_EXTENSION_ID || undefined,
});

// only call this on the server
export function serverEnv() {
  // a line left empty in the env file means "not set", the same as leaving the line out
  const env = parse(serverSchema, Object.fromEntries(Object.entries(process.env).filter(([, value]) => value !== "")));
  // the supabase and vercel integration fills in the database address under its own name, so that one is accepted too
  return { ...env, DATABASE_URL: env.DATABASE_URL ?? (process.env.POSTGRES_URL || undefined) };
}

// the address the app is reached at, used in sign in links.
// set by hand it wins, on vercel the project's own address is used, and otherwise it is your own machine
export function appUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return "http://localhost:3000";
}

// the order we try the ai providers in
export function aiProviderOrder(): string[] {
  return serverEnv()
    .AI_PROVIDER_ORDER.split(",")
    .map((name) => name.trim().toLowerCase())
    .filter(Boolean);
}
