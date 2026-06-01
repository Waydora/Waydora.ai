// src/lib/analytics.ts
// ─────────────────────────────────────────────────────────────────────────────
// Wrapper centralizzato per il tracking eventi SERVER-SIDE del bot (PostHog EU).
// Spec di riferimento: docs/analytics/tracking-plan.md (§2 strumento, §4 identity
// cross-channel, §5 GDPR, §6 "bot-dev").
//
// Principi (vincoli del task #30):
//  1. ENV-GATED + NO-OP: se POSTHOG_KEY è assente, NESSUN client posthog-node
//     viene creato, nessuna rete, nessun errore. Il codice resta committabile/
//     deployabile e si attiva solo quando si aggiunge la chiave.
//  2. SINGLE CHOKE-POINT: ogni evento passa da `track()`. NIENTE PII (no nomi,
//     no username Telegram in chiaro, no testo dei messaggi/prompt).
//  3. IDENTITY cross-channel (§4): distinct_id = user_id Supabase (lo stesso
//     della webapp → merge della persona). Per utenti NON bindati si usa un id
//     anonimo namespaced `hashTgId(telegram_user_id)`; al bind si emette un
//     `alias` per ricucire gli eventi pre-bind sulla persona reale.
//  4. BATCHING: posthog-node fa batching degli eventi → serve flush()/shutdown()
//     alla chiusura del processo per non perderli.
// ─────────────────────────────────────────────────────────────────────────────

import crypto from "node:crypto";
import { env } from "./env.js";
import type { PostHog } from "posthog-node";

// Abilitato SOLO se la chiave esiste. Senza chiave → no-op totale.
const ENABLED = env.POSTHOG_KEY.length > 0;

// ── Tipi eventi (snake_case come da spec §3) ───────────────────────────────
export type BotAnalyticsEvent =
  | "bot_started"
  | "telegram_bind_completed"
  | "bot_command_used"
  | "chat_started"
  | "first_itinerary_generated"
  | "trip_saved"
  | "idea_added"
  | "media_added"
  | "trip_reminder_sent";

// Proprietà: solo valori non-PII (id tecnici, enum, bool, conteggi, hash).
export type BotAnalyticsProps = Record<string, string | number | boolean | null | undefined>;

// ── Stato interno (lazy singleton) ─────────────────────────────────────────
let client: PostHog | null = null;
let initTried = false;

// Carica posthog-node solo se ENABLED. import() dinamico così, senza chiave,
// il pacchetto non viene nemmeno valutato.
async function getClient(): Promise<PostHog | null> {
  if (!ENABLED) return null;
  if (client) return client;
  if (initTried) return client;
  initTried = true;
  try {
    const { PostHog } = await import("posthog-node");
    client = new PostHog(env.POSTHOG_KEY, {
      host: env.POSTHOG_HOST,
      // Batch piccolo: il bot è low-throughput, vogliamo eventi quasi real-time
      // senza tenere troppo in coda (e flush() comunque garantisce l'invio).
      flushAt: 20,
      flushInterval: 10_000,
    });
  } catch (e) {
    // Non far mai fallire un handler del bot per colpa dell'analytics.
    console.warn("[analytics] init failed, disabling:", (e as Error)?.message);
    client = null;
  }
  return client;
}

// ── API pubblica ───────────────────────────────────────────────────────────

/**
 * Traccia un evento server-side. Choke-point unico: no-op senza chiave.
 * `distinctId` = user_id Supabase (bindato) oppure hashTgId(...) (anonimo).
 * Non inviare MAI PII tra le props.
 */
export function track(distinctId: string, event: BotAnalyticsEvent, props?: BotAnalyticsProps): void {
  if (!ENABLED || !distinctId) return;
  void getClient().then((ph) => {
    if (!ph) return;
    try {
      // `channel: "telegram"` comune a tutti gli eventi del bot (spec §3).
      ph.capture({ distinctId, event, properties: { channel: "telegram", ...props } });
    } catch (e) {
      console.warn("[analytics] capture failed:", (e as Error)?.message);
    }
  });
}

/**
 * Collega l'identità anonima pre-bind (hashTgId) alla persona reale (user_id),
 * così gli eventi emessi prima del binding (es. bot_started) confluiscono sulla
 * stessa persona Supabase → cross-channel risolto (spec §4). No-op senza chiave.
 */
export function identifyBinding(telegramUserId: number, userId: string): void {
  if (!ENABLED || !userId) return;
  void getClient().then((ph) => {
    if (!ph) return;
    try {
      ph.alias({ distinctId: userId, alias: hashTgId(telegramUserId) });
    } catch (e) {
      console.warn("[analytics] alias failed:", (e as Error)?.message);
    }
  });
}

/**
 * distinct_id anonimo per utenti NON ancora bindati (es. /start senza token).
 * Namespaced "tg:" + sha256 troncato del telegram_user_id → niente id Telegram
 * in chiaro lato analytics (spec §4: NON mandare telegram_username/id grezzo).
 */
export function hashTgId(telegramUserId: number): string {
  const h = crypto.createHash("sha256").update(String(telegramUserId)).digest("hex").slice(0, 16);
  return `tg:${h}`;
}

/** Flush esplicito della coda (posthog-node fa batching). No-op senza chiave. */
export async function flush(): Promise<void> {
  if (!ENABLED || !client) return;
  try {
    await client.flush();
  } catch (e) {
    console.warn("[analytics] flush failed:", (e as Error)?.message);
  }
}

/** Shutdown: flush + chiusura del client. Da chiamare su SIGTERM/SIGINT. */
export async function shutdown(): Promise<void> {
  if (!ENABLED || !client) return;
  try {
    await client.shutdown();
  } catch (e) {
    console.warn("[analytics] shutdown failed:", (e as Error)?.message);
  } finally {
    client = null;
  }
}
