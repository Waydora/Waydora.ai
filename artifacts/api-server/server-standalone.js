const http = require("http");
const https = require("https");
 
// ── SYSTEM PROMPT ─────────────────────────────────────────────────────────
// Genera TUTTI i giorni richiesti in una sola risposta.
// Foto: solo 1-2 foto per il viaggio intero (non per singola attività).
const SYSTEM_PROMPT = `Sei Waydora, assistente viaggi AI. Rispondi SEMPRE e SOLO con JSON valido, zero testo fuori dal JSON.
 
Struttura esatta:
{
  "reply": "1-2 frasi italiane amichevoli",
  "itinerary": {
    "title": "titolo viaggio",
    "destination": "città",
    "durationDays": 3,
    "vibe": "atmosfera in poche parole",
    "totalBudget": "es. €800 a persona",
    "bestSeason": "es. Aprile-Ottobre",
    "heroEmoji": "🗺️",
    "tripPhotos": ["query foto 1 per unsplash", "query foto 2 per unsplash"],
    "days": [
      {
        "day": 1,
        "title": "titolo giorno",
        "summary": "una frase descrittiva",
        "weather": "es. ☀️ 24°C",
        "activities": [
          {
            "time": "09:00",
            "title": "Nome Posto Reale",
            "description": "descrizione con indirizzo reale",
            "category": "sightseeing",
            "estimatedCost": "€15",
            "coordinates": { "lat": 41.90, "lng": 12.49 },
            "affiliate": {
              "provider": "GetYourGuide",
              "label": "Prenota",
              "url": "https://www.getyourguide.it/s/?q=roma"
            }
          }
        ]
      }
    ],
    "packingList": [
      { "category": "Essenziali", "items": ["Passaporto", "Carta di credito"] }
    ]
  }
}
 
REGOLE FONDAMENTALI:
- Genera SEMPRE tutti i giorni richiesti in un'unica risposta. Se l'utente chiede 5 giorni, genera tutti e 5. MAI troncare.
- 3-4 attività per giorno (non di più, JSON deve stare nei token)
- tripPhotos: array di 2 query Unsplash per il viaggio intero, es. ["tokyo japan city skyline night", "tokyo japan temple street"]. NON includere photoUrl o photoQuery nelle singole attività.
- Coordinate REALI e precise. Luoghi REALI con nomi corretti.
- photoQuery nelle attività NON va incluso — le foto vengono prese da tripPhotos.
- Per città piccole o poco note usa coordinate precise della regione.
- La reply deve essere amichevole, come un assistente che parla con un amico.`;
 
// ── Chiama Claude API ─────────────────────────────────────────────────────
function callClaude(messages, existingItinerary) {
  return new Promise((resolve, reject) => {
    const systemPrompt = existingItinerary
      ? `${SYSTEM_PROMPT}\n\nItinerario esistente da modificare (modifica SOLO quello che viene chiesto, mantieni il resto):\n${JSON.stringify(existingItinerary).substring(0, 3000)}`
      : SYSTEM_PROMPT;
 
    // Calcola i token necessari in base ai giorni richiesti
    // ~400 token per giorno × max 14 giorni + overhead = 8000 token max
    const lastUserMsg = messages[messages.length - 1]?.content || "";
    const daysMatch = lastUserMsg.match(/(\d+)\s*(giorni|day|notti|notte)/i);
    const requestedDays = daysMatch ? parseInt(daysMatch[1]) : 3;
    const maxTokens = Math.min(8000, Math.max(3000, requestedDays * 500 + 2000));
 
    const body = JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: maxTokens,
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
          // Pulisce eventuali backtick markdown
          text = text
            .replace(/^```json\s*/i, "")
            .replace(/^```\s*/i, "")
            .replace(/```\s*$/i, "")
            .trim();
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
 
// ── Arricchisce con Google Places (coordinate + nome reale) ───────────────
// NON recupera più foto per singola attività — le foto vengono da Unsplash
// tramite tripPhotos nel frontend
function enrichWithGooglePlaces(itinerary) {
  return new Promise(async (resolve) => {
    const apiKey = process.env.GOOGLE_MAPS_KEY;
    if (!apiKey) { resolve(itinerary); return; }
 
    for (const day of itinerary.days) {
      for (const activity of day.activities) {
        try {
          const searchQuery = encodeURIComponent(`${activity.title} ${itinerary.destination}`);
          const placesUrl =
            `https://maps.googleapis.com/maps/api/place/textsearch/json` +
            `?query=${searchQuery}&key=${apiKey}`;
 
          const data = await new Promise((res, rej) => {
            https.get(placesUrl, (response) => {
              let d = "";
              response.on("data", (chunk) => { d += chunk; });
              response.on("end", () => { try { res(JSON.parse(d)); } catch (e) { rej(e); } });
            }).on("error", rej);
          });
 
          if (data.results?.[0]) {
            const place = data.results[0];
            // Coordinate reali
            if (place.geometry?.location) {
              activity.coordinates = {
                lat: place.geometry.location.lat,
                lng: place.geometry.location.lng,
              };
            }
            // Nome reale Google
            if (place.name) activity.title = place.name;
            // Indirizzo reale
            if (place.formatted_address) {
              activity.description = `${activity.description}\n📍 ${place.formatted_address}`;
            }
            // ⚠️ NON prendiamo più photoUrl da Places — le foto vengono da tripPhotos
          }
        } catch (e) {
          console.error("Errore Places:", e.message);
        }
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
 
  // ── Suggestions ──
  if (req.url === "/api/suggestions" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify([
      { slug: "weekend-low-budget", title: "Weekend Low Budget", tagline: "Due giorni, grandi ricordi", description: "Una fuga economica con street food e cultura.", durationDays: 2, budgetTier: "low", heroEmoji: "🎒", prompt: "Weekend low budget in una bella città europea. Due giorni, massimo 200 euro. Genera entrambi i giorni." },
      { slug: "summer-escape",      title: "Estate al Mare",     tagline: "Sole, mare e pomeriggi lenti", description: "Una settimana costiera con pranzi di pesce.", durationDays: 7, budgetTier: "mid", heroEmoji: "🌅", prompt: "Settimana al mare in Italia, cucina di pesce, spiagge belle, budget medio. Genera tutti e 7 i giorni." },
      { slug: "city-break",         title: "City Break",         tagline: "Tre giorni di cultura e cibo", description: "Musei, quartieri storici e la migliore cena.", durationDays: 3, budgetTier: "mid", heroEmoji: "🏛️", prompt: "City break 3 giorni in una bella capitale europea. Arte, cibo e vita locale. Genera tutti e 3 i giorni." },
    ]));
    return;
  }
 
  // ── Templates ──
  if (req.url === "/api/templates" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify([]));
    return;
  }
 
  // ── Stats ──
  if (req.url === "/api/stats" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ tripsPlanned: 12847 }));
    return;
  }
 
  // ── Chat ──
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
        } catch (parseErr) {
          // Prova a riparare JSON troncato aggiungendo le parentesi mancanti
          console.error("JSON non valido, tenta riparazione:", raw.substring(0, 200));
          try {
            // Conta parentesi aperte vs chiuse e prova a chiuderle
            let fixed = raw;
            const opens  = (fixed.match(/{/g) || []).length;
            const closes = (fixed.match(/}/g) || []).length;
            for (let i = 0; i < opens - closes; i++) fixed += "}";
            payload = JSON.parse(fixed);
          } catch {
            res.writeHead(502, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Risposta non valida. Riprova." }));
            return;
          }
        }
 
        if (!payload.reply || !payload.itinerary) {
          res.writeHead(502, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Risposta incompleta. Riprova." }));
          return;
        }
 
        // Arricchisce con Places (coordinate reali, nomi reali)
        try {
          payload.itinerary = await enrichWithGooglePlaces(payload.itinerary);
        } catch (e) {
          console.error("Errore arricchimento Places:", e.message);
        }
 
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(payload));
      } catch (err) {
        console.error("Errore chat:", err.message);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Qualcosa è andato storto. Riprova." }));
      }
    });
    return;
  }
 
  // ── Itineraries save/get ──
  const itineraries = [];
  if (req.url === "/api/itineraries" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => {
      try {
        const { itinerary } = JSON.parse(body);
        const saved = {
          id: Date.now(),
          shareSlug: Math.random().toString(36).substring(2, 10),
          createdAt: new Date().toISOString(),
          itinerary,
        };
        itineraries.push(saved);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(saved));
      } catch {
        res.writeHead(500); res.end(JSON.stringify({ error: "Errore salvataggio" }));
      }
    });
    return;
  }
 
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
});
 
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => { console.log(`Waydora API running on port ${PORT}`); });
 