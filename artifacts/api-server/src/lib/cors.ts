import type { CorsOptions } from "cors";
import { allowedOrigins, isProduction } from "./env";

/**
 * Restricted CORS policy (Task #12).
 *
 * - Allows the configured production origins (defaults: waydora.com).
 * - Outside production, additionally allows any `http://localhost:<port>` for
 *   local development.
 * - Permits requests without an `Origin` header (curl, health checks,
 *   server-to-server) — these are not subject to the browser same-origin
 *   policy anyway.
 */
const LOCALHOST_PATTERN = /^http:\/\/localhost(?::\d+)?$/;

export const corsOptions: CorsOptions = {
  origin(origin, callback) {
    // No Origin header: allow (non-browser clients, same-origin, health).
    if (!origin) {
      callback(null, true);
      return;
    }

    if (allowedOrigins().includes(origin)) {
      callback(null, true);
      return;
    }

    if (!isProduction && LOCALHOST_PATTERN.test(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error(`Origin not allowed by CORS: ${origin}`));
  },
};
