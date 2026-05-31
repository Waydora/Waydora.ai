import { defineConfig, devices } from "@playwright/test";

/**
 * Configurazione E2E DETERMINISTICA per la webapp Waydora.
 *
 * Principi:
 * - NESSUNA chiamata a servizi reali. Ogni spec intercetta con `page.route(...)`
 *   le chiamate verso l'api-server (Railway/Vercel) e Supabase (REST/auth).
 * - L'app viene avviata con env VITE_ DUMMY (vedi `webServer.env`), così Vite
 *   builda e il client Supabase si crea senza credenziali reali. Le richieste di
 *   rete reali non partono perché vengono mockate nei test.
 *
 * Esecuzione:
 *   pnpm -F waydora test:e2e
 *   pnpm -F waydora test:e2e:ui
 */

const PORT = 5173;
const BASE_URL = `http://localhost:${PORT}`;

// Valori VITE_ fittizi: bastano a far partire l'app senza credenziali reali.
// Sono coerenti con i nomi env usati nel codice:
//  - VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY  → src/lib/supabase.ts
//  - VITE_API_URL                                → src/hooks/api.ts, src/pages/trip.tsx
//  - VITE_CHAT_URL                               → src/hooks/api.ts (endpoint Vercel relativo)
const DUMMY_ENV = {
  VITE_SUPABASE_URL: "http://localhost:54321",
  VITE_SUPABASE_ANON_KEY: "dummy-anon-key-for-e2e",
  VITE_API_URL: "http://localhost:9999",
  VITE_CHAT_URL: "http://localhost:9999",
};

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "line" : [["list"]],
  timeout: 30_000,
  expect: { timeout: 7_000 },

  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    // Niente video/screenshot di default: test deterministici e veloci.
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  webServer: {
    command: "pnpm dev",
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: DUMMY_ENV,
  },
});
