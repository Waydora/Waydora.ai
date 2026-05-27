import { supabase } from "./supabase.js";

// Le idee vivono in trip_messages (esistente, con realtime), legate via share_slug.
// Per le idee "personali da Telegram" senza un trip salvato, usiamo share_slug = "tg-ideas-<userId>".

export function tgIdeasSlug(userId: string): string {
  return `tg-ideas-${userId}`;
}

export async function addIdea(opts: {
  shareSlug: string;
  text: string;
}): Promise<void> {
  const { error } = await supabase.from("trip_messages").insert({
    share_slug: opts.shareSlug,
    author: "telegram",
    text: opts.text,
    type: "idea",
  });
  if (error) throw error;
}

export async function listIdeas(shareSlug: string, limit = 20) {
  const { data, error } = await supabase
    .from("trip_messages")
    .select("id,text,created_at,author")
    .eq("share_slug", shareSlug)
    .eq("type", "idea")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as Array<{ id: number; text: string; created_at: string; author: string }>) ?? [];
}

// Risolve lo slug dove scrivere/leggere le idee:
// 1. Se la sessione corrente ha gia' uno shareSlug (trip attivo) → usa quello
// 2. Altrimenti slug personale tg-ideas-<userId>
export async function resolveIdeasSlug(userId: string, activeShareSlug?: string | null): Promise<string> {
  if (activeShareSlug) return activeShareSlug;
  return tgIdeasSlug(userId);
}
