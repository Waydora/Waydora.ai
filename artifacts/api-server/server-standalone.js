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

// Heuristica per dedurre transportMode quando l'AI non lo specifica.
// Match su title + description: traghetto/treno/bus/taxi → no voli.
function inferTransportMode(activity) {
  const explicit = (activity?.transportMode || "").toLowerCase().trim();
  if (["flight", "train", "ferry", "bus", "taxi", "car"].includes(explicit)) return explicit;
  const text = `${activity?.title || ""} ${activity?.description || ""}`.toLowerCase();
  if (/\b(traghett|ferry|trajekt|luka|porto|catamarano|aliscaf)/.test(text)) return "ferry";
  if (/\b(treno|train|frecci|italo|trenitalia|intercity|tgv|ave|ice|stazione)/.test(text)) return "train";
  if (/\b(autobus|pullman|flixbus|bus\b)/.test(text)) return "bus";
  if (/\b(taxi|uber|bolt|free now|cab)/.test(text)) return "taxi";
  if (/\b(volo|voli|aereo|flight|aeroport)/.test(text)) return "flight";
  return "flight"; // default storico
}

function buildTransportAffiliate(activity, destination) {
  const mode = inferTransportMode(activity);
  const q = encodeURIComponent(`${activity?.title || ""} ${destination || ""}`.trim());
  switch (mode) {
    case "ferry":
      return { provider: "Direct Ferries", label: "Cerca traghetti", url: `https://www.directferries.it/srp_pf.htm?keywords=${q}` };
    case "train":
      return { provider: "Trainline", label: "Cerca treni", url: `https://www.thetrainline.com/it/cerca/${q}` };
    case "bus":
      return { provider: "FlixBus", label: "Cerca bus", url: `https://www.flixbus.it/?q=${q}` };
    case "taxi":
      return { provider: "Google Maps", label: "Apri in Maps", url: `https://www.google.com/maps/search/?api=1&query=${q}` };
    case "car":
      return { provider: "Google Maps", label: "Indicazioni", url: `https://www.google.com/maps/dir/?api=1&destination=${q}` };
    case "flight":
    default:
      return { provider: "Kiwi", label: "Cerca voli", url: AFF.KIWI_URL };
  }
}

function buildAffiliate(activity, destination) {
  const category = (activity?.category || "").toLowerCase();
  const q = encodeURIComponent(`${activity?.title || ""} ${destination || ""}`.trim());
  switch (category) {
    case "stay":
      return { provider: "Stay22", label: "Cerca alloggi", url: stay22For(destination) };
    case "food":
      return { provider: "Google Maps", label: "Vedi su Maps", url: `https://www.google.com/maps/search/?api=1&query=${q}` };
    case "transport":
      return buildTransportAffiliate(activity, destination);
    case "sightseeing":
    case "experience":
    case "nightlife":
    default:
      return { provider: "GetYourGuide", label: "Prenota ora", url: `https://www.getyourguide.com/s/?q=${q}&partner_id=${AFF.GYG_PARTNER_ID}` };
  }
}

// Safety-net: l'AI tende a usare anni passati (2024) nelle URL di ricerca voli/hotel
// anche se gli diciamo la data corrente. Trova ogni YYYY-MM-DD < oggi negli URL della reply
// e lo sostituisce con oggi (per la prima data trovata) o oggi+7 (per la seconda).
// Funziona sia su Skyscanner (/voli/.../YYYY-MM-DD/YYYY-MM-DD/) sia Booking (?checkin=...&checkout=...).
function fixPastDatesInReply(text) {
  if (typeof text !== "string" || text.length === 0) return text;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().slice(0, 10);
  const plus7 = new Date(today); plus7.setDate(today.getDate() + 7);
  const plus7Str = plus7.toISOString().slice(0, 10);

  const URL_RX = /(https?:\/\/[^\s)]+)/g;
  const DATE_RX = /\d{4}-\d{2}-\d{2}/g;
  return text.replace(URL_RX, (url) => {
    let datesFound = 0;
    return url.replace(DATE_RX, (d) => {
      const dt = new Date(d);
      if (isNaN(dt.getTime()) || dt >= today) return d;
      datesFound++;
      return datesFound === 1 ? todayStr : plus7Str;
    });
  });
}

function ensureAffiliateOnItinerary(itinerary) {
  if (!itinerary || !Array.isArray(itinerary.days)) return itinerary;
  const dest = itinerary.destination || "";
  for (const day of itinerary.days) {
    if (!Array.isArray(day.activities)) continue;
    for (const a of day.activities) {
      const cat = (a.category || "").toLowerCase();
      const hasValid = a.affiliate && typeof a.affiliate.url === "string" && a.affiliate.url.startsWith("http");
      // Override sempre stay (Stay22 con address) e transport (label corretta per modalità)
      if (!hasValid || cat === "stay" || cat === "transport") {
        a.affiliate = buildAffiliate(a, dest);
      }
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

━━━ MODALITÀ DISCOVERY — OBBLIGATORIA PRIMA DI GENERARE UN ITINERARIO NUOVO ━━━
Prima di creare un itinerario da zero, DEVI conoscere almeno 3 di questi 4 dati:
1. **Compagnia**: con chi viaggia (solo, coppia, famiglia con bambini, amici, gruppo)
2. **Periodo**: mese o stagione (es. "fine giugno", "metà ottobre", "estate")
3. **Partenza**: città/aeroporto di partenza (serve per voli e logistica)
4. **Budget**: fascia indicativa (low <€500, mid €500-1200, comfort €1200-2500, lusso >€2500 a persona escluso volo)

Se l'utente ha già specificato 3+ di questi dati nel suo messaggio, NON chiedere nulla: passa direttamente a MODALITÀ ITINERARIO.
Se mancano 2 o più dati essenziali, rispondi in MODALITÀ TESTO con **un solo messaggio breve, conversazionale, max 2 domande insieme**, come un'amica curiosa — NON un questionario.

ESEMPI CORRETTI di discovery (naturale, breve, max 2 domande):
- Utente: "voglio andare a Lisbona" → "Lisbona è una gran bella idea! 🇵🇹 Per costruirla su misura: con chi parti e in che periodo pensavi?"
- Utente: "weekend al mare" → "Mare sì! ☀️ Da dove parti e che tipo di mare preferisci — selvaggio o organizzato con stabilimenti?"
- Utente: "3 giorni a Roma" → "Roma in 3 giorni è perfetto. 🏛 Siete in coppia, gruppo o famiglia? E che budget hai in testa più o meno?"

ESEMPI di richieste PRONTE per itinerario (NON chiedere altro, genera subito):
- "3 giorni a Tokyo low budget per 2 persone a giugno da Roma" → tutti i dati ci sono
- "settimana in Croazia per famiglia con 2 bambini, budget medio, agosto, da Milano" → tutti i dati ci sono

REGOLE DISCOVERY:
- MAX 2 domande in un singolo messaggio. MAI un elenco di 4 cose.
- Tono leggero, da amica esperta. NIENTE bullet list, NIENTE moduli.
- Riconosci i dati già dati: non chiedere il budget se ha già detto "low budget".
- Una volta ricevute le risposte mancanti → genera l'itinerario nello stesso turno (non chiedere conferma).
- Se l'utente dice esplicitamente "sorprendimi" / "scegli tu" / "non importa" → procedi con default sensati (coppia, prossimo periodo favorevole, budget mid, partenza dal contesto chat o ignora se assente).

ECCEZIONE: se esiste già un itinerario in chat (modifiche, aggiunte, consigli sul viaggio in corso) → NON entrare in discovery, gestisci come edit normale.

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
        "city": "Roma, Italy",
        "activities": [
          {
            "time": "09:00-11:00",
            "title": "Nome Posto Reale",
            "description": "descrizione vivace senza indirizzo",
            "category": "sightseeing",
            "estimatedCost": "€15",
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

━━━ CONSIGLI POSTI (ristoranti, bar, locali, attività) — REGOLE STRICT ━━━
Quando consigli ristoranti, bar, locali, musei, attività o qualsiasi POI in MODALITÀ TESTO:
1. **MAI annunciare opzioni senza elencarle nello stesso messaggio.** VIETATE frasi tipo "Eccoti qualche opzione…", "Ti do qualche consiglio…", "Ecco i link…" se poi non segue subito l'elenco completo nello STESSO messaggio. Se non puoi elencarli ora, non promettere.
2. **MAI dire "ti mando i link" / "ti do i link" / "ecco i link" come messaggio a sé**. I link DEVONO già esserci nella stessa risposta in cui consigli il posto.
3. Per OGNI posto consigliato, fornisci SEMPRE nello stesso messaggio:
   - **Nome** (in grassetto markdown)
   - 1 frase di descrizione + fascia prezzo realistica (es. "€20-25 a persona")
   - **Link Google Maps obbligatorio**: formato esatto "https://www.google.com/maps/search/?api=1&query=NOME+POSTO+CITTÀ" (sostituisci spazi con +). Es. "https://www.google.com/maps/search/?api=1&query=La+Riua+Valencia"
   - Per ristoranti, in aggiunta, link TheFork se ha senso: "https://www.thefork.it/ricerca?searchText=NOME+CITTÀ"
   - Per attività prenotabili: link GetYourGuide "https://www.getyourguide.it/s/?q=NOME+CITTÀ"
4. Formato consigliato (markdown):
   - **Nome Posto** — descrizione (€prezzo). [Mappa](URL) · [Prenota](URL)
5. Massimo 4-5 opzioni per messaggio per non sovraccaricare.

REGOLE GENERALI:
- Genera TUTTI i giorni richiesti in una sola risposta.
- 3-4 attività per giorno. Orari come fasce: "09:00-11:00", "Pranzo 12:30-14:00".
- NON includere indirizzi nelle descrizioni attività.
- destination: usa SEMPRE il nome inglese internazionale seguito dal paese (es. "Milan, Italy", "Prague, Czech Republic", "Paris, France"). Mai il nome italiano.
- tripPhotos: 3-4 query Unsplash per il viaggio intero.
- Se ricevi info estratte da un video TikTok, analizzale e crea un itinerario ispirato.
- Se l'utente fa domande conversazionali rispondi SOLO con reply e itinerary: null. MAX 150 parole.
- Sii amichevole e naturale.

━━━ LINGUA — TUTTO IN ITALIANO ━━━
OBBLIGATORIO: TUTTI i campi user-visible DEVONO essere in italiano:
- title (viaggio e giorno): IN ITALIANO. Es "3 giorni a Tokyo tra neon e ramen", "Giorno 1 — Asakusa e Ueno". MAI in inglese.
- summary: IN ITALIANO. Es "Inizia la giornata tra templi storici e mercatini di street food".
- description attività: IN ITALIANO. Es "Una pizzeria storica con forno a legna, sempre piena di romani veri."
- vibe, bestSeason: IN ITALIANO.
- packingList categorie e items: IN ITALIANO ("Essenziali", "Abbigliamento", "Passaporto", "Crema solare SPF 50").
- reply: IN ITALIANO.
ECCEZIONI: il nome proprio di un POI può restare nella lingua locale ("Senso-ji Temple", "Tsukiji Outer Market", "Eiffel Tower"). Il campo "destination" resta in inglese internazionale per compatibilità geocoding. Tutto il resto in italiano.

━━━ CATEGORY enum (NON tradurre, sono codici) ━━━
Valori ammessi per "category": stay, food, experience, transport, sightseeing, nightlife, shopping, culture, nature.

━━━ POI E CITY — OBBLIGATORI ━━━
- title: SEMPRE il nome REALE e SPECIFICO del posto.
  ✅ "Trattoria Da Enzo al 29", "Colosseo", "Teatro alla Scala", "Mercato Centrale Firenze"
  ❌ "Ristorante locale", "Museo del centro", "Caffè caratteristico"
- city (per giorno): OBBLIGATORIO. Nome inglese internazionale della città+paese in cui si svolgono le attività di QUEL giorno. Es. "Athens, Greece", "Santorini, Greece", "Rome, Italy". Se in un giorno cambi città (transfer), usa la città di DESTINAZIONE. Serve per geocoding accurato.
- NON includere coordinate (lat/lng): le aggiungiamo noi server-side via Google Places per massima precisione.
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
- category "transport" → AGGIUNGI SEMPRE il campo "transportMode" con uno tra: "flight" (aereo), "train" (treno), "ferry" (traghetto/aliscafo), "bus" (autobus/pullman/FlixBus), "taxi" (taxi/Uber/Bolt), "car" (auto/noleggio).
  Il backend genererà link e label coerenti (es. traghetto → "Cerca traghetti" Direct Ferries, treno → Trainline, bus → FlixBus, volo → Kiwi). NON forzare mai "Cerca voli" su un traghetto/treno/bus.
  Lascia l'oggetto affiliate placeholder: {
    "provider": "auto",
    "label": "auto",
    "url": "https://waydora.com"
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
// Richiede l'INTERA conversazione, non solo l'ultimo messaggio:
// in discovery flow ("vado a Lisbona" → "con chi?" → "in 2" → "che budget?" → "medio"),
// l'ultimo turno utente è cortissimo ("medio") e isolato sembrerebbe una chat banale.
// Senza guardare la storia, il router instraderebbe al modello cheap con 1200 token,
// troppo pochi per emettere l'itinerario completo che l'AI vuole generare.
function routeRequest({ messages, existingItinerary, hasMedia, tier }) {
  const cap = TIER_TOKENS[tier] ?? TIER_TOKENS.guest;
  const userMsgs = (messages || []).filter(m => m.role === "user");
  const lastMsg = userMsgs[userMsgs.length - 1]?.content || "";
  const lastText = (typeof lastMsg === "string" ? lastMsg : "").toLowerCase().trim();
  // Storia: TUTTI i messaggi utente concatenati → cattura intent emerso nei turni precedenti.
  const fullUserText = userMsgs
    .map(m => typeof m.content === "string" ? m.content : "")
    .join(" ")
    .toLowerCase();
  // days: cerca nella full history, non solo nell'ultimo messaggio.
  const daysMatch = fullUserText.match(/(\d+)\s*(giorni|day|notti|notte|gg)/i);
  const days = daysMatch ? Math.min(parseInt(daysMatch[1]), 21) : 3;

  if (hasMedia) {
    return { model: M.HAIKU, maxTokens: Math.min(cap, 10000), kind: "vision", days };
  }

  const itineraryRx = /itinerar|viagg|pianifica|organizza|programm|crea.+(gior|gg)|gior(no|ni)\s|vacanz|weekend|trip|tour|visit|cosa\s+(fare|vedere)|dove\s+(andare|visitare)|vado\s+a|andare\s+a|partir|destinazion/i;
  const editRx = /aggiungi|togli|sposta|rimuov|sostitu|cambia|modifica|elimina|metti|aggiorna/i;
  const greetRx = /^(ciao|salve|hey|ehi|grazie|prego|ok|sì|si|no|wow|bene|perfetto|fantastico|chi sei|come stai|che fai)\b/i;
  // Intent itinerario = uno qualsiasi dei turni utente passati ha menzionato viaggio/destinazione.
  // Così "Budget medio" da solo non ricade in chat-cheap se prima si era detto "vado a Lisbona".
  const hasItineraryIntent = itineraryRx.test(fullUserText);
  // Discovery in corso: ultimo assistant ha fatto domande discovery e l'utente sta rispondendo.
  const lastAssistant = (messages || []).slice().reverse().find(m => m.role === "assistant");
  const lastAssistantText = (typeof lastAssistant?.content === "string" ? lastAssistant.content : "").toLowerCase();
  const discoveryRx = /con chi|in che periodo|da dove parti|che budget|fascia di prezzo|quante persone|quando pensavi|che mese/;
  const inDiscovery = !existingItinerary && discoveryRx.test(lastAssistantText);

  // Chat-cheap fast-path SOLO se davvero conversazione banale (saluto/ack) E nessun intent viaggio mai emerso.
  if (!hasItineraryIntent && !inDiscovery && (greetRx.test(lastText) || lastText.length < 60)) {
    return { model: M.CHEAP_CHAT, maxTokens: Math.min(cap, 1200), kind: "chat-cheap", days };
  }

  // Su Railway non c'è il limite 60s di Vercel: usiamo Sonnet dove la qualità conta.

  // Modifica leggera (sposta orario, cambia un nome, togli un'attività) → Haiku
  const heavyEditRx = /aggiungi.+(gior|gg|tappa)|nuov[oi]\s+gior|rigenera|ricr|rifare|cambia\s+(destinazion|citt[aà]|posto|paese)|sposta.+(gior|tutto)/i;
  if (existingItinerary && editRx.test(lastText) && !heavyEditRx.test(lastText)) {
    const tokens = Math.min(cap, Math.max(6000, days * 1200 + 4000));
    return { model: M.HAIKU, maxTokens: tokens, kind: "edit-small", days };
  }

  // Consulto su itinerario esistente (no itinerary intent, no edit intent) → Haiku
  if (existingItinerary && !hasItineraryIntent && !editRx.test(lastText)) {
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
  // Iniettiamo la data corrente: senza, il modello hallucina date passate negli URL Skyscanner/Booking → 404.
  const today = new Date().toISOString().slice(0, 10);
  const dateHint = `\n\n━━━ DATA OGGI ━━━\nOggi è ${today}. TUTTE le date che metti in URL (Skyscanner, Booking, Airbnb, etc) DEVONO essere uguali o successive a oggi. NON usare mai date passate. Se l'utente non ha dato date esatte, usa il primo mese plausibile da oggi in avanti.`;
  const baseSystem = SYSTEM_PROMPT + dateHint;
  const systemPrompt = existingItinerary
    ? `${baseSystem}\n\nItinerario attuale (modifica SOLO se esplicitamente richiesto):\n${JSON.stringify(existingItinerary).substring(0, 3000)}`
    : baseSystem;

  const route = routeRequest({ messages, existingItinerary, hasMedia: !!mediaContent, tier: userTier });
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

// Geocodifica una città/destinazione per ottenere coordinate da usare come bias
function geocodeAddress(address, apiKey) {
  return new Promise((resolve) => {
    const q = encodeURIComponent(address);
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

// Distanza Haversine in km tra due coordinate
function distanceKm(a, b) {
  const R = 6371;
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Una singola chiamata Places Text Search; ritorna { coords, name } o null
function placesTextSearch(query, bias, apiKey) {
  return new Promise((resolve) => {
    const q = encodeURIComponent(query);
    const locParam = bias ? `&location=${bias.lat},${bias.lng}&radius=30000` : "";
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${q}${locParam}&key=${apiKey}`;
    const req = https.get(url, (r) => {
      let d = "";
      r.on("data", c => { d += c; });
      r.on("end", () => {
        try {
          const data = JSON.parse(d);
          const place = data.results?.[0];
          if (place?.geometry?.location) {
            resolve({ coords: { lat: place.geometry.location.lat, lng: place.geometry.location.lng }, name: place.name });
            return;
          }
        } catch {}
        resolve(null);
      });
    });
    req.on("error", () => resolve(null));
    req.setTimeout(5000, () => { req.destroy(); resolve(null); });
  });
}

const MAX_KM_FROM_CITY = 50; // soglia validazione: oltre questa distanza il match è considerato sbagliato

function enrichWithGooglePlaces(itinerary) {
  return new Promise(async (resolve) => {
    const apiKey = process.env.GOOGLE_MAPS_KEY;
    if (!apiKey) { resolve(itinerary); return; }

    const days = itinerary.days ?? [];
    // Raccoglie città uniche dai giorni; fallback a itinerary.destination per giorni senza city
    const cityCache = new Map();
    const ensureCityCoords = async (city) => {
      if (!city) return null;
      if (cityCache.has(city)) return cityCache.get(city);
      const coords = await geocodeAddress(city, apiKey);
      cityCache.set(city, coords);
      return coords;
    };

    // Pre-geocode di tutte le città uniche in parallelo (1 chiamata per città, non per attività)
    const uniqueCities = [...new Set(days.map(d => d.city || itinerary.destination).filter(Boolean))];
    await Promise.all(uniqueCities.map(ensureCityCoords));

    const enrichOne = async (activity, dayCity) => {
      const cityCoords = await ensureCityCoords(dayCity);
      const cityLabel = dayCity || "";

      // Tentativo 1: title + city, bias sulla città
      let result = await placesTextSearch(
        cityLabel ? `${activity.title}, ${cityLabel}` : activity.title,
        cityCoords,
        apiKey
      );

      // Tentativo 2 (se fuori raggio): solo title con bias stretto
      if (result && cityCoords && distanceKm(result.coords, cityCoords) > MAX_KM_FROM_CITY) {
        const retry = await placesTextSearch(activity.title, cityCoords, apiKey);
        if (retry && distanceKm(retry.coords, cityCoords) <= MAX_KM_FROM_CITY) {
          result = retry;
        } else {
          result = null; // entrambi i tentativi danno match lontani → scarta
        }
      }

      if (result) {
        activity.coordinates = result.coords;
        if (result.name) activity.title = result.name;
      } else if (cityCoords) {
        // Fallback: pin sul centro della città del giorno (mai un pin in posto sbagliato)
        activity.coordinates = cityCoords;
      }
    };

    const tasks = [];
    for (const day of days) {
      const dayCity = day.city || itinerary.destination;
      for (const activity of (day.activities ?? [])) {
        tasks.push(enrichOne(activity, dayCity));
      }
    }

    // Timeout globale di sicurezza
    await Promise.race([
      Promise.allSettled(tasks),
      new Promise(res => setTimeout(res, 8000)),
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

        // Safety-net date passate negli URL della reply (Skyscanner/Booking/Airbnb)
        if (typeof payload.reply === "string") {
          payload.reply = fixPastDatesInReply(payload.reply);
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