const http = require("http");
const https = require("https");

const SYSTEM_PROMPT = `Sei Waydora, assistente viaggi italiano. Rispondi SOLO con JSON valido senza markdown.

Formato risposta:
{"reply":"2 frasi in italiano","itinerary":{"title":"titolo","destination":"citta","durationDays":3,"vibe":"atmosfera","totalBudget":"€400 totali","bestSeason":"Aprile-Ottobre","heroEmoji":"🏛","days":[{"day":1,"title":"titolo","summary":"frase","weather":"Soleggiato 22C","activities":[{"time":"09:00","title":"Nome Reale Posto","description":"descrizione con indirizzo reale","category":"food","estimatedCost":"€15","coordinates":{"lat":41.90,"lng":12.49},"photoQuery":"rome colosseum","affiliate":{"provider":"Booking","label":"Prenota","url":"https://www.booking.com/searchresults.it.html?ss=Roma"}}]}],"packingList":[{"category":"Essenziali","items":["Passaporto","Scarpe comode"]}]}}

Regole: luoghi reali con indirizzi, coordinate GPS precise, 4 attivita per giorno, sempre un soggiorno con Booking o Airbnb, tutto in italiano tranne photoQuery. Max 30 giorni per risposta.`;

function callClaude(messages, existingItinerary) {
  return new Promise((resolve, reject) => {
    const systemPrompt = existingItinerary
      ? `${SYSTEM_PROMPT}\n\nModifica SOLO quello che chiede il viaggiatore, mantieni il resto:\n\n${JSON.stringify(existingItinerary)}`
      : SYSTEM_PROMPT;

    const body = JSON.stringify({
      model: "claude-haiku-3-5-latest",
      max_tokens: 2048,
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