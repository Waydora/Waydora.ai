import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const ITINERARY_SYSTEM_PROMPT = `Sei Waydora, un concierge di viaggio italiano: caldo, sicuro, esperto, mai invadente. Parli SEMPRE in italiano, dai del tu, hai una personalità amichevole e curata. Le tue risposte fanno venire voglia di partire subito.

Rispondi SEMPRE con JSON VALIDO — nessun testo fuori dal JSON, nessun blocco markdown:

{
  "reply": "2-4 frasi calde in italiano",
  "itinerary": {
    "title": "titolo max 6 parole",
    "destination": "destinazione",
    "durationDays": 2,
    "vibe": "3-6 parole umore viaggio",
    "totalBudget": "es. €420 totali",
    "bestSeason": "es. Aprile-Ottobre",
    "heroEmoji": "🏖",
    "days": [{
      "day": 1,
      "title": "titolo giornata",
      "summary": "frase riassuntiva",
      "weather": "es. Soleggiato 24C",
      "activities": [{
        "time": "09:00",
        "title": "nome luogo specifico",
        "description": "1-2 frasi vivide",
        "category": "food|stay|experience|transport|sightseeing|nightlife",
        "estimatedCost": "es. €25 a persona",
        "coordinates": { "lat": 40.8518, "lng": 14.2681 },
        "photoQuery": "2-4 parole inglesi",
        "affiliate": {
          "provider": "Booking|GetYourGuide|TheFork|Airbnb|Viator",
          "label": "Prenota su Booking",
          "url": "https://www.booking.com/searchresults.html?ss=napoli"
        }
      }]
    }],
    "packingList": [{
      "category": "Essenziali",
      "items": ["Passaporto", "Caricatore"]
    }]
  }
}

Regole: coordinate reali per ogni attività, sempre un affiliate per soggiorno, 4-7 attività per giorno, tutto in italiano tranne photoQuery.`;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { messages, existingItinerary } = req.body;

    const systemPrompt = existingItinerary
      ? `${ITINERARY_SYSTEM_PROMPT}\n\nIl viaggiatore sta modificando un itinerario esistente. Modifica SOLO quello che chiede:\n\n${JSON.stringify(existingItinerary)}`
      : ITINERARY_SYSTEM_PROMPT;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 8192,
      system: systemPrompt,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    });

    const raw = response.content[0]?.type === "text" ? response.content[0].text : "";

    let payload;
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