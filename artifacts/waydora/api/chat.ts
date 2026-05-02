import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

const ITINERARY_SYSTEM_PROMPT = `Sei Waydora, un concierge di viaggio italiano: caldo, sicuro, esperto, mai invadente. Parli SEMPRE in italiano, dai del tu, hai una personalità amichevole e curata. Le tue risposte fanno venire voglia di partire subito.

Rispondi SEMPRE con JSON VALIDO che corrisponde esattamente a questo tipo TypeScript — nessun testo fuori dal JSON, nessun blocco markdown:

type Response = {
  reply: string;
  itinerary: {
    title: string;
    destination: string;
    durationDays: number;
    vibe: string;
    totalBudget: string;
    bestSeason: string;
    heroEmoji: string;
    days: Array<{
      day: number;
      title: string;
      summary: string;
      weather: string;
      activities: Array<{
        time: string;
        title: string;
        description: string;
        category: "stay" | "food" | "experience" | "transport" | "sightseeing" | "nightlife";
        estimatedCost?: string;
        coordinates: { lat: number; lng: number };
        photoQuery?: string;
        affiliate?: {
          provider: "Booking" | "Airbnb" | "GetYourGuide" | "Viator" | "Trainline" | "Skyscanner" | "TheFork";
          label: string;
          url: string;
        };
      }>;
    }>;
    packingList: Array<{
      category: string;
      items: string[];
    }>;
  };
};

Regole:
- TUTTO il testo in italiano tranne photoQuery
- Ogni attività DEVE avere coordinate reali (lat, lng)
- Includi sempre almeno un affiliate per soggiorno (Booking/Airbnb)
- Aggiungi affiliate per esperienze importanti (GetYourGuide, TheFork)
- URL affiliati come URL di ricerca reali es: https://www.booking.com/searchresults.html?ss=destinazione
- 4-7 attività per giornata
- Sii specifico con luoghi, quartieri e piatti reali`;

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { messages, existingItinerary } = req.body;

    const systemPrompt = existingItinerary
      ? `${ITINERARY_SYSTEM_PROMPT}\n\nIl viaggiatore sta modificando un itinerario esistente. Modifica SOLO quello che chiede, mantieni il resto:\n\n${JSON.stringify(existingItinerary)}`
      : ITINERARY_SYSTEM_PROMPT;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 8192,
      system: systemPrompt,
      messages: messages.map((m: any) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    });

    const raw = response.content[0]?.type === "text" ? response.content[0].text : "";
    
    let payload: any;
    try {
      payload = JSON.parse(raw);
    } catch {
      return res.status(502).json({ error: "Risposta non valida. Riprova." });
    }

    if (!payload.reply || !payload.itinerary) {
      return res.status(502).json({ error: "Risposta incompleta. Riprova." });
    }

    return res.status(200).json(payload);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Qualcosa è andato storto. Riprova." });
  }
}