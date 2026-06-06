import { useMutation, useQuery } from "@tanstack/react-query";

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type ItineraryActivity = {
  time: string;
  title: string;
  description: string;
  category: "stay" | "food" | "experience" | "transport" | "sightseeing" | "nightlife";
  estimatedCost?: string;
  coordinates?: { lat: number; lng: number };
  photoQuery?: string;
  affiliate?: {
    provider: string;
    label: string;
    url: string;
  };
};

export type ItineraryDay = {
  day: number;
  title: string;
  summary: string;
  weather?: string;
  activities: ItineraryActivity[];
};

export type PackingCategory = {
  category: string;
  items: string[];
};

export type ItineraryData = {
  title: string;
  destination: string;
  durationDays: number;
  vibe: string;
  totalBudget: string;
  bestSeason: string;
  heroEmoji: string;
  days: ItineraryDay[];
  packingList: PackingCategory[];
};

export type Suggestion = {
  slug: string;
  title: string;
  tagline: string;
  description: string;
  heroEmoji: string;
  budgetTier: "low" | "mid" | "high";
  prompt: string;
};

export type TripTemplate = {
  slug: string;
  title: string;
  subtitle: string;
  heroEmoji: string;
  coverPhotoQuery?: string;
  itinerary: ItineraryData;
};

export type SavedItinerary = {
  id: number;
  shareSlug: string;
  createdAt: string;
  itinerary: ItineraryData;
};

const API_BASE = (import.meta.env.VITE_API_URL ?? "https://waydoraai-production.up.railway.app") + "/api";
const CHAT_BASE = import.meta.env.VITE_CHAT_URL ?? "";

export function useListSuggestions() {
  return useQuery({
    queryKey: ["suggestions"],
    queryFn: async (): Promise<Suggestion[]> => {
      const res = await fetch(`${API_BASE}/suggestions`);
      if (!res.ok) return [];
      return res.json();
    },
  });
}

export function useListTemplates() {
  return useQuery({
    queryKey: ["templates"],
    queryFn: async (): Promise<TripTemplate[]> => {
      const res = await fetch(`${API_BASE}/templates`);
      if (!res.ok) return [];
      return res.json();
    },
  });
}

export function useGetStats() {
  return useQuery({
    queryKey: ["stats"],
    queryFn: async (): Promise<{ tripsPlanned: number }> => {
      const res = await fetch(`${API_BASE}/stats`);
      if (!res.ok) return { tripsPlanned: 12847 };
      return res.json();
    },
  });
}

export function useListItineraries() {
  return useQuery({
    queryKey: ["itineraries"],
    queryFn: async (): Promise<SavedItinerary[]> => {
      const res = await fetch(`${API_BASE}/itineraries`);
      if (!res.ok) return [];
      return res.json();
    },
  });
}

export function useGetSharedItinerary(slug: string, options?: any) {
  return useQuery({
    queryKey: ["itinerary", slug],
    queryFn: async (): Promise<SavedItinerary> => {
      const res = await fetch(`${API_BASE}/itineraries/share/${slug}`);
      if (!res.ok) throw new Error("Itinerary not found");
      return res.json();
    },
    enabled: !!slug,
    ...options?.query,
  });
}

export function getGetSharedItineraryQueryKey(slug: string) {
  return ["itinerary", slug];
}

// Generazione progressiva: per viaggi lunghi si chiede prima un chunk di giorni
// (es. 1-2), poi il resto in background. `progressive` indica il range richiesto.
export type ProgressiveRange = { totalDays: number; from: number; to: number };
export type ChatData = {
  messages: ChatMessage[];
  existingItinerary?: ItineraryData;
  mediaContent?: any;
  userTier?: string;
  progressive?: ProgressiveRange;
};

// Chiamata singola (senza retry/stato mutation): usata per il prefetch in background
// dei giorni restanti, in parallelo al turno principale gestito da useChat.
export async function fetchChatChunk(data: ChatData, useRailway?: boolean): Promise<{ reply: string; itinerary?: ItineraryData }> {
  const url = useRailway ? `${API_BASE}/chat` : `${CHAT_BASE}/api/chat`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error(`chunk ${response.status}`);
  return response.json() as Promise<{ reply: string; itinerary?: ItineraryData }>;
}

export function useChat() {
  return useMutation({
    mutationFn: async ({ data, useRailway }: {
      data: ChatData;
      useRailway?: boolean;
    }) => {
      // useRailway=true → endpoint Railway (Sonnet, no timeout 60s, max qualità)
      // useRailway=false/undefined → endpoint Vercel (Haiku, veloce, economico)
      const url = useRailway
        ? `${API_BASE}/chat`               // es. https://waydoraai-production.up.railway.app/api/chat
        : `${CHAT_BASE}/api/chat`;          // relativo → Vercel serverless

      // Helper: una singola chiamata
      const callOnce = async (payload: typeof data) => {
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        return response;
      };

      let response = await callOnce(data);

      // Retry su 502: Sonnet ha emesso JSON malformato o ha colpito max_tokens.
      // Stesso pattern del bot Telegram: ritento UNA volta con history slim (ultimi 4 turni).
      // Meno contesto = più margine per JSON completo + meno probabilità di troncamento.
      if (response.status === 502 && data.messages?.length > 4) {
        console.warn("[useChat] 502 da chat endpoint, retry con history ridotta");
        const slim = { ...data, messages: data.messages.slice(-4) };
        response = await callOnce(slim);
      }

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        // Messaggio user-friendly per i casi tipici
        const baseMsg = err.error || "";
        let userMsg = baseMsg;
        if (response.status === 502) {
          userMsg = baseMsg.includes("troppo lungo")
            ? "L'itinerario richiesto è troppo lungo. Prova con meno giorni o sii più specifico (es. \"3 giorni a Roma\" invece di \"vacanza lunga in Europa\")."
            : "Mi sono incartata sulla risposta. Riformula la richiesta in modo più semplice o riprova fra qualche secondo.";
        } else if (response.status === 429) {
          userMsg = baseMsg || "Hai raggiunto il limite orario di richieste. Riprova più tardi.";
        }
        throw new Error(userMsg || "Errore chat");
      }
      return response.json() as Promise<{ reply: string; itinerary?: ItineraryData }>;
    },
  });
}

export function useSaveItinerary() {
  return useMutation({
    mutationFn: async ({ data }: { data: { itinerary: ItineraryData } }) => {
      const response = await fetch(`${API_BASE}/itineraries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Errore salvataggio");
      return response.json() as Promise<SavedItinerary>;
    },
  });
}