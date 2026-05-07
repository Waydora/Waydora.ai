const http = require("http");
const https = require("https");

const SYSTEM_PROMPT = `Sei Waydora, assistente di viaggio italiano. Rispondi SOLO con JSON valido, nessun testo fuori:

{"reply":"2 frasi calde in italiano","itinerary":{"title":"max 5 parole","destination":"città","durationDays":2,"vibe":"mood viaggio","totalBudget":"€400 totali","bestSeason":"Aprile-Ottobre","heroEmoji":"🏖","days":[{"day":1,"title":"titolo giornata","summary":"frase","weather":"Soleggiato 22C","activities":[{"time":"09:00","title":"Nome Luogo","description":"frase breve","category":"food","estimatedCost":"€10","coordinates":{"lat":40.85,"lng":14.27},"photoQuery":"napoli pizza","affiliate":{"provider":"Booking","label":"Prenota","url":"https://www.booking.com/searchresults.html?ss=napoli"}}]}],"packingList":[{"category":"Essenziali","items":["Passaporto"]}]}}

Regole:
- Coordinate reali
- Affiliate reali e funzionanti
- 3-4 attività massimo per giorno
- Tutto in italiano
- JSON SEMPRE valido
- Nessun markdown
- Nessun testo fuori dal JSON`;

function safeJsonParse(raw) {
  try {
    return JSON.parse(raw);
  } catch (err) {
    console.error("JSON NON VALIDO:");
    console.error(raw);

    try {
      const fixed = raw
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/```\s*$/i, "")
        .replace(/,\s*}/g, "}")
        .replace(/,\s*]/g, "]")
        .trim();

      return JSON.parse(fixed);
    } catch {
      return null;
    }
  }
}

function callClaude(messages, existingItinerary) {
  return new Promise((resolve, reject) => {
    const systemPrompt = existingItinerary
      ? `${SYSTEM_PROMPT}\n\nModifica SOLO quello che chiede:\n\n${JSON.stringify(existingItinerary)}`
      : SYSTEM_PROMPT;

    const body = JSON.stringify({
      model: "claude-3-5-haiku-latest",
      max_tokens: 2500,
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

      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);

          if (parsed.error) {
            reject(parsed.error);
            return;
          }

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

function callOpenAI(messages, existingItinerary) {
  return new Promise((resolve, reject) => {
    const systemPrompt = existingItinerary
      ? `${SYSTEM_PROMPT}\n\nModifica SOLO quello che chiede:\n\n${JSON.stringify(existingItinerary)}`
      : SYSTEM_PROMPT;

    const body = JSON.stringify({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        ...messages,
      ],
      max_tokens: 2500,
    });

    const options = {
      hostname: "api.openai.com",
      path: "/v1/chat/completions",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Length": Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      res.setEncoding("utf8");

      let data = "";

      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);

          if (parsed.error) {
            reject(parsed.error);
            return;
          }

          const text =
            parsed.choices?.[0]?.message?.content || "";

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

    req.on("data", (chunk) => {
      body += chunk;
    });

    req.on("end", async () => {
      try {
        const { messages, existingItinerary } = JSON.parse(body);

        let raw;

        try {
          raw = await callClaude(messages, existingItinerary);
          console.log("Claude OK");
        } catch (err) {
          console.error("Claude fallito, uso OpenAI...");
          raw = await callOpenAI(messages, existingItinerary);
          console.log("OpenAI OK");
        }

        const payload = safeJsonParse(raw);

        if (!payload || !payload.reply || !payload.itinerary) {
          res.writeHead(502, {
            "Content-Type": "application/json",
          });

          res.end(
            JSON.stringify({
              error: "Risposta AI non valida. Riprova.",
            })
          );

          return;
        }

        res.writeHead(200, {
          "Content-Type": "application/json",
        });

        res.end(JSON.stringify(payload));

      } catch (err) {
        console.error(err);

        res.writeHead(500, {
          "Content-Type": "application/json",
        });

        res.end(
          JSON.stringify({
            error: "Qualcosa è andato storto. Riprova.",
          })
        );
      }
    });

    return;
  }

  res.writeHead(404, {
    "Content-Type": "application/json",
  });

  res.end(JSON.stringify({ error: "Not found" }));
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Waydora API running on port ${PORT}`);
});