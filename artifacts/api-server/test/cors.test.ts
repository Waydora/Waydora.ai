import { describe, expect, it, vi } from "vitest";

// Mock env so we control the allowlist and production flag without touching
// process.env or triggering the env fail-fast import side effect.
const envMock = vi.hoisted(() => ({ isProduction: false }));
vi.mock("../src/lib/env", () => ({
  get isProduction() {
    return envMock.isProduction;
  },
  allowedOrigins: () => ["https://www.waydora.com", "https://waydora.com"],
}));

import { corsOptions } from "../src/lib/cors";

// corsOptions.origin is the CorsOptions origin callback function.
type OriginFn = (
  origin: string | undefined,
  cb: (err: Error | null, allow?: boolean) => void,
) => void;

function checkOrigin(origin: string | undefined): {
  allowed: boolean;
  error: Error | null;
} {
  const fn = corsOptions.origin as OriginFn;
  let allowed = false;
  let error: Error | null = null;
  fn(origin, (err, allow) => {
    error = err;
    allowed = Boolean(allow);
  });
  return { allowed, error };
}

describe("corsOptions.origin", () => {
  it("allows the production www origin", () => {
    const { allowed, error } = checkOrigin("https://www.waydora.com");
    expect(error).toBeNull();
    expect(allowed).toBe(true);
  });

  it("allows the production apex origin", () => {
    const { allowed, error } = checkOrigin("https://waydora.com");
    expect(error).toBeNull();
    expect(allowed).toBe(true);
  });

  it("allows requests with no Origin header (curl / health checks)", () => {
    const { allowed, error } = checkOrigin(undefined);
    expect(error).toBeNull();
    expect(allowed).toBe(true);
  });

  it("rejects a foreign origin", () => {
    const { allowed, error } = checkOrigin("https://evil.example.com");
    expect(allowed).toBe(false);
    expect(error).toBeInstanceOf(Error);
  });

  it("allows http://localhost:5173 outside production", () => {
    envMock.isProduction = false;
    const { allowed, error } = checkOrigin("http://localhost:5173");
    expect(error).toBeNull();
    expect(allowed).toBe(true);
  });

  it("rejects http://localhost in production", () => {
    envMock.isProduction = true;
    const { allowed, error } = checkOrigin("http://localhost:5173");
    expect(allowed).toBe(false);
    expect(error).toBeInstanceOf(Error);
    // restore for any later assertions / isolation hygiene
    envMock.isProduction = false;
  });
});
