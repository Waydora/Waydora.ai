import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Smoke/unit tests only: fast, deterministic, no real network or DB.
    include: ["src/**/*.test.ts", "test/**/*.test.ts"],
    environment: "node",
    // Loaded before any test module. Guarantees a valid env so that importing
    // modules which transitively import `./env` (which fail-fasts with
    // process.exit on invalid config) does not abort the test runner.
    setupFiles: ["./test/setup.ts"],
  },
});
