import type { Page, Route } from "@playwright/test";

/**
 * Helper condivisi per i test E2E deterministici.
 *
 * NOTA SUL DETERMINISMO: questi test NON devono mai colpire servizi reali.
 * Tutte le chiamate verso l'api-server e Supabase vanno intercettate con
 * `page.route(...)`. Le funzioni qui sotto centralizzano i mock comuni così
 * ogni spec parte da uno stato pulito e prevedibile.
 */

// ── Itinerario canned, coerente con il tipo ItineraryData (src/hooks/api.ts) ──
export const MOCK_ITINERARY = {
  title: "3 giorni a Tokyo",
  destination: "Tokyo, Giappone",
  durationDays: 3,
  vibe: "Energia urbana e tradizione",
  totalBudget: "€900",
  bestSeason: "Primavera",
  heroEmoji: "🗼",
  days: [
    {
      day: 1,
      title: "Shibuya e dintorni",
      summary: "Immersione nella Tokyo moderna",
      weather: "☀️ 18°C",
      activities: [
        {
          time: "09:00",
          title: "Incrocio di Shibuya",
          description: "Il celebre attraversamento pedonale.",
          category: "sightseeing",
          estimatedCost: "Gratis",
          coordinates: { lat: 35.6595, lng: 139.7005 },
        },
        {
          time: "13:00",
          title: "Pranzo: ramen a Ichiran",
          description: "Ramen tonkotsu nelle cabine private.",
          category: "food",
          estimatedCost: "€12",
        },
      ],
    },
    {
      day: 2,
      title: "Asakusa e cultura",
      summary: "La Tokyo storica",
      activities: [
        {
          time: "10:00",
          title: "Tempio Senso-ji",
          description: "Il tempio buddista piu antico di Tokyo.",
          category: "sightseeing",
          estimatedCost: "Gratis",
          coordinates: { lat: 35.7148, lng: 139.7967 },
        },
      ],
    },
    {
      day: 3,
      title: "Akihabara e shopping",
      summary: "Tecnologia e cultura pop",
      activities: [
        {
          time: "11:00",
          title: "Quartiere di Akihabara",
          description: "Elettronica, anime e manga.",
          category: "experience",
          estimatedCost: "€50",
        },
      ],
    },
  ],
  packingList: [
    { category: "Abbigliamento", items: ["Scarpe comode", "Giacca leggera"] },
    { category: "Documenti", items: ["Passaporto", "Assicurazione viaggio"] },
  ],
};

export const MOCK_CHAT_RESPONSE = {
  reply: "Ecco il tuo itinerario di 3 giorni a Tokyo! Fammi sapere se vuoi modificarlo.",
  itinerary: MOCK_ITINERARY,
};

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });

/**
 * Mock di sicurezza GLOBALE: blocca QUALSIASI rete uscente che non sia
 * localhost (l'app stessa). Cosi se un test dimentica di mockare un endpoint,
 * fallisce in modo pulito invece di chiamare un servizio reale.
 * Va registrato PRIMA dei mock specifici (Playwright valuta gli handler in
 * ordine inverso: l'ultimo registrato vince, quindi i mock specifici aggiunti
 * dopo hanno precedenza).
 */
export async function blockExternalNetwork(page: Page) {
  await page.route("**/*", (route) => {
    const url = route.request().url();
    if (url.startsWith("http://localhost") || url.startsWith("data:") || url.startsWith("blob:")) {
      return route.continue();
    }
    // Risorse esterne (foto Pexels/Unsplash, tile mappe, font...) → abortite
    // silenziosamente: non influenzano gli asserti e mantengono i test offline.
    return route.abort();
  });
}

/**
 * Mock degli endpoint "read" dell'api-server usati al boot dalla home:
 *  /api/suggestions, /api/templates, /api/stats, /api/itineraries.
 * Default: liste vuote / stat finte. Cosi la home non resta in loading.
 */
export async function mockApiReads(page: Page) {
  await page.route("**/api/suggestions", (r) => json(r, []));
  await page.route("**/api/templates", (r) => json(r, []));
  await page.route("**/api/stats", (r) => json(r, { tripsPlanned: 12847 }));
  await page.route("**/api/itineraries", (r) => json(r, []));
}

/**
 * Mock dell'endpoint chat dell'api-server (Railway + Vercel usano lo stesso
 * path `/api/chat`). Restituisce un itinerario canned.
 */
export async function mockChat(page: Page, response: unknown = MOCK_CHAT_RESPONSE) {
  await page.route("**/api/chat", (route) => {
    if (route.request().method() !== "POST") return route.continue();
    return json(route, response);
  });
}

/**
 * Mock delle chiamate di autenticazione Supabase (`**\/auth/v1/**`).
 * - getSession al boot → nessuna sessione (utente non loggato)
 * - login (token?grant_type=password) → controlla `outcome`
 */
export async function mockSupabaseAuth(
  page: Page,
  opts: { loginOutcome?: "ok" | "fail" } = {},
) {
  const { loginOutcome = "ok" } = opts;

  // Sessione iniziale: nessun utente loggato. supabase-js chiama getUser/getSession
  // ma per email/password il flusso passa da /auth/v1/token.
  await page.route("**/auth/v1/user**", (r) => json(r, {}, 401));

  await page.route("**/auth/v1/token**", (route) => {
    if (loginOutcome === "fail") {
      return json(
        route,
        { error: "invalid_grant", error_description: "Invalid login credentials" },
        400,
      );
    }
    return json(route, {
      access_token: "mock-access-token",
      token_type: "bearer",
      expires_in: 3600,
      refresh_token: "mock-refresh-token",
      user: {
        id: "mock-user-id",
        email: "test@waydora.app",
        user_metadata: { full_name: "Test User" },
      },
    });
  });

  // Logout / altri endpoint auth → 200 vuoto
  await page.route("**/auth/v1/logout**", (r) => json(r, {}));
}

/**
 * Mock generico delle query REST di Supabase (`**\/rest/v1/**`).
 * `rows` è la risposta restituita a tutte le SELECT (default lista vuota).
 * I PostgREST `.single()` si aspettano un singolo oggetto: per quello usiamo
 * `mockSupabaseSingle` qui sotto.
 */
export async function mockSupabaseRest(page: Page, rows: unknown[] = []) {
  await page.route("**/rest/v1/**", (route) => {
    const method = route.request().method();
    if (method === "GET") return json(route, rows);
    // insert/update/delete → echo vuoto ok
    return json(route, []);
  });
}

/**
 * Mock di una SELECT `.single()` su una tabella Supabase specifica.
 * `table` es. "saved_trips". Se `row` è null → 406 (PostgREST "no rows"),
 * cosi il codice cade nel ramo "non trovato".
 */
export async function mockSupabaseSingle(
  page: Page,
  table: string,
  row: unknown | null,
) {
  await page.route(`**/rest/v1/${table}**`, (route) => {
    if (route.request().method() !== "GET") return json(route, []);
    if (row === null) {
      // PostgREST single() su 0 righe → 406 con codice PGRST116
      return json(
        route,
        { code: "PGRST116", message: "Results contain 0 rows" },
        406,
      );
    }
    return json(route, row);
  });
}

/**
 * Setup di base comune a quasi tutti i test della home:
 * blocca rete esterna + mocka le read dell'api + auth Supabase (no sessione).
 */
export async function baseHomeMocks(page: Page) {
  await blockExternalNetwork(page);
  await mockApiReads(page);
  await mockSupabaseAuth(page);
  await mockSupabaseRest(page, []);
}
