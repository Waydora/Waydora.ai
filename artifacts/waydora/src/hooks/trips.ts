// src/hooks/trips.ts
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { ItineraryData } from "@/hooks/api";

// ── Tipi ──────────────────────────────────────────────────────────────────

export type ChatSessionRow = {
  id: string;
  user_id: string;
  title: string;
  turns: any[];
  api_messages: any[];
  itinerary: ItineraryData | null;
  created_at: string;
  updated_at: string;
};

export type UserTripRow = {
  id: string;
  user_id: string;
  title: string;
  destination: string;
  description: string;
  cover_photo: string;
  budget: string;
  best_season: string;
  hero_emoji: string;
  status: "draft" | "published";
  days: any[];
  itinerary: ItineraryData | null;
  created_at: string;
  updated_at: string;
};

export type SavedTripRow = {
  id: string;
  user_id: string;
  trip_id: string | null;
  itinerary: ItineraryData | null;
  share_slug: string;
  title: string;
  notes: string;
  is_public: boolean;
  created_at: string;
  // campo locale per i preferiti dai viaggi curati
  featured_trip_id?: string;
};

// ── Genera slug univoco ───────────────────────────────────────────────────
function generateSlug(): string {
  return Math.random().toString(36).substring(2, 10);
}

// ── Hook: sessioni chat ───────────────────────────────────────────────────

export function useChatSessions(userId: string | undefined) {
  const [sessions, setSessions] = useState<ChatSessionRow[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!userId) { setSessions([]); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from("chat_sessions")
      .select("*")
      .eq("user_id", userId)
      .not("title", "like", "tg:%") // escludi le sessioni interne del bot Telegram
      .order("updated_at", { ascending: false })
      .limit(20);
    if (!error && data) setSessions(data as ChatSessionRow[]);
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const upsert = useCallback(async (session: {
    id?: string;
    title: string;
    turns: any[];
    api_messages: any[];
    itinerary?: ItineraryData | null;
  }) => {
    if (!userId) return null;
    const payload = {
      user_id: userId,
      title: session.title,
      turns: session.turns,
      api_messages: session.api_messages,
      itinerary: session.itinerary ?? null,
      updated_at: new Date().toISOString(),
    };
    if (session.id) {
      const { data, error } = await supabase
        .from("chat_sessions")
        .update(payload)
        .eq("id", session.id)
        .select()
        .single();
      if (!error && data) {
        setSessions(prev => prev.map(s => s.id === data.id ? data as ChatSessionRow : s));
        return data as ChatSessionRow;
      }
    } else {
      const { data, error } = await supabase
        .from("chat_sessions")
        .insert({ ...payload, created_at: new Date().toISOString() })
        .select()
        .single();
      if (!error && data) {
        setSessions(prev => [data as ChatSessionRow, ...prev]);
        return data as ChatSessionRow;
      }
    }
    return null;
  }, [userId]);

  const remove = useCallback(async (id: string) => {
    await supabase.from("chat_sessions").delete().eq("id", id);
    setSessions(prev => prev.filter(s => s.id !== id));
  }, []);

  return { sessions, loading, upsert, remove, reload: load };
}

// ── Hook: viaggi utente (bozze + pubblicati) ──────────────────────────────

export function useUserTrips(userId: string | undefined) {
  const [trips, setTrips] = useState<UserTripRow[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!userId) { setTrips([]); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from("user_trips")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });
    if (!error && data) setTrips(data as UserTripRow[]);
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const upsert = useCallback(async (trip: Partial<UserTripRow> & { title: string }) => {
    if (!userId) return null;
    const payload = {
      user_id: userId,
      title: trip.title,
      destination: trip.destination ?? "",
      description: trip.description ?? "",
      cover_photo: trip.cover_photo ?? "",
      budget: trip.budget ?? "",
      best_season: trip.best_season ?? "",
      hero_emoji: trip.hero_emoji ?? "🗺️",
      status: trip.status ?? "draft",
      days: trip.days ?? [],
      itinerary: trip.itinerary ?? null,
      updated_at: new Date().toISOString(),
    };
    if (trip.id) {
      const { data, error } = await supabase
        .from("user_trips")
        .update(payload)
        .eq("id", trip.id)
        .select()
        .single();
      if (!error && data) {
        setTrips(prev => prev.map(t => t.id === data.id ? data as UserTripRow : t));
        return data as UserTripRow;
      }
    } else {
      const { data, error } = await supabase
        .from("user_trips")
        .insert({ ...payload, created_at: new Date().toISOString() })
        .select()
        .single();
      if (!error && data) {
        setTrips(prev => [data as UserTripRow, ...prev]);
        return data as UserTripRow;
      }
    }
    return null;
  }, [userId]);

  const publish = useCallback(async (id: string) => {
    const { data, error } = await supabase
      .from("user_trips")
      .update({ status: "published", updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (!error && data) {
      setTrips(prev => prev.map(t => t.id === id ? data as UserTripRow : t));
      return data as UserTripRow;
    }
    return null;
  }, []);

  const remove = useCallback(async (id: string) => {
    await supabase.from("user_trips").delete().eq("id", id);
    setTrips(prev => prev.filter(t => t.id !== id));
  }, []);

  return { trips, loading, upsert, publish, remove, reload: load };
}

// ── Hook: viaggi salvati ──────────────────────────────────────────────────

export function useSavedTrips(userId: string | undefined) {
  const [saved, setSaved] = useState<SavedTripRow[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!userId) { setSaved([]); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from("saved_trips")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (!error && data) setSaved(data as SavedTripRow[]);
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  // ── Salva un itinerario generato dall'AI ──────────────────────────────
  const saveItinerary = useCallback(async (itinerary: ItineraryData, title?: string) => {
    if (!userId) return null;
    const slug = generateSlug();
    const { data, error } = await supabase
      .from("saved_trips")
      .insert({
        user_id: userId,
        itinerary,
        share_slug: slug,
        title: title ?? itinerary.title,
        trip_id: null,
        notes: "",
        created_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (!error && data) {
      setSaved(prev => [data as SavedTripRow, ...prev]);
      return data as SavedTripRow;
    }
    return null;
  }, [userId]);

  // ── Salva/rimuove un viaggio curato (cuore) ───────────────────────────
  // I viaggi curati del team NON hanno un trip_id su Supabase.
  // Li salviamo in saved_trips con featured_trip_id nel campo notes (workaround)
  // e itinerary null (sono template, non itinerari completi).
  const toggleFeaturedTrip = useCallback(async (featuredId: string, title: string) => {
    if (!userId) return false;

    // Controlla se già salvato cercando nel campo notes il featured_id
    const existing = saved.find(s => s.notes === `featured:${featuredId}`);

    if (existing) {
      // Rimuovi
      const { error } = await supabase
        .from("saved_trips")
        .delete()
        .eq("id", existing.id);
      if (!error) {
        setSaved(prev => prev.filter(s => s.id !== existing.id));
        return false; // ora non è più salvato
      }
    } else {
      // Aggiungi
      const slug = generateSlug();
      const { data, error } = await supabase
        .from("saved_trips")
        .insert({
          user_id: userId,
          itinerary: null,
          share_slug: slug,
          title,
          trip_id: null,
          notes: `featured:${featuredId}`, // identifica il viaggio curato
          created_at: new Date().toISOString(),
        })
        .select()
        .single();
      if (!error && data) {
        setSaved(prev => [data as SavedTripRow, ...prev]);
        return true; // ora è salvato
      }
    }
    return existing ? false : false;
  }, [userId, saved]);

  const remove = useCallback(async (id: string) => {
    await supabase.from("saved_trips").delete().eq("id", id);
    setSaved(prev => prev.filter(s => s.id !== id));
  }, []);

  // ── Rende un viaggio pubblico (condiviso) o privato ───────────────────
  // is_public = true => il link /trip/<slug> diventa accessibile a chiunque.
  // is_public = false => il link torna privato (solo owner loggato).
  const setPublic = useCallback(async (id: string, isPublic: boolean): Promise<boolean> => {
    const { error } = await supabase
      .from("saved_trips")
      .update({ is_public: isPublic })
      .eq("id", id);
    if (error) return false;
    setSaved(prev => prev.map(s => s.id === id ? { ...s, is_public: isPublic } : s));
    return true;
  }, []);

  const getBySlug = useCallback(async (slug: string): Promise<SavedTripRow | null> => {
    const { data, error } = await supabase
      .from("saved_trips")
      .select("*")
      .eq("share_slug", slug)
      .single();
    if (error || !data) return null;
    return data as SavedTripRow;
  }, []);

  // Controlla se un viaggio curato è nei preferiti
  const isFeaturedLiked = useCallback(
    (featuredId: string) => saved.some(s => s.notes === `featured:${featuredId}`),
    [saved]
  );

  return {
    saved, loading, saveItinerary, toggleFeaturedTrip,
    remove, setPublic, getBySlug, isFeaturedLiked, reload: load,
  };
}

// ── Hook: localStorage per sessioni utenti non loggati ────────────────────

export function useLocalSessions() {
  const STORAGE_KEY = "waydora_sessions";

  const load = (): any[] => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]"); } catch { return []; }
  };

  const add = (session: any) => {
    try {
      const sessions = load();
      const updated = [session, ...sessions.filter((s: any) => s.id !== session.id)].slice(0, 10);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {}
  };

  const clear = () => { try { localStorage.removeItem(STORAGE_KEY); } catch {} };

  const remove = (id: string | number) => {
    try {
      const sessions = load();
      const updated = sessions.filter((s: any) => String(s.id) !== String(id));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {}
  };

  return { load, add, clear, remove };
}