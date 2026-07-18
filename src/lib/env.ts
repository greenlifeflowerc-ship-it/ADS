import { z } from "zod";

/**
 * Central, zod-validated environment access.
 *
 * Everything provider-related is OPTIONAL: the app is designed to boot and render
 * in a "dev/stub" mode when keys are absent (local storage driver + stub providers),
 * so the UI can be built before real services are wired. `features` exposes which
 * capabilities are actually available at runtime.
 */
const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  // ---- App ----
  APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  CRON_SECRET: z.string().min(1).default("dev-cron-secret"),
  WORKER_ID: z.string().optional(),

  // ---- Supabase ----
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional().or(z.literal("")),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional().or(z.literal("")),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional().or(z.literal("")),

  // ---- Storage ----
  STORAGE_DRIVER: z.enum(["local", "cloudinary"]).default("local"),
  CLOUDINARY_CLOUD_NAME: z.string().optional().or(z.literal("")),
  CLOUDINARY_API_KEY: z.string().optional().or(z.literal("")),
  CLOUDINARY_API_SECRET: z.string().optional().or(z.literal("")),

  // ---- Providers (app-level keys) ----
  // Image + video generation have no env keys: they run through the Higgsfield
  // MCP, connected per-user in Settings. Gemini here is analysis (LLM) only.
  ANTHROPIC_API_KEY: z.string().optional().or(z.literal("")),
  GEMINI_API_KEY: z.string().optional().or(z.literal("")),
  GEMINI_LLM_MODEL: z.string().optional().or(z.literal("")),
  ELEVENLABS_API_KEY: z.string().optional().or(z.literal("")),
  ELEVENLABS_VOICE_ID: z.string().optional().or(z.literal("")),
  ELEVENLABS_MODEL: z.string().optional().or(z.literal("")),
  APIFY_TOKEN: z.string().optional().or(z.literal("")),
  APIFY_ADS_ACTOR: z.string().optional().or(z.literal("")),

  // ---- Cost control ----
  BUDGET_MONTHLY_USD: z.coerce.number().optional(),
});

// IMPORTANT: reference each var as an explicit `process.env.X` member so Next.js
// inlines the NEXT_PUBLIC_* ones into the client bundle. Passing `process.env`
// as a whole object is NOT inlined → client sees empty NEXT_PUBLIC vars, which
// desyncs `features` between server (SSR) and browser (hydration mismatch).
// Server-only vars resolve to `undefined` in the browser bundle (never leaked).
const RAW_ENV = {
  NODE_ENV: process.env.NODE_ENV,
  APP_URL: process.env.APP_URL,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  CRON_SECRET: process.env.CRON_SECRET,
  WORKER_ID: process.env.WORKER_ID,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  STORAGE_DRIVER: process.env.STORAGE_DRIVER,
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  GEMINI_LLM_MODEL: process.env.GEMINI_LLM_MODEL,
  ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY,
  ELEVENLABS_VOICE_ID: process.env.ELEVENLABS_VOICE_ID,
  ELEVENLABS_MODEL: process.env.ELEVENLABS_MODEL,
  APIFY_TOKEN: process.env.APIFY_TOKEN,
  APIFY_ADS_ACTOR: process.env.APIFY_ADS_ACTOR,
  BUDGET_MONTHLY_USD: process.env.BUDGET_MONTHLY_USD,
};

const parsed = EnvSchema.safeParse(RAW_ENV);

if (!parsed.success) {
  // With all-optional fields this should never throw, but log if the shape is wrong.
  console.error("Invalid environment variables:", parsed.error.flatten().fieldErrors);
}

export const env = parsed.success ? parsed.data : EnvSchema.parse({});

const nonEmpty = (v?: string): v is string => typeof v === "string" && v.length > 0;

/** Runtime capability flags — drive graceful degradation across the app. */
export const features = {
  supabase: nonEmpty(env.NEXT_PUBLIC_SUPABASE_URL) && nonEmpty(env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  supabaseAdmin: nonEmpty(env.SUPABASE_SERVICE_ROLE_KEY),
  cloudinary:
    env.STORAGE_DRIVER === "cloudinary" &&
    nonEmpty(env.CLOUDINARY_CLOUD_NAME) &&
    nonEmpty(env.CLOUDINARY_API_KEY) &&
    nonEmpty(env.CLOUDINARY_API_SECRET),
  anthropic: nonEmpty(env.ANTHROPIC_API_KEY),
  gemini: nonEmpty(env.GEMINI_API_KEY),
  elevenlabs: nonEmpty(env.ELEVENLABS_API_KEY),
  apify: nonEmpty(env.APIFY_TOKEN),
} as const;

export type Features = typeof features;
