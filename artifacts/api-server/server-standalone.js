const http = require("http");
const https = require("https");

const SYSTEM_PROMPT = `Sei Waydora, assistente viaggi. Rispondi SOLO con JSON valido e ben formato, zero testo fuori.

{"reply":"1-2 frasi italiane","itinerary":{"title":"titolo breve","destination":"citta","durationDays":3,"vibe":"atmosfera","totalBudget":"budget","bestSeason":"stagione","heroEmoji":"emoji","days":[{"day":1,"title":"titolo","summary":"frase","weather":"meteo","activities":[{"time":"09:00","title":"Nome Posto Reale","description":"descrizione breve con indirizzo","category":"sightseeing","estimatedCost":"€15","coordinates":{"lat":41.90,"lng":12.49},"photoQuery":"rome italy","affiliate":{"provider":"GetYourGuide","label":"Prenota","url":"https://www.getyourguide.it/s/?q=roma"}}]}],"packingList":[{"category":"Essenziali","items":["Passaporto"]}]}}

IMPORTANTE: Massimo 2 giorni per risposta, 3 attivita per giorno. JSON DEVE essere completo e valido. Coordinate reali. Luoghi reali. Se richiesti piu giorni avvisa nella reply.`;

function callClaude(messages, existingItinerary) {
  return new Promise((resolve, reject) => {
    const systemPrompt = existingItinerary
      ? `${SYSTEM_PROMPT}\n\nModifica solo quello che chiede:\n\n${JSON.stringify(existingItinerary).substring(0, 2000)}`
      : SYSTEM_PROMPT;

    const body = JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 3000,
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
      res.setEncoding("utf8");
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) {
            console.error("Claude API error:", JSON.stringify(parsed.error));
            reject(new Error(parsed.error.message));
            return;
          }
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
      { slug: "weekend-low-budget", title: "Weekend Low Budget", tagline: "Due giorni, grandi ricordi", description: "Una fuga economica con street food e cultura.", durationDays: 2, budgetTier: "low", heroEmoji: "🎒", prompt: "Weekend low budget in una bella citta europea. Due giorni, massimo 200 euro." },
      { slug: "summer-escape", title: "Estate al Mare", tagline: "Sole, mare e pomeriggi lenti", description: "Una settimana costiera con pranzi di pesce.", durationDays: 7, budgetTier: "mid", heroEmoji: "🌅", prompt: "Settimana al mare in Italia, cucina di pesce, spiagge belle, budget medio." },
      { slug: "city-break", title: "City Break", tagline: "Tre giorni di cultura e cibo", description: "Musei, quartieri storici e la migliore cena.", durationDays: 3, budgetTier: "mid", heroEmoji: "🏛️", prompt: "City break 3 giorni in una bella capitale europea. Arte, cibo e vita locale." }
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

        let payload;
        try {
          payload = JSON.parse(raw);
        } catch {
          console.error("JSON non valido:", raw.substring(0, 500));
          res.writeHead(502, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Risposta non valida. Riprova." }));
          return;
        }

        if (!payload.reply || !payload.itinerary) {
          res.writeHead(502, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Risposta incompleta. Riprova." }));
          return;
        }

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(payload));
      } catch (err) {
        console.error("Errore:", err.message);
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