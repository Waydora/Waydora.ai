const http = require("http");
const https = require("https");

const SYSTEM_PROMPT = `Sei Waydora, un concierge di viaggio italiano esperto e preciso. Parli SEMPRE in italiano, dai del tu.

REGOLA FONDAMENTALE: Suggerisci SOLO luoghi che esistono realmente e sono verificabili. Mai inventare nomi di ristoranti, hotel o attrazioni. Usa nomi propri reali e specifici.

Rispondi SOLO con JSON valido, nessun testo fuori, nessun blocco markdown:

{"reply":"2-3 frasi calde","itinerary":{"title":"titolo max 6 parole","destination":"citta","durationDays":2,"vibe":"atmosfera","totalBudget":"euro totali","bestSeason":"mesi","heroEmoji":"emoji","days":[{"day":1,"title":"titolo giornata","summary":"frase","weather":"meteo","activities":[{"time":"09:00","title":"Nome Reale Posto","description":"2 frasi vivide con indirizzo e prezzo reale","category":"food|stay|experience|transport|sightseeing|nightlife","estimatedCost":"euro","coordinates":{"lat":41.9028,"lng":12.4964},"photoQuery":"parole inglesi foto","affiliate":{"provider":"Booking","label":"Prenota su Booking","url":"https://www.booking.com/searchresults.it.html?ss=Roma"}}]}],"packingList":[{"category":"Documenti","items":["Passaporto"]}]}}

REGOLE:
1. Solo luoghi reali con nomi specifici e indirizzi
2. Coordinate GPS reali e accurate
3. Prezzi verosimili per la destinazione
4. URL affiliati funzionanti: Booking ss=CITTA, Airbnb s/CITTA/homes, GetYourGuide q=CITTA, TheFork searchText=RISTORANTE
5. 4-6 attivita per giornata dalla mattina alla sera
6. Sempre almeno un soggiorno con affiliate Booking o Airbnb
7. Packing list specifica per destinazione e stagione
8. Per viaggi oltre 7 giorni genera solo i primi 7 e avvisa nella reply di scrivere continua il viaggio`;

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