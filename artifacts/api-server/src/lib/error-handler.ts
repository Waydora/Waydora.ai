import type { Request, Response, NextFunction, ErrorRequestHandler } from "express";
import { logger } from "./logger";
import { isProduction } from "./env";

/** Extracts a sane HTTP status code from an unknown error, defaulting to 500. */
function statusFromError(err: unknown): number {
  if (typeof err === "object" && err !== null) {
    const candidate =
      (err as { status?: unknown }).status ??
      (err as { statusCode?: unknown }).statusCode;
    if (
      typeof candidate === "number" &&
      Number.isInteger(candidate) &&
      candidate >= 400 &&
      candidate <= 599
    ) {
      return candidate;
    }
  }
  return 500;
}

/**
 * Global Express error handler. Logs the error in a structured way and replies
 * with a user-friendly JSON body. Internal details (stack/message) are never
 * leaked to clients in production.
 */
export const errorHandler: ErrorRequestHandler = (
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
) => {
  const status = statusFromError(err);

  // Prefer the per-request logger from pino-http (carries req.id), fall back
  // to the shared logger.
  const log = req.log ?? logger;
  log.error({ err, status, reqId: req.id }, "Unhandled request error");

  // If headers were already sent, delegate to Express's default handler so the
  // connection is torn down correctly instead of attempting a second response.
  if (res.headersSent) {
    return;
  }

  const userMessage =
    status >= 500
      ? "Something went wrong on our side. Please try again."
      : "The request could not be completed.";

  const body: { error: string; detail?: string } = { error: userMessage };

  if (!isProduction && err instanceof Error && err.message) {
    body.detail = err.message;
  }

  res.status(status).json(body);
};
