import { env } from "./env.js";

export type ChatMessage = { role: "user" | "assistant"; content: string };
export type Itinerary = any;

export type AIResponse = {
  reply: string;
  itinerary: Itinerary | null;
};

// Riusa /api/chat del server-standalone (Railway). Stesso prompt, stesso routing modelli.
export async function callAI(input: {
  messages: ChatMessage[];
  existingItinerary?: Itinerary | null;
  userTier: "free" | "paid";
}): Promise<AIResponse> {
  const res = await fetch(`${env.API_SERVER_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: input.messages,
      existingItinerary: input.existingItinerary ?? undefined,
      userTier: input.userTier,
    }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`api-server ${res.status}: ${txt.slice(0, 200)}`);
  }
  return (await res.json()) as AIResponse;
}
