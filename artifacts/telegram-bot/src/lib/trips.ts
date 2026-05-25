import { supabase } from "./supabase.js";

export type Trip = {
  id: string;
  user_id: string;
  title: string | null;
  destination: string | null;
  description: string | null;
  hero_emoji: string | null;
  status: "draft" | "published";
  days: any;
  itinerary: any;
};

export async function listTrips(userId: string): Promise<Trip[]> {
  const { data, error } = await supabase
    .from("user_trips")
    .select("id,user_id,title,destination,description,hero_emoji,status,days,itinerary")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(20);
  if (error) throw error;
  return (data as Trip[]) ?? [];
}

export async function getTrip(tripId: string, userId: string): Promise<Trip | null> {
  const { data, error } = await supabase
    .from("user_trips")
    .select("id,user_id,title,destination,description,hero_emoji,status,days,itinerary")
    .eq("id", tripId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data as Trip) ?? null;
}

// Risolve l'owner di un trip (per Realtime → push Telegram).
export async function getTripOwner(tripId: string): Promise<string | null> {
  const { data } = await supabase.from("user_trips").select("user_id").eq("id", tripId).maybeSingle();
  return (data as any)?.user_id ?? null;
}
