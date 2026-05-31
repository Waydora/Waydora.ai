import type { Request, Response, NextFunction, RequestHandler } from "express";

/**
 * Wraps an async Express route handler so that any rejected promise is
 * forwarded to `next(err)` and picked up by the global error handler.
 *
 * Express 5 already forwards rejected promises from async handlers, but
 * wrapping keeps the behaviour explicit and consistent across the codebase
 * (and stays correct if a handler is refactored to return a promise chain
 * without `async`).
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => unknown,
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
