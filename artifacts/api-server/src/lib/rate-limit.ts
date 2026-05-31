import rateLimit from "express-rate-limit";
import type { RequestHandler } from "express";
import { env } from "./env";

// NOTE: express-rate-limit's RateLimitRequestHandler can resolve against the
// Express 4 type tree (telegram-bot uses Express 4, api-server uses Express 5,
// so both @types/express major versions coexist in the monorepo). We pin the
// exported handlers to this package's own Express 5 `RequestHandler` so app.ts
// sees consistent types. The runtime middleware is identical across Express 4/5.

/**
 * Tight limiter for the expensive, AI-backed `/api/chat` endpoint. Defaults to
 * ~20 requests / 5 minutes per IP (configurable via env). The 429 body mirrors
 * the user-friendly Italian copy used in routes/chat.ts.
 */
export const chatRateLimiter: RequestHandler = rateLimit({
  windowMs: env.CHAT_RATE_LIMIT_WINDOW_MS,
  limit: env.CHAT_RATE_LIMIT_MAX,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Troppe richieste, riprova tra poco." },
}) as unknown as RequestHandler;

/**
 * Permissive baseline limiter applied to the rest of `/api` (defaults to
 * 100 requests / minute per IP) as a basic abuse guard.
 */
export const apiRateLimiter: RequestHandler = rateLimit({
  windowMs: env.API_RATE_LIMIT_WINDOW_MS,
  limit: env.API_RATE_LIMIT_MAX,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Troppe richieste, riprova tra poco." },
}) as unknown as RequestHandler;
