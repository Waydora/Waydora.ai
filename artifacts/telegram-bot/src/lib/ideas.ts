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

// Recupera share_slug del trip attivo se l'utente lo ha salvato; altrimenti slug personale.
export async function resolveIdeasSlug(userId: string, tripId?: string): Promise<string> {
  if (tripId) {
    const { data } = await supabase
      .from("saved_trips")
      .select("share_slug")
      .eq("user_id", userId)
      .eq("trip_id", tripId)
      .maybeSingle();
    if ((data as any)?.share_slug) return (data as any).share_slug;
  }
  return tgIdeasSlug(userId);
}
