import { env } from "./env.js";

export type ChatMessage = { role: "user" | "assistant"; content: string };
export type Itinerary = any;

export type AIResponse = {
  reply: string;
  itinerary: Itinerary | null;
};

// Riusa /api/chat del server-standalone (Railway). Stesso prompt, stesso routing modelli.
async function callOnce(input: {
  messages: ChatMessage[];
  existingItinerary?: Itinerary | null;
  userProfile?: string | null;
}): Promise<AIResponse> {
  const res = await fetch(`${env.API_SERVER_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: input.messages,
      existingItinerary: input.existingItinerary ?? undefined,
      // Il bot Telegram serve solo utenti Pro → tier paid (16k token cap)
      userTier: "paid",
      // Profilo viaggiatore (auto dai viaggi) → suggerimenti personalizzati.
      userProfile: input.userProfile ?? undefined,
    }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`api-server ${res.status}: ${txt.slice(0, 200)}`);
  }
  return (await res.json()) as AIResponse;
}

export async function callAI(input: {
  messages: ChatMessage[];
  existingItinerary?: Itinerary | null;
  userTier: "free" | "paid";
  userProfile?: string | null;
}): Promise<AIResponse> {
  try {
    return await callOnce(input);
  } catch (e: any) {
    const msg = String(e?.message ?? e);
    // 502 dall'api-server = JSON malformato di Sonnet, spesso transitorio.
    // Retry una volta con history ridotta a ultimi 4 turni (meno contesto = piu' margine per JSON).
    if (msg.includes("502") || msg.includes("Risposta non valida")) {
      console.warn("[chat-bridge] retry con history ridotta dopo 502");
      const slim = input.messages.slice(-4);
      return await callOnce({ ...input, messages: slim });
    }
    throw e;
  }
}
