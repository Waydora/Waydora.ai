import { test, expect } from "@playwright/test";
import {
  blockExternalNetwork,
  mockApiReads,
  mockSupabaseAuth,
  mockSupabaseRest,
} from "./helpers";

/**
 * auth.spec.ts
 * Apertura dell'AuthModal dalla landing, validazione client-side e flussi
 * di login OK / fallito con mock di `**\/auth/v1/**`.
 */

test.describe("Auth modal", () => {
  test("apre il modal dal pulsante Accedi e mostra il form", async ({ page }) => {
    await blockExternalNetwork(page);
    await mockApiReads(page);
    await mockSupabaseAuth(page);
    await mockSupabaseRest(page, []);

    await page.goto("/");
    await page.getByRole("button", { name: /Accedi/i }).first().click();

    // Il modal mostra Google + form email
    await expect(page.getByRole("button", { name: /Continua con Google/i })).toBeVisible();
    await expect(page.getByPlaceholder("Email")).toBeVisible();
    await expect(page.getByPlaceholder("Password")).toBeVisible();
  });

  test("validazione: campi vuoti mostra errore", async ({ page }) => {
    await blockExternalNetwork(page);
    await mockApiReads(page);
    await mockSupabaseAuth(page);
    await mockSupabaseRest(page, []);

    await page.goto("/");
    await page.getByRole("button", { name: /Accedi/i }).first().click();

    // Submit del form senza compilare → "Compila tutti i campi"
    // Il pulsante submit ha label "Accedi" dentro il form (mode=login).
    await page.locator("form").getByRole("button", { name: /^Accedi$/ }).click();
    await expect(page.getByText(/Compila tutti i campi/i)).toBeVisible();
  });

  test("login fallito (credenziali errate) mostra messaggio errore", async ({ page }) => {
    await blockExternalNetwork(page);
    await mockApiReads(page);
    await mockSupabaseRest(page, []);
    // auth/v1/token → 400 invalid_grant
    await mockSupabaseAuth(page, { loginOutcome: "fail" });

    await page.goto("/");
    await page.getByRole("button", { name: /Accedi/i }).first().click();

    await page.getByPlaceholder("Email").fill("wrong@waydora.app");
    await page.getByPlaceholder("Password").fill("wrongpassword");
    await page.locator("form").getByRole("button", { name: /^Accedi$/ }).click();

    // auth.ts rilancia error.message ("Invalid login credentials"); auth-modal
    // mappa "Invalid login" → "Email o password errati".
    await expect(page.getByText(/Email o password errati/i)).toBeVisible();
  });

  test("login OK chiude il modal", async ({ page }) => {
    await blockExternalNetwork(page);
    await mockApiReads(page);
    await mockSupabaseRest(page, []);
    await mockSupabaseAuth(page, { loginOutcome: "ok" });

    await page.goto("/");
    await page.getByRole("button", { name: /Accedi/i }).first().click();

    await page.getByPlaceholder("Email").fill("test@waydora.app");
    await page.getByPlaceholder("Password").fill("correct-password");
    await page.locator("form").getByRole("button", { name: /^Accedi$/ }).click();

    // onClose() viene chiamato → il form non è più visibile
    await expect(page.getByPlaceholder("Email")).toBeHidden();
  });
});
