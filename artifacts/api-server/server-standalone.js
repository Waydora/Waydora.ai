const http = require("http");
const https = require("https");

// ── Rate limiting per IP ──────────────────────────────────────────────────
const WINDOW_MS    = 60 * 60 * 1000;
const MAX_REQUESTS = 20;

// Token massimi per piano (il frontend invia userTier: "guest"|"free"|"paid")
const TIER_TOKENS = { guest: 5000, free: 8000, paid: 12000 };

const ipRequests = new Map(); // { ip: { count, resetAt, tokensUsed } }

// Pulizia periodica della mappa (ogni ora)
setInterval(() => {
  const now = Date.now();
  for (const [ip, data] of ipRequests.entries()) {
    if (now > data.resetAt) ipRequests.delete(ip);
  }
}, WINDOW_MS);

function checkRateLimit(ip) {
  const now = Date.now();
  const data = ipRequests.get(ip);

  if (!data || now > data.resetAt) {
    // Prima richiesta o finestra scaduta — resetta
    ipRequests.set(ip, { count: 1, resetAt: now + WINDOW_MS, tokensUsed: 0 });
    return { allowed: true, remaining: MAX_REQUESTS - 1 };
  }

  if (data.count >= MAX_REQUESTS) {
    const waitMin = Math.ceil((data.resetAt - now) / 60000);
    return { allowed: false, waitMin };
  }

  data.count++;
  return { allowed: true, remaining: MAX_REQUESTS - data.count };
}

function getClientIP(req) {
  // Railway può passare l'IP reale nell'header X-Forwarded-For
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.socket.remoteAddress || "unknown";
}

// ── System prompt ─────────────────────────────────────────────────────────
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
    "destination": "nome inglese internazionale, Paese (es. Milan, Italy)",
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
            "description": "descrizione vivace senza indirizzo",
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

━━━ HOTEL E ALLOGGI — chiedi SEMPRE prima ━━━
Se l'utente chiede dove dormire, hotel, b&b, airbnb o sistemazioni:
1. NON aggiungere alloggi nell'itinerario automaticamente.
2. CHIEDI SEMPRE con una domanda amichevole:
   "Per trovare l'alloggio perfetto, dimmi: che tipo preferisci? (hotel, B&B, Airbnb, hostel, resort) E la fascia di prezzo per notte? (budget <€60, medio €60–130, comfort €130–220, lusso >€220)"
3. Solo dopo aver ricevuto tipo + budget, rispondi in MODALITÀ TESTO con 3–4 opzioni specifiche e link affiliati Booking.com/Airbnb per quella destinazione.
   Formato link Booking: https://www.booking.com/searchresults.it.html?ss=DESTINAZIONE&checkin=DATA&checkout=DATA
   Formato link Airbnb: https://www.airbnb.it/s/DESTINAZIONE/homes

━━━ VOLI — chiedi SEMPRE prima ━━━
Se l'utente chiede voli, come arrivare, biglietti aerei:
1. CHIEDI SEMPRE:
   "Per trovare i voli migliori, ho bisogno di sapere: da quale città (o aeroporto) parti? Le date esatte o il periodo preferito? Quante persone volano?"
2. Solo dopo aver ricevuto queste info, rispondi in MODALITÀ TESTO con link Skyscanner:
   Formato: https://www.skyscanner.it/trasporti/voli/IATA_PARTENZA/IATA_ARRIVO/DATA_ANDATA/DATA_RITORNO/?adults=N

REGOLE GENERALI:
- Genera TUTTI i giorni richiesti in una sola risposta.
- 3-4 attività per giorno. Orari come fasce: "09:00-11:00", "Pranzo 12:30-14:00".
- NON includere indirizzi nelle descrizioni attività.
- destination: usa SEMPRE il nome inglese internazionale seguito dal paese (es. "Milan, Italy", "Prague, Czech Republic", "Paris, France"). Mai il nome italiano.
- tripPhotos: 3-4 query Unsplash per il viaggio intero.
- Per luoghi piccoli o poco conosciuti usa coordinate precise e il nome esatto del posto.
- Se ricevi info estratte da un video TikTok, analizzale e crea un itinerario ispirato.
- Se l'utente fa domande conversazionali rispondi SOLO con reply e itinerary: null. MAX 150 parole.
- Sii amichevole e naturale.`;

// ── TikTok Scraper ────────────────────────────────────────────────────────
function fetchTikTokData(videoUrl) {
  return new Promise((resolve) => {
    const apiKey = process.env.RAPIDAPI_KEY;
    if (!apiKey) { resolve(null); return; }

    const options = {
      hostname: "tiktok-scraper7.p.rapidapi.com",
      path: `/?url=${encodeURIComponent(videoUrl)}&hd=1`,
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "x-rapidapi-host": "tiktok-scraper7.p.rapidapi.com",
        "x-rapidapi-key": apiKey,
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.setEncoding("utf8");
      res.on("data", c => { data += c; });
      res.on("end", () => {
        try { resolve(JSON.parse(data)); } catch { resolve(null); }
      });
    });
    req.on("error", () => resolve(null));
    req.setTimeout(8000, () => { req.destroy(); resolve(null); });
    req.end();
  });
}

async function enrichWithTikTok(messages) {
  const lastMsg = messages[messages.length - 1];
  const text = typeof lastMsg?.content === "string" ? lastMsg.content : "";
  const tiktokRegex = /https?:\/\/(www\.|vm\.)?tiktok\.com\/[^\s]*/gi;
  const matches = text.match(tiktokRegex);
  if (!matches || matches.length === 0) return messages;

  const tiktokData = await fetchTikTokData(matches[0]);
  if (!tiktokData) return messages;

  const videoData = tiktokData?.data || tiktokData;
  const title     = videoData?.title || videoData?.desc || "";
  const authorName = videoData?.author?.nickname || "";
  const hashtags  = (videoData?.text_extra || []).filter(t => t.hashtag_name).map(t => `#${t.hashtag_name}`).join(" ");

  const context = `\n\n[VIDEO TIKTOK]\nAutore: @${authorName}\nDescrizione: ${title}\nHashtag: ${hashtags}\n\nCrea un itinerario ispirato a questo video.`;
  const userText = text.replace(tiktokRegex, "").trim();
  const enriched = [...messages];
  enriched[enriched.length - 1] = { ...lastMsg, content: (userText ? userText + context : context) };
  return enriched;
}

// ── Claude API ────────────────────────────────────────────────────────────
function callClaude(messages, existingItinerary, mediaContent, userTier = "guest") {
  return new Promise((resolve, reject) => {
    const systemPrompt = existingItinerary
      ? `${SYSTEM_PROMPT}\n\nItinerario attuale (modifica SOLO se esplicitamente richiesto):\n${JSON.stringify(existingItinerary).substring(0, 3000)}`
      : SYSTEM_PROMPT;

    const lastMsg  = messages[messages.length - 1]?.content || "";
    const textContent = typeof lastMsg === "string" ? lastMsg : "";
    const daysMatch = textContent.match(/(\d+)\s*(giorni|day|notti|notte)/i);
    const days = daysMatch ? parseInt(daysMatch[1]) : 3;
    const tierLimit = TIER_TOKENS[userTier] ?? TIER_TOKENS.guest;
    const maxTokens = Math.min(tierLimit, Math.max(2000, days * 800 + 2000));

    let claudeMessages = [...messages];
    if (mediaContent && claudeMessages.length > 0) {
      const last = claudeMessages[claudeMessages.length - 1];
      const t = typeof last.content === "string" ? last.content : "";
      claudeMessages[claudeMessages.length - 1] = {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaContent.mediaType, data: mediaContent.data } },
          { type: "text", text: t || "Analizza questa immagine e suggerisci un itinerario." },
        ],
      };
    }

    const body = JSON.stringify({
      model: "claude-sonnet-4-6",
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
      res.on("data", c => { data += c; });
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) { reject(new Error(parsed.error.message)); return; }
          let text = parsed.content?.[0]?.text || "";
          text = text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
          const stopReason = parsed.stop_reason || "end_turn";
          if (stopReason === "max_tokens") {
            console.warn(`[callClaude] Risposta troncata a max_tokens=${maxTokens}. Testo raw (primi 200 car.):`, text.substring(0, 200));
          }
          resolve({ text, stopReason });
        } catch (e) { reject(e); }
      });
    });
    req.on("error", reject);
    req.setTimeout(55000, () => { req.destroy(); reject(new Error("Claude API timeout")); });
    req.write(body);
    req.end();
  });
}

// ── Google Places ─────────────────────────────────────────────────────────

// Geocodifica la destinazione per ottenere coordinate da usare come bias
function geocodeDestination(destination, apiKey) {
  return new Promise((resolve) => {
    const q = encodeURIComponent(destination);
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${q}&key=${apiKey}`;
    const req = https.get(url, (r) => {
      let d = "";
      r.on("data", c => { d += c; });
      r.on("end", () => {
        try { resolve(JSON.parse(d).results?.[0]?.geometry?.location ?? null); }
        catch { resolve(null); }
      });
    });
    req.on("error", () => resolve(null));
    req.setTimeout(5000, () => { req.destroy(); resolve(null); });
  });
}

function enrichWithGooglePlaces(itinerary) {
  return new Promise(async (resolve) => {
    const apiKey = process.env.GOOGLE_MAPS_KEY;
    if (!apiKey) { resolve(itinerary); return; }

    const destCoords = await geocodeDestination(itinerary.destination, apiKey);
    const locParam = destCoords
      ? `&location=${destCoords.lat},${destCoords.lng}&radius=50000`
      : "";

    const activities = (itinerary.days ?? []).flatMap(d => d.activities ?? []);

    const enrichOne = (activity) => new Promise((res) => {
      try {
        const q = encodeURIComponent(activity.title);
        const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${q}${locParam}&key=${apiKey}`;
        const req = https.get(url, (r) => {
          let d = "";
          r.on("data", c => { d += c; });
          r.on("end", () => {
            try {
              const data = JSON.parse(d);
              if (data.results?.[0]) {
                const place = data.results[0];
                if (place.geometry?.location) activity.coordinates = { lat: place.geometry.location.lat, lng: place.geometry.location.lng };
                if (place.name) activity.title = place.name;
              }
            } catch {}
            res();
          });
        });
        req.on("error", () => res());
        req.setTimeout(5000, () => { req.destroy(); res(); });
      } catch { res(); }
    });

    // Tutte le attività in parallelo, con timeout globale di 12 secondi
    await Promise.race([
      Promise.allSettled(activities.map(enrichOne)),
      new Promise(res => setTimeout(res, 12000)),
    ]);

    resolve(itinerary);
  });
}

// ── HTTP Server ───────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.writeHead(200); res.end(); return; }

  // ── Health check ─────────────────────────────────────────────────────
  if (req.url === "/api/health" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      status: "ok",
      anthropicKey: !!process.env.ANTHROPIC_API_KEY,
      googleMapsKey: !!process.env.GOOGLE_MAPS_KEY,
    }));
    return;
  }

  // ── Suggestions ──────────────────────────────────────────────────────
  if (req.url === "/api/suggestions" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify([
      { slug: "weekend-low-budget", title: "Weekend Low Budget", tagline: "Due giorni, grandi ricordi", durationDays: 2, budgetTier: "low", heroEmoji: "🎒", prompt: "Voglio un weekend low budget in una bella città europea. Due giorni, massimo 200 euro totali." },
      { slug: "summer-escape", title: "Estate al Mare", tagline: "Sole, mare e pomeriggi lenti", durationDays: 7, budgetTier: "mid", heroEmoji: "🌅", prompt: "Settimana al mare in Italia, cucina di pesce, spiagge belle, budget medio. Fammi tutti e 7 i giorni." },
      { slug: "city-break", title: "City Break", tagline: "Tre giorni di cultura e cibo", durationDays: 3, budgetTier: "mid", heroEmoji: "🏛️", prompt: "City break 3 giorni in una bella capitale europea. Arte, cibo e vita locale. Tutti e 3 i giorni." },
    ]));
    return;
  }

  if (req.url === "/api/stats" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ tripsPlanned: 12847 }));
    return;
  }

  if (req.url === "/api/templates" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify([]));
    return;
  }

  // ── Chat con rate limiting ────────────────────────────────────────────
  if (req.url === "/api/chat" && req.method === "POST") {
    const clientIP = getClientIP(req);
    const rateCheck = checkRateLimit(clientIP);

    if (!rateCheck.allowed) {
      res.writeHead(429, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        error: `Hai raggiunto il limite di ${MAX_REQUESTS} richieste per ora. Riprova tra ${rateCheck.waitMin} minuti.`,
        retryAfter: rateCheck.waitMin,
      }));
      return;
    }

    let body = "";
    req.on("data", c => { body += c; });
    req.on("end", async () => {
      try {
        const { messages, existingItinerary, mediaContent, userTier } = JSON.parse(body);
        const enrichedMessages = await enrichWithTikTok(messages);
        const { text: raw, stopReason } = await callClaude(enrichedMessages, existingItinerary, mediaContent, userTier);

        // Estrae il JSON in modo robusto: trova il blocco {...} più esterno
        function extractJsonPayload(str) {
          try { return JSON.parse(str); } catch {}
          const start = str.indexOf("{");
          if (start === -1) return null;
          let depth = 0, inStr = false, esc = false;
          for (let i = start; i < str.length; i++) {
            const c = str[i];
            if (esc) { esc = false; continue; }
            if (c === "\\" && inStr) { esc = true; continue; }
            if (c === '"') { inStr = !inStr; continue; }
            if (inStr) continue;
            if (c === "{") depth++;
            if (c === "}") { depth--; if (depth === 0) { try { return JSON.parse(str.substring(start, i + 1)); } catch {} break; } }
          }
          // Ultimo tentativo: estrai solo il campo reply
          const m = str.match(/"reply"\s*:\s*"((?:[^"\\]|\\.)*)"/);
          return m ? { reply: m[1], itinerary: null } : null;
        }

        const payload = extractJsonPayload(raw);
        if (!payload) {
          console.error("[chat] JSON non estraibile. stopReason:", stopReason, "raw:", raw.substring(0, 300));
          if (stopReason === "max_tokens") {
            res.writeHead(502, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Itinerario troppo lungo: prova con meno giorni o sii più specifico." }));
          } else {
            res.writeHead(502, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Risposta non valida. Riprova." }));
          }
          return;
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

        // Aggiunge header con richieste rimanenti
        res.writeHead(200, {
          "Content-Type": "application/json",
          "X-RateLimit-Remaining": rateCheck.remaining,
        });
        res.end(JSON.stringify(payload));

      } catch (err) {
        console.error("Chat err:", err.message);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Qualcosa è andato storto. Riprova." }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: "Not found" }));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Waydora API running on port ${PORT} | Rate limit: ${MAX_REQUESTS} req/h per IP`));