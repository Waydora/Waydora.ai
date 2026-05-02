import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const ITINERARY_SYSTEM_PROMPT = `Sei Waydora, assistente di viaggio italiano. Rispondi SOLO con JSON valido, nessun testo fuori:

{"reply":"2 frasi calde in italiano","itinerary":{"title":"max 5 parole","destination":"città","durationDays":2,"vibe":"mood viaggio","totalBudget":"€400 totali","bestSeason":"Aprile-Ottobre","heroEmoji":"🏖","days":[{"day":1,"title":"titolo giornata","summary":"frase","weather":"Soleggiato 22C","activities":[{"time":"09:00","title":"Nome Luogo","description":"frase vivida","category":"food","estimatedCost":"€10","coordinates":{"lat":40.85,"lng":14.27},"photoQuery":"napoli pizza","affiliate":{"provider":"Booking","label":"Prenota","url":"https://www.booking.com/searchresults.html?ss=napoli"}}]}],"packingList":[{"category":"Essenziali","items":["Passaporto"]}]}}

Regole: coordinate reali, affiliate per ogni soggiorno, 4-5 attività/giorno, tutto in italiano.`;

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
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4096,
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