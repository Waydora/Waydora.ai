// src/lib/analytics.ts
// ─────────────────────────────────────────────────────────────────────────────
// Wrapper centralizzato per il tracking eventi (PostHog EU).
// Spec di riferimento: docs/analytics/tracking-plan.md
//
// Principi (vincoli del task #29):
//  1. ENV-GATED + NO-OP: se VITE_POSTHOG_KEY è assente, NESSUN init, nessun
//     network, nessun errore. Il codice resta committabile/deployabile e si
//     attiva solo quando l'utente aggiunge la chiave.
//  2. CONSENSO GDPR opt-in: PostHog parte con opt_out_capturing_by_default=true.
//     Nessun evento viene inviato finché l'utente non dà consenso esplicito
//     (banner → optIn()). Il consenso è persistito in localStorage.
//  3. SINGLE CHOKE-POINT: ogni evento passa da `track()`. Niente PII (no email,
//     no nome, no testo dei prompt/messaggi, no share_slug in chiaro).
// ─────────────────────────────────────────────────────────────────────────────

import type { PostHog } from "posthog-js";

// ── Config da env (Vite) ───────────────────────────────────────────────────
const POSTHOG_KEY  = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
const POSTHOG_HOST = (import.meta.env.VITE_POSTHOG_HOST as string | undefined) ?? "https://eu.i.posthog.com";

// Abilitato SOLO se la chiave esiste. Senza chiave → no-op totale.
const ENABLED = typeof POSTHOG_KEY === "string" && POSTHOG_KEY.length > 0;

// Chiave localStorage per la scelta di consenso ("granted" | "denied").
export const CONSENT_STORAGE_KEY = "waydora_analytics_consent";
export type ConsentChoice = "granted" | "denied";

// ── Tipi eventi (snake_case come da spec §3) ───────────────────────────────
export type AnalyticsEvent =
  | "landing_viewed"
  | "prompt_submitted_anon"
  | "chat_started"
  | "first_itinerary_generated"
  | "trip_saved"
  | "trip_shared"
  | "shared_link_opened"
  | "itinerary_viewed"
  | "idea_added"
  | "media_added"
  | "signup"
  | "login"
  | "start_page_viewed"
  | "start_destination_submitted"
  | "start_activation"
  | "template_forked"
  | "ready_trip_opened";

// Proprietà: solo valori non-PII (id tecnici, enum, bool, conteggi, hash).
export type AnalyticsProps = Record<string, string | number | boolean | null | undefined>;

// ── Stato interno ──────────────────────────────────────────────────────────
let phPromise: Promise<PostHog | null> | null = null;

function hasConsent(): boolean {
  try {
    return localStorage.getItem(CONSENT_STORAGE_KEY) === "granted";
  } catch {
    return false;
  }
}

export function getConsentChoice(): ConsentChoice | null {
  try {
    const v = localStorage.getItem(CONSENT_STORAGE_KEY);
    return v === "granted" || v === "denied" ? v : null;
  } catch {
    return null;
  }
}

// ── Init lazy ──────────────────────────────────────────────────────────────
// Carica posthog-js solo se ENABLED. L'init imposta opt_out_capturing_by_default
// così nessun evento parte prima del consenso esplicito.
function ensureInit(): Promise<PostHog | null> {
  if (!ENABLED) return Promise.resolve(null);
  if (phPromise) return phPromise;

  phPromise = import("posthog-js")
    .then(({ default: posthog }) => {
      posthog.init(POSTHOG_KEY as string, {
        api_host: POSTHOG_HOST,
        // GDPR: nessun capture finché non c'è opt-in esplicito (banner consenso).
        opt_out_capturing_by_default: true,
        // Profili persona solo per utenti identificati (no profilo per anonimi).
        person_profiles: "identified_only",
        // Pageview gestiti manualmente (landing_viewed) per controllo PII.
        capture_pageview: false,
        capture_pageleave: false,
        // Non persistere l'IP grezzo lato property.
        ip: false,
      });
      // Se il consenso era già stato dato in una sessione precedente, riallinea.
      if (hasConsent()) posthog.opt_in_capturing();
      return posthog;
    })
    .catch(() => null);

  return phPromise;
}

// ── API pubblica ───────────────────────────────────────────────────────────

/** Registra il consenso analytics e abilita il capture. No-op senza chiave. */
export function optIn(): void {
  try {
    localStorage.setItem(CONSENT_STORAGE_KEY, "granted");
  } catch {}
  if (!ENABLED) return;
  void ensureInit().then(ph => ph?.opt_in_capturing());
}

/** Registra il rifiuto: resta opt-out, nessun cookie/evento. No-op senza chiave. */
export function optOut(): void {
  try {
    localStorage.setItem(CONSENT_STORAGE_KEY, "denied");
  } catch {}
  if (!ENABLED) return;
  void ensureInit().then(ph => ph?.opt_out_capturing());
}

/**
 * Traccia un evento. Choke-point unico: no-op senza chiave o senza consenso.
 * Non inviare MAI PII tra le props.
 */
export function track(event: AnalyticsEvent, props?: AnalyticsProps): void {
  if (!ENABLED || !hasConsent()) return;
  void ensureInit().then(ph => {
    if (!ph) return;
    // Proprietà comune a tutti gli eventi web (spec §3).
    ph.capture(event, { channel: "web", ...props });
  });
}

/**
 * Identifica l'utente (user_id Supabase). Esegue il merge automatico
 * dell'anon id sulla persona reale (spec §4). No-op senza chiave/consenso.
 */
export function identify(userId: string, props?: AnalyticsProps): void {
  if (!ENABLED || !hasConsent()) return;
  void ensureInit().then(ph => ph?.identify(userId, props));
}

/** Reset identità al logout (spec §4: SIGNED_OUT → reset). */
export function reset(): void {
  if (!ENABLED) return;
  void ensureInit().then(ph => ph?.reset());
}

// ── hashSlug ────────────────────────────────────────────────────────────────
// Lo share_slug NON deve mai viaggiare in chiaro (apre il viaggio pubblico).
// Hash semplice e deterministico (FNV-1a 32-bit) → stringa esadecimale.
// Sufficiente per raggruppare eventi per viaggio senza esporre lo slug.
export function hashSlug(slug: string): string {
  if (!slug) return "";
  let h = 0x811c9dc5;
  for (let i = 0; i < slug.length; i++) {
    h ^= slug.charCodeAt(i);
    // moltiplicazione FNV-1a in aritmetica a 32-bit
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

// ── Helper non-PII ────────────────────────────────────────────────────────────
// Deriva il solo PAESE da una stringa destinazione "Città, Paese" (spec §3).
export function destinationCountry(destination?: string | null): string | undefined {
  if (!destination) return undefined;
  const parts = destination.split(",").map(p => p.trim()).filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 1] : undefined;
}

// Euristica booleana "viaggio di gruppo" calcolata client-side (no testo inviato).
export function isGroupHint(text?: string | null): boolean {
  if (!text) return false;
  return /\b(amici|gruppo|comitiva|insieme|in\s+\d+|noi|coppia|famiglia)\b/i.test(text);
}
