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
