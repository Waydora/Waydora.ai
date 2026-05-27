import { supabase } from "./supabase.js";

// Il sito Waydora salva i viaggi in `saved_trips`. La tabella `user_trips`
// invece e' per i draft del "Crea viaggio". Per il bot, l'utente si aspetta
// di vedere i viaggi salvati (quelli con share_slug, visibili in "Viaggi salvati").

export type SavedTrip = {
  id: string;
  user_id: string;
  share_slug: string;
  title: string | null;
  itinerary: any;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export async function listTrips(userId: string): Promise<SavedTrip[]> {
  const { data, error } = await supabase
    .from("saved_trips")
    .select("id,user_id,share_slug,title,itinerary,notes,created_at,updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(20);
  if (error) throw error;
  return (data as SavedTrip[]) ?? [];
}

export async function getTrip(tripId: string, userId: string): Promise<SavedTrip | null> {
  const { data, error } = await supabase
    .from("saved_trips")
    .select("id,user_id,share_slug,title,itinerary,notes,created_at,updated_at")
    .eq("id", tripId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data as SavedTrip) ?? null;
}

export async function getTripBySlug(slug: string): Promise<SavedTrip | null> {
  const { data, error } = await supabase
    .from("saved_trips")
    .select("id,user_id,share_slug,title,itinerary,notes,created_at,updated_at")
    .eq("share_slug", slug)
    .maybeSingle();
  if (error) throw error;
  return (data as SavedTrip) ?? null;
}

// Risolve l'owner di un trip via share_slug (per Realtime → push Telegram).
export async function getTripOwnerBySlug(shareSlug: string): Promise<string | null> {
  const { data } = await supabase
    .from("saved_trips")
    .select("user_id")
    .eq("share_slug", shareSlug)
    .maybeSingle();
  return (data as any)?.user_id ?? null;
}
