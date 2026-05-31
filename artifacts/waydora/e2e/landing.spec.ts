import { test, expect } from "@playwright/test";
import { baseHomeMocks } from "./helpers";

/**
 * landing.spec.ts
 * Verifica che la landing page carichi senza crash JS e mostri gli elementi
 * chiave: hero (titolo Waydora) e la CTA / campo prompt principale.
 */

test.describe("Landing page", () => {
  test("carica e mostra hero + CTA, nessun errore JS", async ({ page }) => {
    const jsErrors: string[] = [];
    page.on("pageerror", (err) => jsErrors.push(err.message));

    await baseHomeMocks(page);
    await page.goto("/");

    // Hero: il titolo "Ciao, sono Waydora..." (HeroLanding)
    await expect(
      page.getByRole("heading", { name: /sono Waydora/i }),
    ).toBeVisible();

    // Sottotitolo claim
    await expect(page.getByText(/assistente di viaggio AI/i).first()).toBeVisible();

    // CTA / campo prompt principale dell'hero
    await expect(
      page.getByPlaceholder(/Dove vuoi andare/i),
    ).toBeVisible();

    // Pulsante "Accedi" nell'header sticky (utente non loggato)
    await expect(page.getByRole("button", { name: /Accedi/i }).first()).toBeVisible();

    // Nessun errore JS non gestito
    expect(jsErrors, `Errori JS in pagina: ${jsErrors.join(" | ")}`).toEqual([]);
  });

  test("scrivere un prompt e inviare entra nella chat-app", async ({ page }) => {
    await baseHomeMocks(page);
    // Non mockiamo /api/chat qui: ci interessa solo la transizione di vista.
    await page.goto("/");

    const promptBox = page.getByPlaceholder(/Dove vuoi andare/i);
    await promptBox.fill("Pianificami 3 giorni a Tokyo");
    await promptBox.press("Enter");

    // Dopo il submit l'app esce dalla landing e mostra la chat:
    // appare l'input chat "Dimmi dove vuoi andare..."
    await expect(
      page.getByPlaceholder(/Dimmi dove vuoi andare/i).first(),
    ).toBeVisible();
  });
});
