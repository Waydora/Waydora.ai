const http = require("http");
const https = require("https");

const SYSTEM_PROMPT = `Sei Waydora, assistente di viaggio italiano. Rispondi SOLO con JSON valido, nessun testo fuori:

{"reply":"2 frasi calde in italiano","itinerary":{"title":"max 5 parole","destination":"città","durationDays":2,"vibe":"mood viaggio","totalBudget":"€400 totali","bestSeason":"Aprile-Ottobre","heroEmoji":"🏖","days":[{"day":1,"title":"titolo giornata","summary":"frase","weather":"Soleggiato 22C","activities":[{"time":"09:00","title":"Nome Luogo","description":"frase vivida","category":"food","estimatedCost":"€10","coordinates":{"lat":40.85,"lng":14.27},"photoQuery":"napoli pizza","affiliate":{"provider":"Booking","label":"Prenota","url":"https://www.booking.com/searchresults.html?ss=napoli"}}]}],"packingList":[{"category":"Essenziali","items":["Passaporto"]}]}}

Regole: coordinate reali, affiliate per ogni soggiorno, 4-5 attività/giorno, tutto in italiano.`;

function callClaude(messages, existingItinerary) {
  return new Promise((resolve, reject) => {
    const systemPrompt = existingItinerary
      ? `${SYSTEM_PROMPT}\n\nModifica SOLO quello che chiede:\n\n${JSON.stringify(existingItinerary)}`
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
          const text = parsed.content?.[0]?.text || "";
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
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.method === "POST" && req.url === "/api/chat") {
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
        res.end(JSON.stringify({ error: "Qualcosa è andato storto. Riprova." }));
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