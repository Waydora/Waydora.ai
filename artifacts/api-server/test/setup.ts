/**
 * Global test setup.
 *
 * `src/lib/env.ts` validates `process.env` at import time and calls
 * `process.exit(1)` if a required variable (e.g. ANTHROPIC_API_KEY) is missing.
 * Several modules under test import `./env` transitively, so we provide a
 * minimal valid environment here to keep that fail-fast path from aborting the
 * Vitest process. Tests that need to control `isProduction`/`allowedOrigins`
 * mock the `./env` module directly instead of relying on these values.
 */
if (!process.env.ANTHROPIC_API_KEY) {
  process.env.ANTHROPIC_API_KEY = "test-key";
}
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = "test";
}
