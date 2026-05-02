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

const API_BASE = "/api";

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

export function useChat() {
  return useMutation({
    mutationFn: async ({ data }: { data: { messages: ChatMessage[]; existingItinerary?: ItineraryData } }) => {
      const response = await fetch(`${API_BASE}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || "Errore chat");
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