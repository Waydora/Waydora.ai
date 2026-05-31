import { describe, expect, it } from "vitest";
import { envSchema } from "../src/lib/env";

/**
 * Unit tests for the zod env schema. We test the schema in isolation via
 * `safeParse` (a pure operation) — we do NOT exercise the module-level
 * fail-fast `process.exit` path, which is intentionally left untouched.
 */
describe("env schema", () => {
  it("accepts a minimal valid environment and applies defaults", () => {
    const result = envSchema.safeParse({ ANTHROPIC_API_KEY: "sk-123" });

    expect(result.success).toBe(true);
    if (!result.success) return;

    // Coerced / defaulted values.
    expect(result.data.NODE_ENV).toBe("development");
    expect(result.data.PORT).toBe(3000);
    expect(result.data.LOG_LEVEL).toBe("info");
    expect(result.data.CHAT_RATE_LIMIT_MAX).toBe(20);
    expect(result.data.API_RATE_LIMIT_MAX).toBe(100);
  });

  it("flags the missing required ANTHROPIC_API_KEY", () => {
    const result = envSchema.safeParse({});

    expect(result.success).toBe(false);
    if (result.success) return;

    const paths = result.error.issues.map((issue) => issue.path.join("."));
    expect(paths).toContain("ANTHROPIC_API_KEY");
  });

  it("rejects an empty ANTHROPIC_API_KEY", () => {
    const result = envSchema.safeParse({ ANTHROPIC_API_KEY: "" });
    expect(result.success).toBe(false);
  });

  it("coerces numeric env strings and rejects non-positive values", () => {
    const ok = envSchema.safeParse({
      ANTHROPIC_API_KEY: "sk-123",
      PORT: "8080",
      CHAT_RATE_LIMIT_MAX: "5",
    });
    expect(ok.success).toBe(true);
    if (ok.success) {
      expect(ok.data.PORT).toBe(8080);
      expect(ok.data.CHAT_RATE_LIMIT_MAX).toBe(5);
    }

    const bad = envSchema.safeParse({
      ANTHROPIC_API_KEY: "sk-123",
      PORT: "0",
    });
    expect(bad.success).toBe(false);
  });

  it("rejects an invalid NODE_ENV enum value", () => {
    const result = envSchema.safeParse({
      ANTHROPIC_API_KEY: "sk-123",
      NODE_ENV: "staging",
    });
    expect(result.success).toBe(false);
  });
});
