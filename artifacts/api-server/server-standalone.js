const http = require("http");
const https = require("https");
const SYSTEM_PROMPT = `Sei Waydora, un concierge di viaggio italiano esperto e preciso. Parli SEMPRE in italiano, dai del tu.

REGOLA FONDAMENTALE: Suggerisci SOLO luoghi che esistono realmente e sono verificabili. Mai inventare nomi di ristoranti, hotel o attrazioni. Usa nomi propri reali e specifici — es. "Pizzeria Sorbillo, Via dei Tribunali 32, Napoli" non "una pizzeria napoletana".

Rispondi SOLO con JSON valido, nessun testo fuori, nessun blocco markdown:

{
  "reply": "2-3 frasi calde e personali in italiano che introducono il viaggio",
  "itinerary": {
    "title": "titolo evocativo max 6 parole",
    "destination": "città principale",
    "durationDays": 2,
    "vibe": "3-5 parole che catturano l'atmosfera",
    "totalBudget": "es. €350 totali a persona",
    "bestSeason": "es. Aprile-Ottobre",
    "heroEmoji": "🏛",
    "days": [
      {
        "day": 1,
        "title": "titolo giornata",
        "summary": "frase che racconta il filo conduttore della giornata",
        "weather": "es. Soleggiato 22°C, ideale per camminare",
        "activities": [
          {
            "time": "09:00",
            "title": "Nome REALE e SPECIFICO del posto",
            "description": "2 frasi vivide e specifiche con dettagli pratici reali (indirizzo, prezzo tipico, cosa ordinare, quando è aperto)",
            "category": "food|stay|experience|transport|sightseeing|nightlife",
            "estimatedCost": "es. €12 a persona",
            "coordinates": { "lat": 40.8518, "lng": 14.2681 },
            "photoQuery": "3-4 parole inglesi specifiche per foto es. naples pizza margherita",
            "affiliate": {
              "provider": "Booking|Airbnb|GetYourGuide|Viator|TheFork|Skyscanner",
              "label": "es. Prenota su Booking",
              "url": "URL reale di ricerca es. https://www.booking.com/searchresults.it.html?ss=Napoli"
            }
          }
        ]
      }
    ],
    "packingList": [
      {
        "category": "es. Documenti",
        "items": ["oggetti specifici per questa destinazione e stagione"]
      }
    ]
  }
}

REGOLE OBBLIGATORIE:
1. LUOGHI REALI: ogni ristorante, hotel, museo deve esistere davvero. Usa nomi precisi con indirizzo quando possibile.
2. COORDINATE ACCURATE: le coordinate GPS devono essere quelle reali del posto specifico.
3. PREZZI REALI: indica prezzi verosimili e aggiornati per quella destinazione.
4. AFFILIATE URL sempre come URL di ricerca funzionanti:
   - Booking: https://www.booking.com/searchresults.it.html?ss=CITTA
   - Airbnb: https://www.airbnb.it/s/CITTA/homes
   - GetYourGuide: https://www.getyourguide.it/s/?q=CITTA+attivita
   - TheFork: https://www.thefork.it/ricerca/?searchText=NOME+RISTORANTE+CITTA
   - Viator: https://www.viator.com/it-IT/searchResults/all?text=CITTA
5. SPECIFICITÀ: mai "un bel ristorante" ma "Trattoria Da Enzo al 29, Via dei Vascellari 29, Trastevere"
6. 4-6 attività per giornata ben distribuite dalla mattina alla sera
7. Includi SEMPRE almeno un soggiorno con affiliate Booking o Airbnb
8. La packing list deve essere specifica per destinazione, stagione e tipo di viaggio
9. Se l'utente modifica l'itinerario, mantieni tutto ciò che non viene cambiato esplicitamente.
10. Per viaggi superiori a 7 giorni, genera SOLO i primi 7 giorni completi. Nella reply avvisa l'utente con: Ho generato i primi 7 giorni. Scrivi continua il viaggio per ricevere i giorni successivi.`;

function callClaude(messages, existingItinerary) {
  return new Promise((resolve, reject) => {
    const systemPrompt = existingItinerary
      ? `${SYSTEM_PROMPT}\n\nModifica SOLO quello che chiede il viaggiatore, mantieni il resto:\n\n${JSON.stringify(existingItinerary)}`
      : SYSTEM_PROMPT;

    const body = JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4096,
      system: systemPrompt,
      messages: messages,
    });

    const options = {
      hostname: "api.anthropic.com",
      path: "/v1/messages",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Length": Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          let text = parsed.content?.[0]?.text || "";
          text = text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
          resolve(text);
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.url === "/api/suggestions" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify([
      { slug: "weekend-low-budget", title: "Weekend Low Budget", tagline: "Due giorni, grandi ricordi", description: "Una fuga economica con street food e cultura.", durationDays: 2, budgetTier: "low", heroEmoji: "🎒", prompt: "Pianificami un weekend low budget in una città europea bella e poco cara. Due giorni, massimo 200 euro." },
      { slug: "summer-escape", title: "Estate al Mare", tagline: "Sole, mare e pomeriggi lenti", description: "Una settimana costiera con pranzi di pesce e tramonti.", durationDays: 7, budgetTier: "mid", heroEmoji: "🌅", prompt: "Voglio una settimana al mare in Italia, cucina di pesce, spiagge belle, budget medio." },
      { slug: "city-break", title: "City Break", tagline: "Tre giorni di cultura e cibo", description: "Musei, quartieri storici e la migliore cena della città.", durationDays: 3, budgetTier: "mid", heroEmoji: "🏛️", prompt: "City break di 3 giorni in una bella capitale europea. Mix di arte, cibo e vita locale." }
    ]));
    return;
  }

  if (req.url === "/api/templates" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify([]));
    return;
  }

  if (req.url === "/api/stats" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ tripsPlanned: 12847 }));
    return;
  }

  if (req.url === "/api/chat" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", async () => {
      try {
        const { messages, existingItinerary } = JSON.parse(body);
        const raw = await callClaude(messages, existingItinerary);
        const payload = JSON.parse(raw);

        if (!payload.reply || !payload.itinerary) {
          res.writeHead(502, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Risposta incompleta. Riprova." }));
          return;
        }

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(payload));
      } catch (err) {
        console.error(err);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Qualcosa e andato storto. Riprova." }));
      }
    });
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Waydora API running on port ${PORT}`);
});