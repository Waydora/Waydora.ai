const http = require("http");
const https = require("https");

// ── OpenRouter config ─────────────────────────────────────────────────────
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;

// ── Rate limiting per IP ──────────────────────────────────────────────────
const WINDOW_MS    = 60 * 60 * 1000;
const MAX_REQUESTS = 20;

// Token massimi per piano (calibrati per stare nel timeout di rete con Haiku ~150 tok/s)
const TIER_TOKENS = { guest: 8000, free: 12000, paid: 16000 };
const SONNET_MAX_TOKENS = 4000;     // hard cap per fallback Sonnet (più lento)
const FETCH_TIMEOUT_MS = 50000;     // abort prima del cut Vercel/Railway

// Modelli via OpenRouter
const M = {
  CHEAP_CHAT: "deepseek/deepseek-chat-v3.1",
  HAIKU:      "anthropic/claude-haiku-4-5",
  SONNET:     "anthropic/claude-sonnet-4-6",
};

// ── Affiliate config ──────────────────────────────────────────────────────
const AFF = {
  GYG_PARTNER_ID: "EPBPR3R",
  STAY22_URL:  "https://booking.stay22.com/waydora/5DPoKS60Cy",
  KIWI_URL:    "https://kiwi.tpm.li/HdS8gBCi",
};

function stay22For(destination) {
  if (!destination) return AFF.STAY22_URL;
  const p = new URLSearchParams({ address: destination, adults: "2" });
  return `${AFF.STAY22_URL}?${p.toString()}`;
}

function buildAffiliate(category, title, destination) {
  const q = encodeURIComponent(`${title || ""} ${destination || ""}`.trim());
  switch ((category || "").toLowerCase()) {
    case "stay":
      return { provider: "Stay22", label: "Cerca alloggi", url: stay22For(destination) };
    case "food":
      return { provider: "Google Maps", label: "Vedi su Maps", url: `https://www.google.com/maps/search/?api=1&query=${q}` };
    case "transport":
      return { provider: "Kiwi", label: "Cerca voli", url: AFF.KIWI_URL };
    case "sightseeing":
    case "experience":
    case "nightlife":
    default:
      return { provider: "GetYourGuide", label: "Prenota ora", url: `https://www.getyourguide.com/s/?q=${q}&partner_id=${AFF.GYG_PARTNER_ID}` };
  }
}

function ensureAffiliateOnItinerary(itinerary) {
  if (!itinerary || !Array.isArray(itinerary.days)) return itinerary;
  const dest = itinerary.destination || "";
  for (const day of itinerary.days) {
    if (!Array.isArray(day.activities)) continue;
    for (const a of day.activities) {
      const hasValid = a.affiliate && typeof a.affiliate.url === "string" && a.affiliate.url.startsWith("http");
      if (!hasValid) a.affiliate = buildAffiliate(a.category, a.title, dest);
      // Override sempre Stay22: l'AI tende a riprodurre l'URL hardcoded senza ?address
      else if ((a.category || "").toLowerCase() === "stay") a.affiliate = buildAffiliate("stay", a.title, dest);
    }
  }
  return itinerary;
}

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
- Se ricevi info estratte da un video TikTok, analizzale e crea un itinerario ispirato.
- Se l'utente fa domande conversazionali rispondi SOLO con reply e itinerary: null. MAX 150 parole.
- Sii amichevole e naturale.

━━━ POI E COORDINATE — OBBLIGATORI ━━━
- title: SEMPRE il nome REALE e SPECIFICO del posto.
  ✅ "Trattoria Da Enzo al 29", "Colosseo", "Teatro alla Scala", "Mercato Centrale Firenze"
  ❌ "Ristorante locale", "Museo del centro", "Caffè caratteristico"
- coordinates: lat/lng GPS REALI del posto specifico (non del centro città).
- description: 1-2 frasi vivaci, perché l'utente dovrebbe andarci. NON ripetere il nome.
- estimatedCost: realistico in euro, formato "€15" o "€20-30 a persona".

━━━ AFFILIATE — UN LINK PER OGNI ATTIVITÀ, OBBLIGATORIO ━━━
Per OGNI activity compila il campo "affiliate" usando ESATTAMENTE questi formati in base a "category":

- category "stay" → {
    "provider": "Stay22",
    "label": "Cerca alloggi",
    "url": "https://booking.stay22.com/waydora/5DPoKS60Cy"
  }
- category "food" → {
    "provider": "Google Maps",
    "label": "Vedi su Maps",
    "url": "https://www.google.com/maps/search/?api=1&query=<NOME+POSTO>+<DESTINAZIONE>"
  }
- category "transport" → {
    "provider": "Kiwi",
    "label": "Cerca voli",
    "url": "https://kiwi.tpm.li/HdS8gBCi"
  }
- category "sightseeing" | "experience" | "nightlife" → {
    "provider": "GetYourGuide",
    "label": "Prenota ora",
    "url": "https://www.getyourguide.com/s/?q=<NOME+POSTO>+<DESTINAZIONE>&partner_id=EPBPR3R"
  }

Sostituisci <NOME+POSTO> con il title (spazi → +) e <DESTINAZIONE> con la città principale. NON omettere mai il campo affiliate.`;

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

// ── Router: classifica richiesta → modello + maxTokens ───────────────────
function routeRequest({ lastUserMsg, existingItinerary, hasMedia, tier }) {
  const cap = TIER_TOKENS[tier] ?? TIER_TOKENS.guest;
  const text = (lastUserMsg || "").toString().toLowerCase().trim();
  const daysMatch = text.match(/(\d+)\s*(giorni|day|notti|notte|gg)/i);
  const days = daysMatch ? Math.min(parseInt(daysMatch[1]), 21) : 3;

  if (hasMedia) {
    return { model: M.HAIKU, maxTokens: Math.min(cap, 10000), kind: "vision", days };
  }

  const itineraryRx = /itinerar|viagg|pianifica|organizza|programm|crea.+(gior|gg)|gior(no|ni)\s|vacanz|weekend|trip|tour|visit|cosa\s+(fare|vedere)|dove\s+(andare|visitare)/i;
  const editRx = /aggiungi|togli|sposta|rimuov|sostitu|cambia|modifica|elimina|metti|aggiorna/i;
  const greetRx = /^(ciao|salve|hey|ehi|grazie|prego|ok|sì|si|no|wow|bene|perfetto|fantastico|chi sei|come stai|che fai)\b/i;
  const hasItineraryIntent = itineraryRx.test(text);

  if (!hasItineraryIntent && (greetRx.test(text) || text.length < 60)) {
    return { model: M.CHEAP_CHAT, maxTokens: Math.min(cap, 1200), kind: "chat-cheap", days };
  }

  // Su Railway non c'è il limite 60s di Vercel: usiamo Sonnet dove la qualità conta.

  // Modifica leggera (sposta orario, cambia un nome, togli un'attività) → Haiku
  const heavyEditRx = /aggiungi.+(gior|gg|tappa)|nuov[oi]\s+gior|rigenera|ricr|rifare|cambia\s+(destinazion|citt[aà]|posto|paese)|sposta.+(gior|tutto)/i;
  if (existingItinerary && editRx.test(text) && !heavyEditRx.test(text)) {
    const tokens = Math.min(cap, Math.max(6000, days * 1200 + 4000));
    return { model: M.HAIKU, maxTokens: tokens, kind: "edit-small", days };
  }

  // Consulto su itinerario esistente (no itinerary intent, no edit intent) → Haiku
  if (existingItinerary && !hasItineraryIntent && !editRx.test(text)) {
    return { model: M.HAIKU, maxTokens: Math.min(cap, 3000), kind: "consult", days };
  }

  // Modifica pesante (aggiungi giorno, rigenera, cambia destinazione) → Sonnet
  if (existingItinerary) {
    const tokens = Math.min(cap, Math.max(10000, days * 2000 + 5000));
    return { model: M.SONNET, maxTokens: tokens, kind: "edit-large", days };
  }

  // Creazione nuovo itinerario → SEMPRE Sonnet (qualità POI/coords/affiliate)
  const tokens = Math.min(cap, Math.max(10000, days * 2200 + 5000));
  const kind = days <= 3 ? "create-small" : "create-large";
  return { model: M.SONNET, maxTokens: tokens, kind, days };
}

function buildORMessages(messages, mediaContent) {
  const out = (messages ?? []).map(m => ({ role: m.role, content: m.content }));
  if (mediaContent && out.length > 0) {
    const last = out[out.length - 1];
    const t = typeof last.content === "string" ? last.content : "";
    const dataUrl = `data:${mediaContent.mediaType};base64,${mediaContent.data}`;
    out[out.length - 1] = {
      role: "user",
      content: [
        { type: "text", text: t || "Analizza questa immagine e suggerisci un itinerario." },
        { type: "image_url", image_url: { url: dataUrl } },
      ],
    };
  }
  return out;
}

async function callOpenRouter({ model, system, messages, maxTokens }) {
  if (!OPENROUTER_KEY) throw new Error("OPENROUTER_API_KEY non configurata");
  const body = {
    model,
    max_tokens: maxTokens,
    temperature: 0.7,
    messages: [{ role: "system", content: system }, ...messages],
  };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  let resp;
  try {
    resp = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://www.waydora.com",
        "X-Title": "Waydora Travel Planner",
      },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
  } catch (e) {
    if (e.name === "AbortError") throw new Error(`OpenRouter timeout >${FETCH_TIMEOUT_MS}ms su ${model}`);
    throw e;
  } finally {
    clearTimeout(timer);
  }
  if (!resp.ok) {
    const errText = await resp.text().catch(() => "");
    throw new Error(`OpenRouter ${resp.status}: ${errText.substring(0, 200)}`);
  }
  const data = await resp.json();
  let text = data.choices?.[0]?.message?.content || "";
  text = text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
  const finish = data.choices?.[0]?.finish_reason || "stop";
  return { text, stopReason: finish === "length" ? "max_tokens" : "end_turn", usage: data.usage || {} };
}

// Wrapper compat: gestisce routing + fallback automatico su Sonnet
async function callAI(messages, existingItinerary, mediaContent, userTier = "guest") {
  const systemPrompt = existingItinerary
    ? `${SYSTEM_PROMPT}\n\nItinerario attuale (modifica SOLO se esplicitamente richiesto):\n${JSON.stringify(existingItinerary).substring(0, 3000)}`
    : SYSTEM_PROMPT;

  const lastMsg = messages[messages.length - 1]?.content || "";
  const lastText = typeof lastMsg === "string" ? lastMsg : (Array.isArray(lastMsg) ? (lastMsg.find(c => c.type === "text")?.text || "") : "");
  const route = routeRequest({ lastUserMsg: lastText, existingItinerary, hasMedia: !!mediaContent, tier: userTier });
  const orMessages = buildORMessages(messages, mediaContent);

  console.log(`[callAI] kind=${route.kind} model=${route.model} days=${route.days} maxTokens=${route.maxTokens}`);

  try {
    const result = await callOpenRouter({ model: route.model, system: systemPrompt, messages: orMessages, maxTokens: route.maxTokens });
    console.log(`[callAI] OK in=${result.usage.prompt_tokens || "?"} out=${result.usage.completion_tokens || "?"} stop=${result.stopReason}`);
    return { ...result, model: route.model };
  } catch (e) {
    console.error(`[callAI] primo tentativo fallito (${route.model}):`, e.message);
    if (route.model === M.SONNET) throw e;
    console.log(`[callAI] fallback → ${M.SONNET}`);
    const result = await callOpenRouter({
      model: M.SONNET,
      system: systemPrompt,
      messages: orMessages,
      maxTokens: SONNET_MAX_TOKENS,
    });
    return { ...result, model: M.SONNET, fallback: true };
  }
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
      new Promise(res => setTimeout(res, 5000)),
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
      openrouterKey: !!process.env.OPENROUTER_API_KEY,
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
        console.log(`[chat] msgs=${messages?.length}, tier=${userTier}, hasItinerary=${!!existingItinerary}`);
        const enrichedMessages = await enrichWithTikTok(messages);
        let aiResult = await callAI(enrichedMessages, existingItinerary, mediaContent, userTier);
        let raw = aiResult.text;
        let stopReason = aiResult.stopReason;

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

        let payload = extractJsonPayload(raw);

        // Fallback su JSON invalido: retry con Sonnet se non già usato
        if ((!payload || !payload.reply) && aiResult.model !== M.SONNET) {
          console.warn(`[chat] JSON invalido da ${aiResult.model}, retry con Sonnet`);
          try {
            const systemPrompt = existingItinerary
              ? `${SYSTEM_PROMPT}\n\nItinerario attuale (modifica SOLO se esplicitamente richiesto):\n${JSON.stringify(existingItinerary).substring(0, 3000)}`
              : SYSTEM_PROMPT;
            const retry = await callOpenRouter({
              model: M.SONNET,
              system: systemPrompt,
              messages: buildORMessages(enrichedMessages, mediaContent),
              maxTokens: SONNET_MAX_TOKENS,
            });
            raw = retry.text;
            stopReason = retry.stopReason;
            payload = extractJsonPayload(raw);
          } catch (e) {
            console.error("[chat] retry Sonnet fallito:", e.message);
          }
        }

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
          // Safety-net: garantisce affiliate su OGNI activity anche se Sonnet dimentica
          ensureAffiliateOnItinerary(payload.itinerary);
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