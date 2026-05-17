const http = require("http");
const https = require("https");

const SYSTEM_PROMPT = `Sei Waydora, un'assistente di viaggio AI amichevole e conversazionale. Parli in italiano, come un'amica esperta di viaggi.

Rispondi SEMPRE e SOLO con JSON valido, zero testo fuori dal JSON.

HAI DUE MODALITÀ:

━━━ MODALITÀ TESTO (quando NON serve generare/aggiornare l'itinerario) ━━━
Usa per: saluti, consigli generici, suggerimenti ristoranti/locali, domande culturali, meteo, curiosità.
Rispondi in modo conciso e conversazionale. Max 150 parole. Usa emoji con moderazione.

{ "reply": "risposta conversazionale", "itinerary": null }

━━━ MODALITÀ ITINERARIO (solo quando chiede di creare/modificare/aggiungere giorni) ━━━

{
  "reply": "1-2 frasi amichevoli",
  "itinerary": {
    "title": "titolo viaggio",
    "destination": "città",
    "durationDays": 3,
    "vibe": "atmosfera",
    "totalBudget": "€800 a persona",
    "bestSeason": "Aprile-Ottobre",
    "heroEmoji": "🗺️",
    "tripPhotos": ["query foto 1", "query foto 2", "query foto 3"],
    "days": [
      {
        "day": 1,
        "title": "titolo giorno",
        "summary": "una frase",
        "activities": [
          {
            "time": "09:00-11:00",
            "title": "Nome Posto Reale",
            "description": "descrizione vivace senza indirizzo (va nella mappa)",
            "category": "sightseeing",
            "estimatedCost": "€15",
            "coordinates": { "lat": 41.90, "lng": 12.49 },
            "affiliate": {
              "provider": "GetYourGuide",
              "label": "Prenota ora",
              "url": "https://www.getyourguide.it/s/?q=roma"
            }
          }
        ]
      }
    ],
    "packingList": [
      { "category": "Essenziali", "items": ["Passaporto"] }
    ]
  }
}

REGOLE:
- Genera TUTTI i giorni richiesti in una sola risposta.
- 3-4 attività per giorno. Orari come fasce: "09:00-11:00", "Pranzo 12:30-14:00", "Sera 20:00-22:00".
- NON includere indirizzi nelle descrizioni attività (vanno solo nelle coordinate per la mappa).
- tripPhotos: 3-4 query Unsplash per il viaggio intero.
- Se l'utente manda un link TikTok o descrive un video di viaggio, analizza il contenuto e replica l'itinerario visto.
- Se l'utente fa domande conversazionali rispondi SOLO con reply e itinerary: null. MAX 150 parole.
- Sii amichevole e naturale.`;

// ── Estrae info da link TikTok ────────────────────────────────────────────
function extractTikTokInfo(text) {
  const tiktokRegex = /https?:\/\/(www\.|vm\.)?tiktok\.com\/[^\s]*/gi;
  const matches = text.match(tiktokRegex);
  if (matches && matches.length > 0) {
    return {
      hasTikTok: true,
      urls: matches,
      enrichedPrompt: `${text}\n\n[L'utente ha condiviso un video TikTok di viaggio: ${matches.join(", ")}. Analizza il contesto del messaggio e genera un itinerario ispirato al video. Se non riesci ad accedere al video, chiedi all'utente di descrivere cosa ha visto.]`,
    };
  }
  return { hasTikTok: false, urls: [], enrichedPrompt: text };
}

// ── Chiama Claude con supporto immagini/video ─────────────────────────────
function callClaude(messages, existingItinerary, mediaContent) {
  return new Promise((resolve, reject) => {
    const systemPrompt = existingItinerary
      ? `${SYSTEM_PROMPT}\n\nItinerario attuale (modifica SOLO se esplicitamente richiesto):\n${JSON.stringify(existingItinerary).substring(0, 3000)}`
      : SYSTEM_PROMPT;

    const lastUserMsg = messages[messages.length - 1]?.content || "";
    const daysMatch = typeof lastUserMsg === "string"
      ? lastUserMsg.match(/(\d+)\s*(giorni|day|notti|notte)/i)
      : null;
    const requestedDays = daysMatch ? parseInt(daysMatch[1]) : 3;
    const maxTokens = Math.min(10000, Math.max(2000, requestedDays * 600 + 2000));

    // Costruisce i messaggi con eventuale media allegato
    let claudeMessages = [...messages];

    // Se c'è un media (immagine/video), lo aggiunge all'ultimo messaggio
    if (mediaContent && claudeMessages.length > 0) {
      const lastMsg = claudeMessages[claudeMessages.length - 1];
      const textContent = typeof lastMsg.content === "string"
        ? lastMsg.content
        : lastMsg.content?.find(c => c.type === "text")?.text || "";

      claudeMessages[claudeMessages.length - 1] = {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mediaContent.mediaType,
              data: mediaContent.data,
            },
          },
          {
            type: "text",
            text: textContent || "Analizza questo contenuto e suggerisci un itinerario di viaggio ispirato a ciò che vedi.",
          },
        ],
      };
    }

    const body = JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: claudeMessages,
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
      res.setEncoding("utf8");
      res.on("data", (c) => { data += c; });
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) { reject(new Error(parsed.error.message)); return; }
          let text = parsed.content?.[0]?.text || "";
          text = text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
          resolve(text);
        } catch (e) { reject(e); }
      });
    });

    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

// ── Google Places ─────────────────────────────────────────────────────────
function enrichWithGooglePlaces(itinerary) {
  return new Promise(async (resolve) => {
    const apiKey = process.env.GOOGLE_MAPS_KEY;
    if (!apiKey) { resolve(itinerary); return; }

    for (const day of itinerary.days) {
      for (const activity of day.activities) {
        try {
          const q = encodeURIComponent(`${activity.title} ${itinerary.destination}`);
          const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${q}&key=${apiKey}`;
          const data = await new Promise((res, rej) => {
            https.get(url, (r) => {
              let d = "";
              r.on("data", c => { d += c; });
              r.on("end", () => { try { res(JSON.parse(d)); } catch (e) { rej(e); } });
            }).on("error", rej);
          });
          if (data.results?.[0]) {
            const place = data.results[0];
            if (place.geometry?.location) {
              activity.coordinates = { lat: place.geometry.location.lat, lng: place.geometry.location.lng };
            }
            if (place.name) activity.title = place.name;
          }
        } catch (e) { console.error("Places err:", e.message); }
      }
    }
    resolve(itinerary);
  });
}

// ── HTTP Server ───────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.writeHead(200); res.end(); return; }

  if (req.url === "/api/suggestions" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify([
      { slug: "weekend-low-budget", title: "Weekend Low Budget", tagline: "Due giorni, grandi ricordi", description: "Una fuga economica con street food e cultura.", durationDays: 2, budgetTier: "low", heroEmoji: "🎒", prompt: "Voglio un weekend low budget in una bella città europea. Due giorni, massimo 200 euro totali." },
      { slug: "summer-escape", title: "Estate al Mare", tagline: "Sole, mare e pomeriggi lenti", description: "Una settimana costiera con pranzi di pesce.", durationDays: 7, budgetTier: "mid", heroEmoji: "🌅", prompt: "Settimana al mare in Italia, cucina di pesce, spiagge belle, budget medio. Fammi tutti e 7 i giorni." },
      { slug: "city-break", title: "City Break", tagline: "Tre giorni di cultura e cibo", description: "Musei, quartieri storici e la migliore cena.", durationDays: 3, budgetTier: "mid", heroEmoji: "🏛️", prompt: "City break 3 giorni in una bella capitale europea. Arte, cibo e vita locale. Tutti e 3 i giorni." },
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
    req.on("data", c => { body += c; });
    req.on("end", async () => {
      try {
        const { messages, existingItinerary, mediaContent } = JSON.parse(body);

        // Controlla se c'è un link TikTok nell'ultimo messaggio
        const lastMsg = messages[messages.length - 1];
        const lastText = typeof lastMsg?.content === "string" ? lastMsg.content : "";
        const { enrichedPrompt } = extractTikTokInfo(lastText);

        // Sostituisce l'ultimo messaggio con quello arricchito se c'è TikTok
        let enrichedMessages = [...messages];
        if (enrichedPrompt !== lastText) {
          enrichedMessages[enrichedMessages.length - 1] = {
            ...lastMsg,
            content: enrichedPrompt,
          };
        }

        const raw = await callClaude(enrichedMessages, existingItinerary, mediaContent);

        let payload;
        try {
          payload = JSON.parse(raw);
        } catch {
          try {
            let fixed = raw;
            const opens = (fixed.match(/{/g) || []).length;
            const closes = (fixed.match(/}/g) || []).length;
            for (let i = 0; i < opens - closes; i++) fixed += "}";
            payload = JSON.parse(fixed);
          } catch {
            res.writeHead(502, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Risposta non valida. Riprova." }));
            return;
          }
        }

        if (!payload.reply) {
          res.writeHead(502, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Risposta incompleta. Riprova." }));
          return;
        }

        if (payload.itinerary) {
          try { payload.itinerary = await enrichWithGooglePlaces(payload.itinerary); }
          catch (e) { console.error("Places err:", e.message); }
        }

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(payload));
      } catch (err) {
        console.error("Chat err:", err.message);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Qualcosa è andato storto. Riprova." }));
      }
    });
    return;
  }

  const savedItineraries = [];
  if (req.url === "/api/itineraries" && req.method === "POST") {
    let body = "";
    req.on("data", c => { body += c; });
    req.on("end", () => {
      try {
        const { itinerary } = JSON.parse(body);
        const saved = {
          id: Date.now(),
          shareSlug: Math.random().toString(36).substring(2, 10),
          createdAt: new Date().toISOString(),
          itinerary,
        };
        savedItineraries.push(saved);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(saved));
      } catch {
        res.writeHead(500);
        res.end(JSON.stringify({ error: "Errore salvataggio" }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: "Not found" }));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Waydora API running on port ${PORT}`));