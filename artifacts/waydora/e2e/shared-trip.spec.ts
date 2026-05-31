import { test, expect } from "@playwright/test";
import {
  blockExternalNetwork,
  mockSupabaseAuth,
  mockSupabaseSingle,
  MOCK_ITINERARY,
} from "./helpers";

/**
 * shared-trip.spec.ts
 * Visita `/trip/<slug>` con mock della risposta Supabase.
 *
 * La pagina Trip (src/pages/trip.tsx) carica con:
 *   supabase.from("saved_trips").select("*").eq("share_slug", slug).single()
 * e mostra l'itinerario se `data.itinerary` esiste, altrimenti il ramo
 * "Viaggio non trovato".
 *
 * Inoltre interroga `trip_messages` (conteggio + lista chat/idee) e apre canali
 * realtime websocket. I websocket verso Supabase non partono perché l'host è
 * un dummy non raggiungibile; le query REST su trip_messages sono mockate vuote.
 */

const SLUG = "abc12345";

const SAVED_TRIP_ROW = {
  id: "trip-1",
  user_id: "owner-1",
  trip_id: null,
  itinerary: MOCK_ITINERARY,
  share_slug: SLUG,
  title: MOCK_ITINERARY.title,
  notes: "",
  is_public: true,
  created_at: new Date().toISOString(),
};

test.describe("Pagina viaggio condiviso /trip/:slug", () => {
  test("renderizza l'itinerario di un viaggio pubblico", async ({ page }) => {
    await blockExternalNetwork(page);
    await mockSupabaseAuth(page);
    // trip_messages → vuoto (lista + count). Va registrato PRIMA di saved_trips
    // così l'handler più specifico di saved_trips (registrato dopo) ha precedenza.
    await page.route("**/rest/v1/trip_messages**", (r) =>
      r.fulfill({ status: 200, contentType: "application/json", body: "[]" }),
    );
    // saved_trips .single() → la riga pubblica con itinerary
    await mockSupabaseSingle(page, "saved_trips", SAVED_TRIP_ROW);

    await page.goto(`/trip/${SLUG}`);

    // Titolo itinerario nel pannello "Itinerario" (tool di default)
    await expect(
      page.getByRole("heading", { name: MOCK_ITINERARY.title }),
    ).toBeVisible({ timeout: 15_000 });

    // Giorni e attività renderizzati
    await expect(page.getByRole("heading", { name: "Shibuya e dintorni" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Incrocio di Shibuya" })).toBeVisible();

    // Header con pulsante "Copia" (condivisione link)
    await expect(page.getByRole("button", { name: /Copia/i }).first()).toBeVisible();
  });

  test("viaggio non trovato / privato (0 righe) mostra messaggio appropriato", async ({ page }) => {
    await blockExternalNetwork(page);
    await mockSupabaseAuth(page);
    await page.route("**/rest/v1/trip_messages**", (r) =>
      r.fulfill({ status: 200, contentType: "application/json", body: "[]" }),
    );
    // saved_trips .single() → 0 righe (privato o inesistente)
    await mockSupabaseSingle(page, "saved_trips", null);

    await page.goto(`/trip/${SLUG}`);

    await expect(page.getByRole("heading", { name: /Viaggio non trovato/i })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole("button", { name: /Torna alla home/i })).toBeVisible();
  });
});
