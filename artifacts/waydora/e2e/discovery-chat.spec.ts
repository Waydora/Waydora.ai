import { test, expect } from "@playwright/test";
import { baseHomeMocks, mockChat, MOCK_ITINERARY } from "./helpers";

/**
 * discovery-chat.spec.ts — IL TEST DI VALORE PIU ALTO.
 *
 * Flusso principale: l'utente inserisce un prompt, l'endpoint chat dell'api-server
 * è mockato per restituire un itinerario canned, e si verifica che l'itinerario
 * venga renderizzato (titolo, giorni, attività).
 *
 * Per un NUOVO itinerario `shouldUseRailway()` ritorna true, quindi la webapp
 * chiama `${VITE_API_URL}/api/chat` (POST). Il mock `**\/api/chat` intercetta
 * entrambi i casi (Railway e Vercel usano lo stesso path).
 */

test.describe("Discovery chat → itinerario", () => {
  test("genera e renderizza l'itinerario dal prompt nella hero", async ({ page }) => {
    await baseHomeMocks(page);
    await mockChat(page); // risposta canned con MOCK_ITINERARY

    await page.goto("/");

    // Invio dalla hero della landing
    const heroPrompt = page.getByPlaceholder(/Dove vuoi andare/i);
    await heroPrompt.fill("Pianificami 3 giorni a Tokyo");
    await heroPrompt.press("Enter");

    // 1) Il titolo dell'itinerario appare (header card in ItineraryResults)
    await expect(
      page.getByRole("heading", { name: MOCK_ITINERARY.title }),
    ).toBeVisible({ timeout: 15_000 });

    // 2) Il messaggio di reply dell'assistente è in chat
    await expect(page.getByText(/Ecco il tuo itinerario di 3 giorni a Tokyo/i).first()).toBeVisible();

    // 3) I giorni sono renderizzati (DayHeader mostra il title del giorno)
    await expect(page.getByRole("heading", { name: "Shibuya e dintorni" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Asakusa e cultura" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Akihabara e shopping" })).toBeVisible();

    // 4) Almeno un'attività con titolo e orario
    await expect(page.getByRole("heading", { name: "Incrocio di Shibuya" })).toBeVisible();
    await expect(page.getByText("09:00").first()).toBeVisible();

    // 5) I badge meta dell'itinerario (destinazione / durata)
    await expect(page.getByText(/Tokyo, Giappone/i).first()).toBeVisible();
    await expect(page.getByText(/3 giorni/i).first()).toBeVisible();
  });

  test("invia il payload chat corretto all'api-server", async ({ page }) => {
    await baseHomeMocks(page);

    // Cattura il body della richiesta per verificare che il prompt utente
    // venga inoltrato correttamente.
    let capturedBody: any = null;
    await page.route("**/api/chat", async (route) => {
      if (route.request().method() === "POST") {
        capturedBody = route.request().postDataJSON();
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ reply: "ok", itinerary: MOCK_ITINERARY }),
      });
    });

    await page.goto("/");
    const heroPrompt = page.getByPlaceholder(/Dove vuoi andare/i);
    await heroPrompt.fill("Weekend a Lisbona");
    await heroPrompt.press("Enter");

    await expect(
      page.getByRole("heading", { name: MOCK_ITINERARY.title }),
    ).toBeVisible({ timeout: 15_000 });

    expect(capturedBody).not.toBeNull();
    const messages = capturedBody.messages ?? [];
    expect(messages[messages.length - 1]).toMatchObject({
      role: "user",
      content: "Weekend a Lisbona",
    });
  });

  test("errore dell'api-server mostra un toast e nessun itinerario", async ({ page }) => {
    await baseHomeMocks(page);
    await page.route("**/api/chat", (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "boom" }),
      }),
    );

    await page.goto("/");
    const heroPrompt = page.getByPlaceholder(/Dove vuoi andare/i);
    await heroPrompt.fill("Pianificami 3 giorni a Tokyo");
    await heroPrompt.press("Enter");

    // Toast d'errore (use-toast → "Qualcosa è andato storto. Riprova.")
    await expect(page.getByText(/Qualcosa è andato storto/i)).toBeVisible({ timeout: 15_000 });
    // Nessun titolo itinerario renderizzato
    await expect(page.getByRole("heading", { name: MOCK_ITINERARY.title })).toHaveCount(0);
  });
});
