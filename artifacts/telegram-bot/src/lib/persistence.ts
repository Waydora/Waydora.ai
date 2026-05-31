import { supabase } from "./supabase.js";
import type { ChatMessage, Itinerary } from "./chat-bridge.js";

// Ogni utente Telegram ha UN "trip di lavoro" in costruzione + tutti i viaggi salvati.
// Per la chat conversazionale usiamo `chat_sessions` (stessa tabella della webapp)
// linkata al telegram_user_id via colonna title prefisso "tg:<chat_id>" oppure
// — meglio — un campo dedicato. Per non aggiungere colonne usiamo title con prefisso.

const TG_SESSION_PREFIX = "tg:";

function sessionTitleFor(telegramUserId: number): string {
  return `${TG_SESSION_PREFIX}${telegramUserId}`;
}

export type Session = {
  id: string;
  user_id: string;
  turns: { role: "user" | "assistant"; content: string }[];
  api_messages: ChatMessage[];
  itinerary: Itinerary | null;
};

export async function loadOrCreateSession(userId: string, telegramUserId: number): Promise<Session> {
  const title = sessionTitleFor(telegramUserId);
  const { data: existing } = await supabase
    .from("chat_sessions")
    .select("id,user_id,turns,api_messages,itinerary")
    .eq("user_id", userId)
    .eq("title", title)
    .maybeSingle();

  if (existing) {
    return {
      id: (existing as any).id,
      user_id: (existing as any).user_id,
      turns: ((existing as any).turns as any[]) ?? [],
      api_messages: ((existing as any).api_messages as ChatMessage[]) ?? [],
      itinerary: (existing as any).itinerary ?? null,
    };
  }

  const { data, error } = await supabase
    .from("chat_sessions")
    .insert({ user_id: userId, title, turns: [], api_messages: [], itinerary: null })
    .select("id,user_id,turns,api_messages,itinerary")
    .single();
  if (error) throw error;
  return {
    id: (data as any).id,
    user_id: (data as any).user_id,
    turns: [],
    api_messages: [],
    itinerary: null,
  };
}

export async function saveSession(s: Session): Promise<void> {
  await supabase
    .from("chat_sessions")
    .update({
      turns: s.turns,
      api_messages: s.api_messages,
      itinerary: s.itinerary,
      updated_at: new Date().toISOString(),
    })
    .eq("id", s.id);
}

export async function resetSession(userId: string, telegramUserId: number): Promise<void> {
  await supabase
    .from("chat_sessions")
    .delete()
    .eq("user_id", userId)
    .eq("title", sessionTitleFor(telegramUserId));
}

// Cap rolling window per non far esplodere i token.
export function trimHistory(api: ChatMessage[], maxTurns = 16): ChatMessage[] {
  if (api.length <= maxTurns) return api;
  return api.slice(api.length - maxTurns);
}

// Slug stabile per la sessione Telegram → 1 chat = 1 saved_trip.
// Cambiare slug per ogni nuova chat: /nuovo cancella la sessione e quindi
// alla prossima generazione si crea un nuovo saved_trip.
function shortHash(s: string): string {
  // semplice djb2 → base36, 8 chars
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36).padStart(7, "0").slice(0, 8);
}

function slugForSession(sessionId: string): string {
  return `tg-${shortHash(sessionId)}`;
}

// Auto-salva (upsert) l'itinerario corrente come saved_trip per renderlo
// visibile sul sito in "Viaggi salvati". Ritorna lo share_slug.
export async function upsertSavedTripFromSession(input: {
  userId: string;
  sessionId: string;
  itinerary: any;
}): Promise<string> {
  const slug = slugForSession(input.sessionId);
  const title = input.itinerary?.title ?? input.itinerary?.destination ?? "Viaggio Telegram";

  const { data: existing } = await supabase
    .from("saved_trips")
    .select("id")
    .eq("share_slug", slug)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("saved_trips")
      .update({
        itinerary: input.itinerary,
        title,
        // Il bot condivide automaticamente: il link /trip/<slug> che invia
        // deve funzionare per i guest (policy SELECT: is_public = true OR owner).
        // Impostare a true non declassa mai (un trip gia' pubblico resta pubblico).
        is_public: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", (existing as any).id);
  } else {
    await supabase.from("saved_trips").insert({
      user_id: input.userId,
      itinerary: input.itinerary,
      share_slug: slug,
      title,
      trip_id: null,
      // Auto-condivisione: il link inviato su Telegram deve essere visibile ai guest.
      is_public: true,
      notes: "Creato da Telegram bot",
      created_at: new Date().toISOString(),
    });
  }
  return slug;
}

export function shareSlugForSession(sessionId: string): string {
  return slugForSession(sessionId);
}

// A2 — Le idee/media "personali" (senza viaggio attivo) vengono inseriti in
// trip_messages con uno share_slug che NON ha un saved_trips padre. Le policy
// RLS di trip_messages richiedono un saved_trips padre con stesso share_slug e
// is_public=true, altrimenti i messaggi sono invisibili alla webapp (anon key).
//
// Questo helper garantisce (in modo idempotente) un saved_trip "contenitore"
// per lo slug dato, cosi' i trip_messages successivi risolvono il padre.
// - Idempotente: se il contenitore esiste gia', lo riusa senza duplicare.
//   Si limita a riportare is_public a true se per qualche motivo era false.
// - itinerary null: e' un contenitore, non un vero viaggio. La webapp mostra
//   comunque idee/media/chat legati allo slug.
export async function ensurePersonalContainer(input: {
  userId: string;
  shareSlug: string;
  title: string;
}): Promise<void> {
  const { data: existing } = await supabase
    .from("saved_trips")
    .select("id,is_public")
    .eq("share_slug", input.shareSlug)
    .maybeSingle();

  if (existing) {
    // Garantisce visibilita' guest senza toccare titolo/itinerario esistenti.
    if ((existing as { is_public?: boolean }).is_public !== true) {
      await supabase
        .from("saved_trips")
        .update({ is_public: true, updated_at: new Date().toISOString() })
        .eq("id", (existing as { id: string }).id);
    }
    return;
  }

  const { error } = await supabase.from("saved_trips").insert({
    user_id: input.userId,
    itinerary: null,
    share_slug: input.shareSlug,
    title: input.title,
    trip_id: null,
    is_public: true,
    notes: "Contenitore personale Telegram",
    created_at: new Date().toISOString(),
  });
  // Race condition (due insert quasi simultanei sullo stesso slug): un conflitto
  // sull'unique share_slug e' benigno, il contenitore esiste comunque.
  if (error && !/duplicate|unique|conflict/i.test(error.message ?? "")) throw error;
}
