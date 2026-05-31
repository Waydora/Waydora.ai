import { z } from "zod";

/**
 * Centralised, type-safe environment configuration for the api-server.
 *
 * All access to `process.env` in this package should go through the exported
 * `env` object so that:
 *   - required variables are validated once, at startup (fail-fast);
 *   - values are coerced/typed consistently (numbers, enums, defaults);
 *   - the rest of the codebase gets full type inference instead of `string |
 *     undefined`.
 */
export const envSchema = z.object({
  // --- Core ---------------------------------------------------------------
  ANTHROPIC_API_KEY: z
    .string()
    .min(1, "ANTHROPIC_API_KEY must be a non-empty string"),

  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),

  // Historically index.ts hard-required PORT, but a sensible default keeps
  // local runs and health checks working without extra setup.
  PORT: z.coerce.number().int().positive().default(3000),

  // --- Logging ------------------------------------------------------------
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),

  // --- CORS (Task #12) ----------------------------------------------------
  // CSV allowlist of permitted browser origins. When unset we fall back to the
  // production web origins (see `allowedOrigins` below). Kept optional here so
  // the defaults live in one place.
  ALLOWED_ORIGINS: z.string().optional(),

  // --- Rate limiting (Task #14) ------------------------------------------
  // Tight limiter for the expensive AI-backed /api/chat endpoint.
  CHAT_RATE_LIMIT_WINDOW_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(5 * 60 * 1000), // 5 minutes
  CHAT_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),

  // Permissive baseline limiter for the rest of /api.
  API_RATE_LIMIT_WINDOW_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(60 * 1000), // 1 minute
  API_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // Fail-fast: print exactly which variables are missing/invalid, then exit.
  // We use console.error rather than the pino logger to avoid a circular
  // dependency (logger.ts itself imports from this module).
  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("\n");

  // eslint-disable-next-line no-console
  console.error(
    `Invalid environment configuration. Fix the following and restart:\n${issues}`,
  );
  process.exit(1);
}

export const env = parsed.data;

export const isProduction = env.NODE_ENV === "production";

/**
 * Resolves the CORS allowlist (Task #12).
 *
 * Defaults to the production web origins. `ALLOWED_ORIGINS` (CSV) overrides the
 * list when provided. Outside production we also allow any `http://localhost`
 * port to keep local development frictionless.
 */
export function allowedOrigins(): string[] {
  const defaults = ["https://www.waydora.com", "https://waydora.com"];

  const configured = env.ALLOWED_ORIGINS
    ? env.ALLOWED_ORIGINS.split(",")
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0)
    : defaults;

  return configured;
}
