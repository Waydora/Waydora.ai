import { describe, expect, it, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";
import { asyncHandler } from "../src/lib/async-handler";

const fakeReq = {} as Request;
const fakeRes = {} as Response;

describe("asyncHandler", () => {
  it("does not call next when the wrapped handler resolves", async () => {
    const next = vi.fn() as unknown as NextFunction;
    const handler = asyncHandler(async () => {
      return "ok";
    });

    handler(fakeReq, fakeRes, next);
    // Allow the resolved promise microtask to flush.
    await Promise.resolve();

    expect(next).not.toHaveBeenCalled();
  });

  it("forwards the rejection to next(err)", async () => {
    const next = vi.fn() as unknown as NextFunction;
    const boom = new Error("boom");
    const handler = asyncHandler(async () => {
      throw boom;
    });

    handler(fakeReq, fakeRes, next);
    // Wait for the catch to run.
    await new Promise((resolve) => setImmediate(resolve));

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(boom);
  });

  it("forwards a rejected promise-chain (non-async fn) to next(err)", async () => {
    const next = vi.fn() as unknown as NextFunction;
    const boom = new Error("chain boom");
    // Non-async fn that returns a rejected promise — the wrapper's .catch must
    // still forward it (covers handlers refactored to plain promise chains).
    const handler = asyncHandler(() => Promise.reject(boom));

    handler(fakeReq, fakeRes, next);
    await new Promise((resolve) => setImmediate(resolve));

    expect(next).toHaveBeenCalledWith(boom);
  });
});
