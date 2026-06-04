import https from "https";

// ── Config ────────────────────────────────────────────────────────────────
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;

// Cap massimi per piano (output tokens). Calibrati per stare nei 60s di Vercel
// con Haiku (~150 tok/s). Sonnet ha cap separato più stretto (vedi SONNET_MAX_TOKENS).
const TIER_TOKENS = { guest: 8000, free: 12000, paid: 16000 };

// Hard cap per Sonnet (fallback JSON-recovery). A ~50 tok/s, 4000 token = ~80s
// che sfora Vercel Hobby (60s) ma è il massimo gestibile con qualche margine.
const SONNET_MAX_TOKENS = 4000;

// Budget di tempo totale per la chiamata a OpenRouter: 50s lascia 10s per
// Places + serializzazione prima del taglio Vercel a 60s.
const FETCH_TIMEOUT_MS = 50000;

// Modelli
const M = {
  CHEAP_CHAT:   "deepseek/deepseek-chat-v3.1",
  HAIKU:        "anthropic/claude-haiku-4-5",
  SONNET:       "anthropic/claude-sonnet-4-6",
};

// ── Affiliate config ──────────────────────────────────────────────────────
const AFF = {
  GYG_PARTNER_ID: "EPBPR3R",
  STAY22_URL:  "https://booking.stay22.com/waydora/5DPoKS60Cy",
  KIWI_URL:    "https://kiwi.tpm.li/HdS8gBCi",
  TIQETS_URL:  "https://tiqets.tpm.li/5f5kLwe7",
};

function stay22For(destination) {
  if (!destination) return AFF.STAY22_URL;
  const p = new URLSearchParams({ address: destination, adults: "2" });
  return `${AFF.STAY22_URL}?${p.toString()}`;
}

// Heuristica per dedurre transportMode quando l'AI non lo specifica.
function inferTransportMode(activity) {
  const explicit = (activity?.transportMode || "").toLowerCase().trim();
  if (["flight", "train", "ferry", "bus", "taxi", "car"].includes(explicit)) return explicit;
  const text = `${activity?.title || ""} ${activity?.description || ""}`.toLowerCase();
  if (/\b(traghett|ferry|trajekt|luka|porto|catamarano|aliscaf)/.test(text)) return "ferry";
  if (/\b(treno|train|frecci|italo|trenitalia|intercity|tgv|ave|ice|stazione)/.test(text)) return "train";
  if (/\b(autobus|pullman|flixbus|bus\b)/.test(text)) return "bus";
  if (/\b(taxi|uber|bolt|free now|cab)/.test(text)) return "taxi";
  if (/\b(volo|voli|aereo|flight|aeroport)/.test(text)) return "flight";
  return "flight";
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

// Safety-net: garantisce che ogni activity abbia un link affiliate valido
// Safety-net date passate negli URL della reply (Skyscanner/Booking/Airbnb).
// L'AI tende a usare 2024 anche se gli diciamo la data corrente.
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
      // Override sempre stay (Stay22 con address) e transport (label per modalità)
      if (!hasValid || cat === "stay" || cat === "transport") {
        a.affiliate = buildAffiliate(a, dest);
      }
    }
  }
  return itinerary;
}

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
3. **Partenza**: città/aeroporto di partenza
4. **Budget**: fascia indicativa (low <€500, mid €500-1200, comfort €1200-2500, lusso >€2500 a persona escluso volo)

Se l'utente ha già specificato 3+ di questi dati, NON chiedere nulla: passa direttamente a MODALITÀ ITINERARIO.
Se mancano 2 o più dati, rispondi in MODALITÀ TESTO con **un solo messaggio breve, max 2 domande insieme**, come un'amica curiosa — NON un questionario.

ESEMPI CORRETTI di discovery (naturale, breve, max 2 domande):
- "voglio andare a Lisbona" → "Lisbona è una gran bella idea! 🇵🇹 Per costruirla su misura: con chi parti e in che periodo pensavi?"
- "weekend al mare" → "Mare sì! ☀️ Da dove parti e che tipo di mare preferisci — selvaggio o organizzato?"
- "3 giorni a Roma" → "Roma in 3 giorni è perfetto. 🏛 Siete in coppia, gruppo o famiglia? E che budget hai in testa?"

ESEMPI PRONTI per itinerario (NON chiedere altro, genera subito):
- "3 giorni a Tokyo low budget per 2 persone a giugno da Roma" → tutti i dati ci sono

REGOLE DISCOVERY:
- MAX 2 domande in un singolo messaggio. MAI un elenco di 4 cose.
- Tono leggero, da amica esperta. NIENTE bullet list, NIENTE moduli.
- Riconosci i dati già dati: non chiedere il budget se ha già detto "low budget".
- Ricevute le risposte mancanti → genera l'itinerario nello stesso turno (non chiedere conferma).
- Se l'utente dice "sorprendimi" / "scegli tu" → procedi con default (coppia, prossimo periodo favorevole, budget mid).

ECCEZIONE: se esiste già un itinerario in chat → NON entrare in discovery, gestisci come edit normale.

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
2. CHIEDI SEMPRE: "Per trovare l'alloggio perfetto, dimmi: che tipo preferisci? (hotel, B&B, Airbnb, hostel, resort) E la fascia di prezzo per notte? (budget <€60, medio €60–130, comfort €130–220, lusso >€220)"
3. Solo dopo, rispondi in MODALITÀ TESTO con 3–4 opzioni specifiche.

━━━ VOLI — chiedi SEMPRE prima ━━━
Se l'utente chiede voli, come arrivare, biglietti aerei:
1. CHIEDI SEMPRE: da quale città parti? Le date? Quante persone?
2. Solo dopo, rispondi in MODALITÀ TESTO con link Skyscanner.

━━━ CONSIGLI E RACCOMANDAZIONI — REGOLE STRICT (vale per TUTTO: ristoranti, hotel, attività, voli, treni, traghetti, bus, biglietti) ━━━

REGOLA D'ORO: **mai promesse vuote**. Se in una reply scrivi "ecco…", "ti do…", "ti mando…", "trovi qui sotto…", "guarda…", DEVE seguire IMMEDIATAMENTE il contenuto reale (nome + link cliccabile) nello STESSO messaggio. È VIETATO terminare una reply con ":" o con una frase di apertura senza elenco.

Frasi VIETATE se non seguite dal contenuto:
- "Eccoti qualche opzione…" / "Ecco i link…" / "Ti do qualche consiglio…"
- "Ti mando il link" / "Trovi il link qui" / "Puoi prenotare su…" (se poi non c'è l'URL completo cliccabile)
- "I principali operatori sono…" / "Puoi cercare su…" (senza URL effettivo)

Per OGNI cosa che consigli o menzioni come prenotabile, includi SEMPRE nello stesso messaggio un link cliccabile in formato markdown [Testo](URL). Usa questi URL pattern (sostituisci spazi con +):

**Ristoranti / bar / locali / POI:**
- Google Maps: "https://www.google.com/maps/search/?api=1&query=NOME+POSTO+CITTÀ"
- TheFork (ristoranti): "https://www.thefork.it/ricerca?searchText=NOME+CITTÀ"

**Attività / musei / esperienze:**
- GetYourGuide: "https://www.getyourguide.it/s/?q=NOME+CITTÀ"
- Viator: "https://www.viator.com/searchResults/all?text=NOME+CITTÀ"

**Hotel / alloggi:**
- Booking: "https://www.booking.com/searchresults.it.html?ss=DESTINAZIONE"
- Airbnb: "https://www.airbnb.it/s/DESTINAZIONE/homes"

⚠️ REGOLA URL CRITICA: NON costruire MAI un URL inserendo nomi di città, stazioni o porti dentro il PATH dell'indirizzo (es. ".../da-Napoli-a-Pietrarsa-S.-Giorgio"): producono link ROTTI. Metti i nomi SOLO nei parametri di ricerca (?query=, ?ss=, ?q=, origin=, destination=) usando i formati qui sotto. Nel dubbio, Google Maps è SEMPRE la scelta sicura.

**Voli:**
- Skyscanner: "https://www.skyscanner.it/trasporti/voli/IATA_PARTENZA/IATA_ARRIVO/DATA_ANDATA/DATA_RITORNO/?adults=N" (usa SOLO codici IATA che conosci con certezza; altrimenti usa Google Flights: "https://www.google.com/travel/flights?q=voli+da+CITTÀ+a+CITTÀ")

**Treni / bus / spostamenti locali:**
- USA SEMPRE Google Maps transit (il più affidabile per qualunque tratta, anche stazioni piccole): "https://www.google.com/maps/dir/?api=1&origin=PARTENZA&destination=ARRIVO&travelmode=transit"
- (Italia, opzionale) Trenitalia: "https://www.trenitalia.com/" — homepage, l'utente cerca la tratta

**Traghetti / barche:**
- Google Maps: "https://www.google.com/maps/dir/?api=1&origin=PORTO_PARTENZA&destination=PORTO_ARRIVO&travelmode=transit"
- Direct Ferries: "https://www.directferries.it/cerca.htm?from=PORTO_PARTENZA&to=PORTO_ARRIVO"

Formato consigliato per ogni opzione:
- **Nome** — descrizione breve (prezzo indicativo). [Prenota](URL) · [Mappa](URL)

Massimo 4-5 opzioni per messaggio. Se non hai abbastanza info per costruire l'URL (es. manca la data per il volo), CHIEDI prima di promettere il link — non scrivere mai "ti do il link" senza darlo.

REGOLE GENERALI:
- Genera TUTTI i giorni richiesti in una sola risposta.
- 3-4 attività per giorno. Orari come fasce: "09:00-11:00", "Pranzo 12:30-14:00".
- NON includere indirizzi nelle descrizioni attività.
- destination: usa SEMPRE il nome inglese internazionale (es. "Milan, Italy"). Mai il nome italiano.
- tripPhotos: 3-4 query Unsplash per il viaggio intero.
- Se l'utente fa domande conversazionali rispondi SOLO con reply e itinerary: null. MAX 150 parole.
- Sii amichevole e naturale.

━━━ LINGUA — TUTTO IN ITALIANO ━━━
OBBLIGATORIO: title, summary, description, vibe, bestSeason, packingList, reply — TUTTI in italiano. Il nome proprio del POI può restare in lingua locale; "destination" resta in inglese.
category enum (non tradurre): stay, food, experience, transport, sightseeing, nightlife, shopping, culture, nature.

━━━ POI E CITY — OBBLIGATORI ━━━
- title: usa SEMPRE il nome REALE e SPECIFICO del posto.
  ✅ "Trattoria Da Enzo al 29", "Colosseo", "Teatro alla Scala", "Mercato Centrale Firenze"
  ❌ "Ristorante locale", "Museo del centro", "Caffè caratteristico"
- city (per giorno): OBBLIGATORIO. Nome inglese internazionale della città+paese in cui si svolgono le attività di QUEL giorno. Es. "Athens, Greece", "Santorini, Greece", "Rome, Italy". Se in un giorno cambi città (transfer), usa la città di DESTINAZIONE. Serve per geocoding accurato.
- NON includere coordinate (lat/lng): le aggiungiamo noi server-side via Google Places per massima precisione.
- description: 1-2 frasi vivaci, perché l'utente dovrebbe andarci (NON ripetere il nome).
- estimatedCost: realistico in euro, formato "€15" o "€20-30 a persona".

━━━ AFFILIATE — UN LINK PER OGNI ATTIVITÀ, OBBLIGATORIO ━━━
Per OGNI activity compila il campo "affiliate" usando ESATTAMENTE questi formati in base alla "category":

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
  Il backend sceglierà link e label coerenti (es. traghetto → Direct Ferries "Cerca traghetti", treno → Trainline, bus → FlixBus, volo → Kiwi). NON forzare mai "Cerca voli" su un traghetto/treno/bus.
  Lascia placeholder: {
    "provider": "auto",
    "label": "auto",
    "url": "https://waydora.com"
  }
- category "sightseeing" | "experience" | "nightlife" → {
    "provider": "GetYourGuide",
    "label": "Prenota ora",
    "url": "https://www.getyourguide.com/s/?q=<NOME+POSTO>+<DESTINAZIONE>&partner_id=EPBPR3R"
  }

Sostituisci <NOME+POSTO> con il title dell'activity (spazi → +) e <DESTINAZIONE> con la città principale. NON omettere mai il campo affiliate.`;

// ── Router: classifica la richiesta e sceglie modello + maxTokens ─────────
// Richiede l'INTERA conversazione, non solo l'ultimo messaggio: in discovery flow
// l'ultimo turno utente può essere cortissimo ("Budget medio") e isolato sembrerebbe
// chat banale → cheap chat 1200 tok → itinerario non generabile.
function routeRequest({ messages, existingItinerary, hasMedia, tier }) {
  const cap = TIER_TOKENS[tier] ?? TIER_TOKENS.guest;
  const userMsgs = (messages || []).filter(m => m.role === "user");
  const lastMsg = userMsgs[userMsgs.length - 1]?.content || "";
  const lastText = (typeof lastMsg === "string" ? lastMsg : "").toLowerCase().trim();
  const fullUserText = userMsgs
    .map(m => typeof m.content === "string" ? m.content : "")
    .join(" ")
    .toLowerCase();

  const daysMatch = fullUserText.match(/(\d+)\s*(giorni|day|notti|notte|gg)/i);
  const days = daysMatch ? Math.min(parseInt(daysMatch[1]), 21) : 3;

  if (hasMedia) {
    return { model: M.HAIKU, maxTokens: Math.min(cap, 10000), kind: "vision", days };
  }

  const itineraryRx = /itinerar|viagg|pianifica|organizza|programm|crea.+(gior|gg)|gior(no|ni)\s|vacanz|weekend|trip|tour|visit|cosa\s+(fare|vedere)|dove\s+(andare|visitare)|vado\s+a|andare\s+a|partir|destinazion/i;
  const editRx = /aggiungi|togli|sposta|rimuov|sostitu|cambia|modifica|elimina|metti|aggiorna/i;
  const greetRx = /^(ciao|salve|hey|ehi|grazie|prego|ok|sì|si|no|wow|bene|perfetto|fantastico|chi sei|come stai|che fai)\b/i;

  const hasItineraryIntent = itineraryRx.test(fullUserText);
  const lastAssistant = (messages || []).slice().reverse().find(m => m.role === "assistant");
  const lastAssistantText = (typeof lastAssistant?.content === "string" ? lastAssistant.content : "").toLowerCase();
  const discoveryRx = /con chi|in che periodo|da dove parti|che budget|fascia di prezzo|quante persone|quando pensavi|che mese/;
  const inDiscovery = !existingItinerary && discoveryRx.test(lastAssistantText);

  if (!hasItineraryIntent && !inDiscovery && (greetRx.test(lastText) || lastText.length < 60)) {
    return { model: M.CHEAP_CHAT, maxTokens: Math.min(cap, 1200), kind: "chat-cheap", days };
  }

  if (existingItinerary && (hasItineraryIntent || editRx.test(lastText))) {
    const tokens = Math.min(cap, Math.max(8000, days * 1500 + 5000));
    return { model: M.HAIKU, maxTokens: tokens, kind: "edit", days };
  }

  if (existingItinerary && !hasItineraryIntent) {
    return { model: M.HAIKU, maxTokens: Math.min(cap, 3000), kind: "consult", days };
  }

  // Nuovo itinerario: SEMPRE Haiku 4.5. Sonnet sforerebbe i 60s di Vercel.
  // Haiku 4.5 produce JSON di qualità equivalente a Sonnet su questo task,
  // a una velocità 3x maggiore (~150 tok/s).
  const tokens = Math.min(cap, Math.max(7000, days * 1100 + 3500));
  const kind = days <= 3 ? "create-small" : "create-large";
  return { model: M.HAIKU, maxTokens: tokens, kind, days };
}

// ── OpenRouter call (OpenAI-compatible) ───────────────────────────────────
async function callOpenRouter({ model, system, messages, maxTokens }) {
  if (!OPENROUTER_KEY) throw new Error("OPENROUTER_API_KEY non configurata");

  const body = {
    model,
    max_tokens: maxTokens,
    temperature: 0.7,
    messages: [{ role: "system", content: system }, ...messages],
  };

  // Abort prima del taglio Vercel: chiude la TCP a OpenRouter, che cancella
  // la generazione e fattura solo i token già emessi (non i futuri).
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
  const text = data.choices?.[0]?.message?.content || "";
  const finish = data.choices?.[0]?.finish_reason || "stop";
  const usage = data.usage || {};
  return { text, stopReason: finish === "length" ? "max_tokens" : "end_turn", usage };
}

// Converte messages + mediaContent in formato OpenAI/OpenRouter
function buildMessages(messages, mediaContent) {
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

// ── JSON extractor robusto ────────────────────────────────────────────────
function extractJsonPayload(str) {
  if (!str) return null;
  const cleaned = str.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
  try { return JSON.parse(cleaned); } catch {}
  const start = cleaned.indexOf("{");
  if (start === -1) return null;
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < cleaned.length; i++) {
    const c = cleaned[i];
    if (esc) { esc = false; continue; }
    if (c === "\\" && inStr) { esc = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (c === "{") depth++;
    if (c === "}") {
      depth--;
      if (depth === 0) {
        try { return JSON.parse(cleaned.substring(start, i + 1)); } catch {}
        break;
      }
    }
  }
  const m = cleaned.match(/"reply"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  return m ? { reply: m[1], itinerary: null } : null;
}

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
    const req = https.request(options, (r) => {
      let data = "";
      r.setEncoding("utf8");
      r.on("data", c => { data += c; });
      r.on("end", () => { try { resolve(JSON.parse(data)); } catch { resolve(null); } });
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
  const title = videoData?.title || videoData?.desc || "";
  const authorName = videoData?.author?.nickname || "";
  const hashtags = (videoData?.text_extra || []).filter(t => t.hashtag_name).map(t => `#${t.hashtag_name}`).join(" ");
  const context = `\n\n[VIDEO TIKTOK]\nAutore: @${authorName}\nDescrizione: ${title}\nHashtag: ${hashtags}\n\nCrea un itinerario ispirato a questo video.`;
  const userText = text.replace(tiktokRegex, "").trim();
  const enriched = [...messages];
  enriched[enriched.length - 1] = { ...lastMsg, content: (userText ? userText + context : context) };
  return enriched;
}

// ── Google Places enrichment ──────────────────────────────────────────────
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

function distanceKm(a, b) {
  const R = 6371;
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

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

const MAX_KM_FROM_CITY = 50;

function enrichWithGooglePlaces(itinerary) {
  return new Promise(async (resolve) => {
    const apiKey = process.env.GOOGLE_MAPS_KEY;
    if (!apiKey) { resolve(itinerary); return; }

    const days = itinerary.days ?? [];
    const cityCache = new Map();
    const ensureCityCoords = async (city) => {
      if (!city) return null;
      if (cityCache.has(city)) return cityCache.get(city);
      const coords = await geocodeAddress(city, apiKey);
      cityCache.set(city, coords);
      return coords;
    };

    const uniqueCities = [...new Set(days.map(d => d.city || itinerary.destination).filter(Boolean))];
    await Promise.all(uniqueCities.map(ensureCityCoords));

    const enrichOne = async (activity, dayCity) => {
      const cityCoords = await ensureCityCoords(dayCity);
      const cityLabel = dayCity || "";

      let result = await placesTextSearch(
        cityLabel ? `${activity.title}, ${cityLabel}` : activity.title,
        cityCoords,
        apiKey
      );

      if (result && cityCoords && distanceKm(result.coords, cityCoords) > MAX_KM_FROM_CITY) {
        const retry = await placesTextSearch(activity.title, cityCoords, apiKey);
        if (retry && distanceKm(retry.coords, cityCoords) <= MAX_KM_FROM_CITY) {
          result = retry;
        } else {
          result = null;
        }
      }

      if (result) {
        activity.coordinates = result.coords;
        if (result.name) activity.title = result.name;
      } else if (cityCoords) {
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

    await Promise.race([
      Promise.allSettled(tasks),
      new Promise(res => setTimeout(res, 8000)),
    ]);
    resolve(itinerary);
  });
}

// ── Handler ───────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") { res.status(200).end(); return; }
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { messages, existingItinerary, mediaContent, userTier } = req.body;

    if (!OPENROUTER_KEY) {
      console.error("[chat] OPENROUTER_API_KEY mancante");
      return res.status(500).json({ error: "Configurazione AI mancante. Contatta supporto." });
    }

    // Arricchimento con dati TikTok se l'utente incolla un link
    const enrichedMessages = await enrichWithTikTok(messages ?? []);

    const route = routeRequest({
      messages: enrichedMessages,
      existingItinerary,
      hasMedia: !!mediaContent,
      tier: userTier,
    });

    // Iniettiamo la data corrente: senza, il modello hallucina date passate negli URL → 404.
    const today = new Date().toISOString().slice(0, 10);
    const dateHint = `\n\n━━━ DATA OGGI ━━━\nOggi è ${today}. TUTTE le date che metti in URL (Skyscanner, Booking, Airbnb, etc) DEVONO essere uguali o successive a oggi. NON usare mai date passate. Se l'utente non ha dato date esatte, usa il primo mese plausibile da oggi in avanti.`;
    const baseSystem = SYSTEM_PROMPT + dateHint;
    const systemPrompt = existingItinerary
      ? `${baseSystem}\n\nItinerario attuale (modifica SOLO se esplicitamente richiesto):\n${JSON.stringify(existingItinerary).substring(0, 3000)}`
      : baseSystem;

    const orMessages = buildMessages(enrichedMessages, mediaContent);

    console.log(`[chat] kind=${route.kind} model=${route.model} days=${route.days} maxTokens=${route.maxTokens} hasItin=${!!existingItinerary} hasMedia=${!!mediaContent}`);

    // Primo tentativo con modello scelto
    let result;
    try {
      result = await callOpenRouter({
        model: route.model,
        system: systemPrompt,
        messages: orMessages,
        maxTokens: route.maxTokens,
      });
    } catch (e) {
      console.error(`[chat] primo tentativo fallito (${route.model}):`, e.message);
      // Fallback: Sonnet
      if (route.model !== M.SONNET) {
        console.log(`[chat] fallback → ${M.SONNET}`);
        result = await callOpenRouter({
          model: M.SONNET,
          system: systemPrompt,
          messages: orMessages,
          maxTokens: SONNET_MAX_TOKENS,
        });
      } else {
        throw e;
      }
    }

    const usage = result.usage || {};
    console.log(`[chat] usage: in=${usage.prompt_tokens || "?"} out=${usage.completion_tokens || "?"} stop=${result.stopReason}`);

    let payload = extractJsonPayload(result.text);

    // Fallback su JSON malformato: retry con Sonnet (solo se non già usato)
    if ((!payload || !payload.reply) && route.model !== M.SONNET) {
      console.warn(`[chat] JSON invalido da ${route.model}, retry con Sonnet`);
      try {
        const retry = await callOpenRouter({
          model: M.SONNET,
          system: systemPrompt,
          messages: orMessages,
          maxTokens: SONNET_MAX_TOKENS,
        });
        payload = extractJsonPayload(retry.text);
        console.log(`[chat] retry usage: in=${retry.usage?.prompt_tokens || "?"} out=${retry.usage?.completion_tokens || "?"}`);
      } catch (e) {
        console.error("[chat] retry Sonnet fallito:", e.message);
      }
    }

    if (!payload) {
      const msg = result.stopReason === "max_tokens"
        ? "Itinerario troppo lungo: prova con meno giorni o sii più specifico."
        : "Risposta non valida. Riprova.";
      return res.status(502).json({ error: msg });
    }
    if (!payload.reply) return res.status(502).json({ error: "Risposta incompleta. Riprova." });

    if (payload.itinerary) {
      try { payload.itinerary = await enrichWithGooglePlaces(payload.itinerary); }
      catch (e) { console.error("Places err:", e.message); }
      // Safety-net: garantisce affiliate su OGNI activity (anche se il modello l'ha dimenticato)
      ensureAffiliateOnItinerary(payload.itinerary);
    }

    // Safety-net date passate negli URL della reply
    if (typeof payload.reply === "string") {
      payload.reply = fixPastDatesInReply(payload.reply);
    }

    return res.status(200).json(payload);
  } catch (err) {
    console.error("Chat err:", err.message);
    return res.status(500).json({ error: "Qualcosa è andato storto. Riprova." });
  }
}
