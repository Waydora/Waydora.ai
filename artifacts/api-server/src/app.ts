import express, { type Express, type Request, type Response } from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { errorHandler } from "./lib/error-handler";
import { corsOptions } from "./lib/cors";
import { apiRateLimiter, chatRateLimiter } from "./lib/rate-limit";

const app: Express = express();

// Trust the first proxy hop. Railway (and most PaaS) sits behind a reverse
// proxy that sets X-Forwarded-For. Without this, express-rate-limit throws
// ERR_ERL_UNEXPECTED_X_FORWARDED_FOR and can't read the real client IP.
// Use 1 (single hop) rather than `true` to avoid the permissive-trust-proxy
// warning and IP spoofing of the rate limiter.
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// Security headers. This is a JSON API (not an HTML site) so the
// Content-Security-Policy is disabled to avoid breaking non-HTML responses.
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting. The tight chat limiter must be registered before the broader
// /api limiter so the expensive AI endpoint gets its own (stricter) budget.
// The /api limiter skips health checks (see below).
app.use("/api/chat", chatRateLimiter);
app.use("/api", (req, res, next) => {
  // Never throttle health checks.
  if (req.path === "/healthz") {
    next();
    return;
  }
  apiRateLimiter(req, res, next);
});

app.use("/api", router);

// 404 for any unknown /api route. Registered after the router so it only runs
// when no route matched, and before the error handler.
app.use("/api", (_req: Request, res: Response) => {
  res.status(404).json({ error: "Not found" });
});

// Global error handler. Must be the last middleware and keep its 4-arg
// signature so Express recognises it as an error handler.
app.use(errorHandler);

export default app;
