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

// Voce di budget PIANIFICATO (spesa "in programma"). Vive dentro l'itinerario
// (quindi condivisa col link e impostabile già in fase di creazione).
export type BudgetItem = {
  id: string;
  category: "food" | "transport" | "stay" | "activity" | "shopping" | "other";
  label: string;
  amount: number;
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
  budgetPlan?: BudgetItem[];
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
  // Profilo viaggiatore (auto dai viaggi salvati) → personalizza i suggerimenti AI.
  userProfile?: string;
};

// Decide se un messaggio è "semplice" (saluto, meteo, consiglio, domanda sul
// viaggio) e quindi adatto allo streaming testuale, oppure se serve il flusso
// JSON completo (creazione/modifica itinerario). Conservativo: nel dubbio → false.
// Rispecchia i "kind" testuali del router server (weather/chat-cheap/consult);
// il server ha comunque l'ultima parola e risponde 409 {fallback} se sbagliamo.
export function isSimpleChat(prompt: string, hasItinerary: boolean): boolean {
  const t = (prompt || "").toLowerCase().trim();
  if (!t) return false;
  const weatherRx = /\b(meteo|prevision\w*|che tempo|tempo (che )?(fa|farà)|temperatur\w*|piov\w*|grad[io]\b|clima|weather|fa(rà)? (caldo|freddo)|umidit|vento|nevic)/i;
  if (weatherRx.test(t)) return true;
  const editRx = /aggiungi|togli|sposta|rimuov|sostitu|cambia|modifica|elimina|metti|aggiorna|riordin|ottimizz/i;
  const itineraryRx = /itinerar|viagg|pianifica|organizza|programm|gior(no|ni)\s|vacanz|weekend|\btrip\b|tour|cosa\s+(fare|vedere)|dove\s+(andare|visitare)|vado\s+a|andare\s+a|partir|destinazion/i;
  if (hasItinerary) {
    // Consulto su un viaggio già aperto: nessuna modifica né nuovo itinerario.
    return !editRx.test(t) && !itineraryRx.test(t);
  }
  if (itineraryRx.test(t)) return false;
  const greetRx = /^(ciao|salve|hey|ehi|grazie|prego|ok|sì|si|no|wow|bene|perfetto|fantastico|buongiorno|buonasera|chi sei|come stai|che fai)\b/i;
  return greetRx.test(t) || t.length < 60;
}

// Streaming testuale per messaggi semplici: chiama /api/chat/stream (solo Railway)
// e invoca onDelta(testoAccumulato) man mano che arrivano i token.
// Ritorna { reply } a fine stream, oppure { fallback:true } se il server dice che
// la richiesta non è semplice → il chiamante deve usare il flusso JSON normale.
export async function streamSimpleChat(
  data: ChatData,
  onDelta: (fullText: string) => void,
): Promise<{ reply?: string; fallback?: boolean }> {
  const res = await fetch(`${API_BASE}/chat/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (res.status === 409) return { fallback: true };
  if (!res.ok || !res.body) {
    const err = await res.json().catch(() => ({} as any));
    if (res.status === 502 || res.status === 503) throw new Error(err.error || "Troppo traffico, riprova tra pochi secondi 🚀");
    if (res.status === 429) throw new Error(err.error || "Hai raggiunto il limite orario di richieste. Riprova più tardi.");
    throw new Error(err.error || "Errore chat");
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "", acc = "", finalReply = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let sep: number;
    while ((sep = buf.indexOf("\n\n")) !== -1) {
      const line = buf.slice(0, sep).trim();
      buf = buf.slice(sep + 2);
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      try {
        const obj = JSON.parse(payload);
        if (obj.error) throw new Error("Mi sono interrotta. Riprova fra un attimo.");
        if (typeof obj.delta === "string") { acc += obj.delta; onDelta(acc); }
        else if (obj.done) finalReply = typeof obj.reply === "string" ? obj.reply : acc;
      } catch (e: any) {
        if (e?.message && e.message !== "Unexpected end of JSON input") {
          // errore reale segnalato dal server (non un parse parziale)
          if (e.message.startsWith("Mi sono")) throw e;
        }
      }
    }
  }
  return { reply: finalReply || acc };
}

// ── [Streaming creazione] NDJSON: l'itinerario si scrive man mano ────────────
// Chiama /api/chat/stream-itinerary (Railway): il modello emette una riga JSON per
// oggetto (meta→day→act→packing→end) oppure UNA riga {t:"ask"} se serve discovery.
// onProgress riceve l'oggetto itinerario PARZIALE a ogni riga (per il render live).
// Throwa su errori di rete/stream → il chiamante ricade sul flusso JSON.
function assembleStreamItinerary(meta: any, dayHeads: any[], acts: any[], packing: any[]): ItineraryData {
  const days = [...dayHeads].sort((a, b) => a.day - b.day).map((dh) => ({
    day: dh.day, title: dh.title, summary: dh.summary, city: dh.city,
    activities: acts.filter((a) => a.day === dh.day).map((a) => ({
      time: a.time, title: a.title, description: a.description, category: a.category, estimatedCost: a.estimatedCost,
    })),
  })) as any;
  return {
    title: meta?.title ?? meta?.destination ?? "Viaggio",
    destination: meta?.destination ?? "",
    durationDays: meta?.durationDays ?? days.length,
    vibe: meta?.vibe ?? "", totalBudget: "", bestSeason: "",
    heroEmoji: meta?.heroEmoji ?? "🗺️",
    ...(meta?.departure ? { departure: meta.departure } : {}),
    days, packingList: packing,
  } as ItineraryData;
}

export async function streamCreateItinerary(
  data: { messages: ChatMessage[]; userTier: string; userProfile?: string | null },
  onProgress: (partial: ItineraryData) => void,
): Promise<{ kind: "ask"; reply: string } | { kind: "itinerary"; itinerary: ItineraryData }> {
  const res = await fetch(`${API_BASE}/chat/stream-itinerary`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages: data.messages, userTier: data.userTier, userProfile: data.userProfile ?? undefined }),
  });
  if (!res.ok || !res.body) {
    const e = await res.json().catch(() => ({} as any));
    if (res.status === 502 || res.status === 503) throw new Error(e.error || "Troppo traffico, riprova tra pochi secondi 🚀");
    if (res.status === 429) throw new Error(e.error || "Hai raggiunto il limite orario di richieste. Riprova più tardi.");
    throw new Error(e.error || "stream_failed");
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let meta: any = null; const dayHeads: any[] = []; const acts: any[] = []; const packing: any[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let sep: number;
    while ((sep = buf.indexOf("\n\n")) !== -1) {
      const frame = buf.slice(0, sep).trim();
      buf = buf.slice(sep + 2);
      if (!frame.startsWith("data:")) continue;
      let obj: any;
      try { obj = JSON.parse(frame.slice(5).trim()); } catch { continue; }
      if (obj.error) throw new Error("stream_failed");
      // `done` SENZA giorni reali = il modello ha risposto in prosa (nessuna riga NDJSON
      // valida) o lo stream si è interrotto: NON restituire un itinerario vuoto (che a
      // schermo diventa "Ecco il tuo itinerario per !" con 0 giorni). Segnaliamo vuoto →
      // il chiamante ricade in automatico sul flusso JSON robusto (/api/chat).
      if (obj.done) {
        if (dayHeads.length === 0) throw new Error("stream_empty");
        return { kind: "itinerary", itinerary: assembleStreamItinerary(meta, dayHeads, acts, packing) };
      }
      const l = obj.line;
      if (!l || typeof l.t !== "string") continue;
      if (l.t === "ask") return { kind: "ask", reply: typeof l.reply === "string" ? l.reply : "Dimmi qualcosa di più sul viaggio 🌍" };
      if (l.t === "meta") meta = l;
      else if (l.t === "day") dayHeads.push(l);
      else if (l.t === "act") acts.push(l);
      else if (l.t === "packing" && Array.isArray(l.items)) packing.push({ category: l.category || "Bagaglio", items: l.items });
      else continue;
      onProgress(assembleStreamItinerary(meta, dayHeads, acts, packing));
    }
  }
  if (dayHeads.length) return { kind: "itinerary", itinerary: assembleStreamItinerary(meta, dayHeads, acts, packing) };
  throw new Error("stream_empty");
}

// Arricchisce l'itinerario assemblato con coordinate (pin mappa) + affiliati. I POI
// non confermati da Places vengono declassati a "Cerca su Maps" lato server.
export async function enrichItinerary(itinerary: ItineraryData): Promise<ItineraryData> {
  try {
    const res = await fetch(`${API_BASE}/chat/itinerary-enrich`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itinerary }),
    });
    const j = await res.json().catch(() => ({} as any));
    return (j && j.itinerary) ? (j.itinerary as ItineraryData) : itinerary;
  } catch { return itinerary; }
}

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

      // Retry su 502: Sonnet/OpenRouter a volte risponde 502 in modo TRANSITORIO
      // (JSON malformato, max_tokens, o errore upstream momentaneo). Ritento UNA
      // volta SEMPRE — anche a inizio chat (history corta) dove prima non si ritentava
      // e l'utente vedeva l'errore pur riuscendo al 2° tentativo manuale.
      if (response.status === 502) {
        console.warn("[useChat] 502 da chat endpoint, retry automatico");
        const retryData = (data.messages?.length ?? 0) > 4 ? { ...data, messages: data.messages.slice(-4) } : data;
        response = await callOnce(retryData);
      }

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        // Messaggio user-friendly per i casi tipici
        const baseMsg = err.error || "";
        let userMsg = baseMsg;
        if (response.status === 503) {
          // Throttle di concorrenza lato server (troppe richieste in volo).
          userMsg = baseMsg || "Troppo traffico, riprova tra pochi secondi 🚀";
        } else if (response.status === 502) {
          userMsg = baseMsg.includes("troppo lungo")
            ? "L'itinerario richiesto è troppo lungo. Prova con meno giorni o sii più specifico (es. \"3 giorni a Roma\" invece di \"vacanza lunga in Europa\")."
            : "Troppo traffico, riprova tra pochi secondi 🚀";
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