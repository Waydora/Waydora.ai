import { afterEach, describe, expect, it, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";

// Control `isProduction` per test and avoid the env fail-fast import side
// effect. `allowedOrigins` is unused here but kept for a complete module shape.
const envMock = vi.hoisted(() => ({ isProduction: false }));
vi.mock("../src/lib/env", () => ({
  get isProduction() {
    return envMock.isProduction;
  },
  allowedOrigins: () => ["https://waydora.com"],
}));

// Silence the real pino logger. The mock factory is hoisted above imports, so
// any referenced values must be created with vi.hoisted.
const loggerMock = vi.hoisted(() => ({ error: vi.fn() }));
vi.mock("../src/lib/logger", () => ({
  logger: loggerMock,
}));

import { errorHandler } from "../src/lib/error-handler";

function makeRes() {
  const res = {
    headersSent: false,
    status: vi.fn(),
    json: vi.fn(),
  };
  // Chainable: res.status(x).json(y)
  res.status.mockReturnValue(res as unknown as Response);
  return res;
}

const fakeReq = { log: { error: vi.fn() }, id: "req-1" } as unknown as Request;
const next = vi.fn() as unknown as NextFunction;

afterEach(() => {
  vi.clearAllMocks();
  envMock.isProduction = false;
});

describe("errorHandler", () => {
  it("uses a valid 4xx status from the error and returns JSON { error }", () => {
    const res = makeRes();
    const err = { status: 404, message: "missing" };

    errorHandler(err, fakeReq, res as unknown as Response, next);

    expect(res.status).toHaveBeenCalledWith(404);
    const body = res.json.mock.calls[0][0];
    expect(body).toHaveProperty("error");
    expect(typeof body.error).toBe("string");
  });

  it("honours a statusCode property too", () => {
    const res = makeRes();
    errorHandler(
      { statusCode: 403 },
      fakeReq,
      res as unknown as Response,
      next,
    );
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("defaults to 500 when the error has no usable status", () => {
    const res = makeRes();
    errorHandler(
      new Error("kaboom"),
      fakeReq,
      res as unknown as Response,
      next,
    );
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it("ignores out-of-range status values and falls back to 500", () => {
    const res = makeRes();
    errorHandler({ status: 200 }, fakeReq, res as unknown as Response, next);
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it("exposes the error message as detail in non-production", () => {
    envMock.isProduction = false;
    const res = makeRes();
    errorHandler(
      new Error("dev detail"),
      fakeReq,
      res as unknown as Response,
      next,
    );
    const body = res.json.mock.calls[0][0];
    expect(body.detail).toBe("dev detail");
  });

  it("never leaks the error message/stack in production", () => {
    envMock.isProduction = true;
    const res = makeRes();
    errorHandler(
      new Error("secret internal detail"),
      fakeReq,
      res as unknown as Response,
      next,
    );
    const body = res.json.mock.calls[0][0];
    expect(body).not.toHaveProperty("detail");
    expect(JSON.stringify(body)).not.toContain("secret internal detail");
  });

  it("does not write a response when headers were already sent", () => {
    const res = makeRes();
    res.headersSent = true;
    errorHandler(
      new Error("late"),
      fakeReq,
      res as unknown as Response,
      next,
    );
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });
});
