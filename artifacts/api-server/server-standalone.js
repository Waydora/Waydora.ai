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
    case "train":
    case "bus":
      // Nessun affiliato monetizzato per questi: Google Maps transit (affidabile)
      return { provider: "Google Maps", label: "Come arrivare", url: `https://www.google.com/maps/dir/?api=1&destination=${q}&travelmode=transit` };
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

// ── Voli: link generati LATO CODICE ────────────────────────────────────────
// L'AI tende a (a) non emettere affatto l'URL ("ecco il link" senza link) e
// (b) allucinare il mese delle date. Quindi costruiamo noi due link affidabili:
//  • Google Flights (query in linguaggio naturale → risultati/prezzi reali)
//  • Kiwi affiliato (booking monetizzato; l'utente affina la ricerca)
// Le date vengono PARSATE dal testo dell'utente, mai inventate.
const IT_MONTHS = { gennaio:1, febbraio:2, marzo:3, aprile:4, maggio:5, giugno:6, luglio:7, agosto:8, settembre:9, ottobre:10, novembre:11, dicembre:12 };
const FLIGHT_ASK_RX = /\b(vol[oi]|aere[oi]|flight|biglietti?\s+aere)/i;
const LINK_ASK_RX   = /\b(link|links|risultat|dammi|mostrami|fammi vedere|dove sono|non vedo)\b/i;
// Intento "dove dormire": hotel/b&b/ostelli/airbnb/camping. Stesso problema dei voli:
// l'AI annuncia ("ecco dove dormire") e poi non emette alcun link → lo aggiungiamo noi.
// NB: gli stem troncati usano \w* (non solo \b) altrimenti "alloggio"/"ostello"/
// "campeggio" NON matcherebbero (\bcampegg\b fallisce su "campegg-io").
const LODGING_ASK_RX = /\b(dorm\w*|allogg\w*|hotel|b&b|bnb|ostell\w*|hostel|airbnb|pensione|sistemazion\w*|dove\s+stare|dove\s+alloggiare)\b/i;
const CAMP_ASK_RX    = /\b(campegg\w*|camping|glamping|tenda|piazzola)\b/i;
// Dettagli alloggio (tipo o budget): segnale che l'utente ha RISPOSTO alla domanda
// dell'AI → solo allora generiamo il link (prima l'AI deve poter chiedere tipo+budget).
const LODGING_DETAIL_RX = /\b(rifugi\w*|hotel|hostel|ostell\w*|b&b|bnb|airbnb|resort|appartament\w*|agriturism\w*|masseri\w*|pension\w*|glamping|campegg\w*|economic\w*|budget|medio|comfort|lusso|low[\s-]?cost|€\s?\d|\d+\s*(?:€|euro)|(?:a|per)\s+notte)\b/i;
// Segnali che l'AI ha appena CHIESTO una domanda su alloggi / voli (per capire se
// l'ultimo messaggio utente è una RISPOSTA a quella domanda). Richiede un "?".
const LODGING_ASKED_RX = /(allogg\w*|dormir|rifugi|hotel|b&b|ostell\w*|hostel|airbnb|resort|camer[ae]|fascia di prezzo|per notte|tipo preferisci)/i;
// SOLO segnali davvero VOLI-specifici. NON includere termini di onboarding generico
// (periodo / quante persone / che date / quando vai): la prima domanda standard
// dell'AI ("con chi vai e che periodo?") li conterrebbe e, se l'utente risponde con
// una data, farebbe partire i link voli su un viaggio che magari è in auto (es.
// Isernia→Vietri). La vera domanda voli del prompt contiene "da quale città parti".
const FLIGHT_ASKED_RX  = /(vol[oi]|aere|aeroport|partenz|da dove parti|da quale citt|citt[aà]\s+di\s+partenza|scal[oi])/i;

// Testo dell'ultimo messaggio assistant (per capire se ha posto una domanda).
function lastAssistantText(messages) {
  for (let i = (messages || []).length - 1; i >= 0; i--) {
    if (messages[i]?.role === "assistant") return typeof messages[i].content === "string" ? messages[i].content : "";
  }
  return "";
}

function parseItalianDates(text) {
  const today = new Date(); today.setHours(0,0,0,0);
  const rx = /(\d{1,2})\s+(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)/gi;
  const out = []; let m;
  while ((m = rx.exec(text))) {
    const day = parseInt(m[1], 10);
    const mon = IT_MONTHS[m[2].toLowerCase()];
    if (!mon || day < 1 || day > 31) continue;
    let year = today.getFullYear();
    if (new Date(year, mon - 1, day) < today) year++;
    out.push(`${year}-${String(mon).padStart(2,"0")}-${String(day).padStart(2,"0")}`);
  }
  return out;
}

function tidyCity(s) {
  return (s || "").trim().replace(/\s+/g, " ").replace(/[.,;!?]+$/, "")
    .replace(/\b(il|lo|la|i|gli|le|per|circa)\b\s*$/i, "").trim();
}

// Estrae una città nominata ESPLICITAMENTE nel testo ("a/in/per Berlino").
// Solo nomi propri (iniziale maiuscola) → evita falsi positivi su parole comuni
// (notti, persone, tenda…). Serve a capire se l'ultimo messaggio apre un NUOVO
// argomento: in tal caso non riusiamo destinazione/date di una richiesta passata.
function cityFromText(text) {
  if (!text) return null;
  const m = text.match(/\b(?:a|ad|in|per|verso)\s+([\p{Lu}][\p{L}'’.-]+(?:\s+[\p{Lu}][\p{L}'’.-]+){0,2})/u);
  return m ? tidyCity(m[1]) : null;
}

// Aggancia il contesto al TOPIC corrente: scorre i messaggi dall'ultimo all'indietro
// finché trova una città citata e ritorna { city, text } dove text = quel messaggio
// + i successivi. Così date/tratta NON colano da un argomento precedente (es. una
// vecchia richiesta su Istanbul mentre ora si parla di Berlino).
function topicContext(userMsgs) {
  for (let i = userMsgs.length - 1; i >= 0; i--) {
    const c = cityFromText(userMsgs[i]);
    if (c) return { city: c, text: userMsgs.slice(i).join(" ") };
  }
  return { city: null, text: (userMsgs || []).join(" ") };
}

// Scarta una data di ritorno/checkout incoerente (<= andata/checkin): sintomo di
// date prese da topic diversi. Meglio una sola data che un intervallo assurdo.
function coherentDates(dates) {
  const d = (dates || []).filter(Boolean);
  return (d.length >= 2 && d[1] <= d[0]) ? [d[0]] : d;
}

// Indice dell'ultimo messaggio che matcha rx (-1 se nessuno). Serve a capire quale
// intento (voli vs alloggi) è il più RECENTE quando l'utente dice solo "dammi i link".
function lastIdx(userMsgs, rx) {
  for (let i = (userMsgs || []).length - 1; i >= 0; i--) if (rx.test(userMsgs[i])) return i;
  return -1;
}

function parseRoute(fullText, itinerary) {
  let origin = null, dest = null;
  const m = fullText.match(/\bda\s+([\p{L}][\p{L}'’ .-]{1,28}?)\s+a\s+([\p{L}][\p{L}'’ .-]{1,28}?)(?=[\s,.;!?]|$| il | per | dal | a giugno)/iu);
  if (m) { origin = tidyCity(m[1]); dest = tidyCity(m[2]); }
  if (!dest && itinerary?.destination) dest = String(itinerary.destination).split(",")[0].trim();
  if (!origin && itinerary?.departure) origin = String(itinerary.departure).split(",")[0].trim();
  return { origin, dest };
}

function parsePax(fullText) {
  const m = fullText.match(/(\d{1,2})\s+person/i)
    || fullText.match(/(?:siamo\s+in|in)\s+(\d{1,2})\b/i)
    || fullText.match(/per\s+(\d{1,2})\b/i);
  return m ? Math.min(parseInt(m[1], 10), 9) : null;
}

// Ritorna un blocco testo da appendere alla reply, o null se non pertinente.
function buildFlightBlock(messages, itinerary) {
  const userMsgs = (messages || []).filter(m => m.role === "user")
    .map(m => typeof m.content === "string" ? m.content : "");
  const lastText = (userMsgs[userMsgs.length - 1] || "").trim();
  const fullText = userMsgs.join(" ");
  // Il blocco scatta solo se il MESSAGGIO CORRENTE riguarda i voli: (a) intento voli
  // nell'ultimo messaggio; (b) l'utente RISPONDE a una domanda voli dell'AI con
  // partenza/date/persone; (c) chiede i link e i voli sono il tema in corso.
  const flightIdx = lastIdx(userMsgs, FLIGHT_ASK_RX);
  const lodgeIdx = Math.max(lastIdx(userMsgs, LODGING_ASK_RX), lastIdx(userMsgs, CAMP_ASK_RX));
  const flightRecent = flightIdx >= 0 && flightIdx >= lodgeIdx;
  const aiText = lastAssistantText(messages);
  const aiAskedFlights = /\?/.test(aiText) && FLIGHT_ASKED_RX.test(aiText);
  const directIntent = FLIGHT_ASK_RX.test(lastText);
  const lastFlightDetails = parseItalianDates(lastText).length > 0
    || /\bda\s+[\p{L}]/iu.test(lastText) || parsePax(lastText) != null;
  const explicitLink = LINK_ASK_RX.test(lastText);
  const fire = directIntent || (aiAskedFlights && lastFlightDetails) || (explicitLink && flightRecent);
  if (!fire) return null;

  // Se l'ultimo messaggio apre una NUOVA tratta/destinazione, leggi tutto da lì
  // (non far colare tratta/date di una richiesta precedente). Se invece è un
  // follow-up, aggancia al topic corrente (ultima città citata), non all'itinerario.
  const lastRoute = parseRoute(lastText, null);
  let origin, dest, ctx;
  if (lastRoute.dest || cityFromText(lastText)) {
    origin = lastRoute.origin;
    dest = lastRoute.dest || cityFromText(lastText);
    ctx = lastText;
  } else {
    const t = topicContext(userMsgs);
    const r = parseRoute(t.text, null);
    origin = r.origin || (itinerary?.departure ? String(itinerary.departure).split(",")[0].trim() : null);
    dest = r.dest || t.city || (itinerary?.destination ? String(itinerary.destination).split(",")[0].trim() : null);
    ctx = t.text;
  }
  if (!dest) return null; // senza destinazione non costruiamo nulla

  const dates = coherentDates(parseItalianDates(ctx));
  const pax = parsePax(ctx);

  // CHIEDI PRIMA (coerente col prompt voli): anche se l'intento voli è esplicito,
  // genera i link SOLO quando abbiamo partenza o date (o richiesta esplicita di link).
  // "voli per X" senza partenza/date → l'AI chiede prima.
  if (!explicitLink && !origin && dates.length === 0) return null;

  // Query Google Flights in inglese (il parser NL di Google è anglo-centrico).
  const q = [
    "flights",
    origin ? `from ${origin}` : null,
    `to ${dest}`,
    dates[0] ? `on ${dates[0]}` : null,
    dates[1] ? `returning ${dates[1]}` : null,
    pax ? `for ${pax} adults` : null,
  ].filter(Boolean).join(" ");
  const gf = `https://www.google.com/travel/flights?q=${encodeURIComponent(q)}`;

  const tratta = origin ? `da ${origin} a ${dest}` : `per ${dest}`;
  const when = dates[0] ? ` (andata ${dates[0]}${dates[1] ? `, ritorno ${dates[1]}` : ""})` : "";
  // Markdown + etichetta brand: niente domini grezzi (tpm.li) nel testo visibile.
  return `\n\n✈️ Voli ${tratta}${when}:\n• [Vedi voli e prezzi su Google Flights](${gf})\n• [Prenota su Kiwi](${AFF.KIWI_URL})`;
}

// ── Alloggi: link generati LATO CODICE ──────────────────────────────────────
// Stesso fix dei voli: l'AI dice "ecco dove dormire 🏕️" e poi non emette nulla.
// Costruiamo noi: Stay22 (affiliato, hotel/b&b/ostelli per la destinazione, con
// date se note) + per i campeggi una ricerca Google Maps (Stay22 non li copre).
function buildLodgingBlock(messages, itinerary) {
  const userMsgs = (messages || []).filter(m => m.role === "user")
    .map(m => typeof m.content === "string" ? m.content : "");
  const lastText = (userMsgs[userMsgs.length - 1] || "").trim();
  const fullText = userMsgs.join(" ");
  // Il blocco scatta SOLO se il MESSAGGIO CORRENTE riguarda gli alloggi (non basta
  // che se ne sia parlato prima: se ora l'utente chiede il tragitto, niente link).
  // Fire se: (a) intento+dettaglio nello stesso messaggio ("hotel economico a Roma",
  // "campeggio in Sardegna"); (b) l'utente RISPONDE a una domanda alloggi dell'AI;
  // (c) chiede esplicitamente i link e gli alloggi sono il tema in corso.
  const flightIdx = lastIdx(userMsgs, FLIGHT_ASK_RX);
  const lodgeIdx = Math.max(lastIdx(userMsgs, LODGING_ASK_RX), lastIdx(userMsgs, CAMP_ASK_RX));
  const lodgingRecent = lodgeIdx >= 0 && lodgeIdx >= flightIdx;
  const aiText = lastAssistantText(messages);
  const aiAskedLodging = /\?/.test(aiText) && LODGING_ASKED_RX.test(aiText);
  const directIntent = LODGING_ASK_RX.test(lastText) || CAMP_ASK_RX.test(lastText);
  const detailsInLast = LODGING_DETAIL_RX.test(lastText);
  const explicitLink = LINK_ASK_RX.test(lastText);
  const fire = (directIntent && detailsInLast)
    || (aiAskedLodging && detailsInLast)
    || (explicitLink && lodgingRecent);
  if (!fire) return null;

  // Se l'ultimo messaggio nomina una città esplicita è una richiesta FRESCA: usa
  // quella + le date di quel messaggio (no leak da argomenti precedenti). Altrimenti
  // (follow-up "dammi i link") cadi sull'itinerario in chat o sul contesto completo.
  const cityInLast = cityFromText(lastText);
  let dest, datesText;
  if (cityInLast) {
    dest = cityInLast; datesText = lastText;
  } else {
    // Follow-up: ultima città citata (con le sue date) → poi itinerario in chat.
    const t = topicContext(userMsgs);
    dest = t.city || (itinerary?.destination ? String(itinerary.destination).split(",")[0].trim() : null);
    datesText = t.city ? t.text : fullText;
  }
  if (!dest) return null; // senza destinazione non costruiamo nulla

  const dates = coherentDates(parseItalianDates(datesText));
  const pax = parsePax(fullText) || 2;
  const sp = new URLSearchParams({ address: dest, adults: String(pax) });
  if (dates[0]) sp.set("checkin", dates[0]);
  if (dates[1]) sp.set("checkout", dates[1]);
  const stay = `${AFF.STAY22_URL}?${sp.toString()}`;

  // Link in MARKDOWN con etichetta BRAND (Booking): l'URL grezzo dell'affiliato
  // (stay22) NON deve mai comparire come testo visibile. Vedi richiesta utente.
  let block = `\n\n🏨 Dove dormire a ${dest}:\n• [Cerca hotel, B&B e ostelli su Booking](${stay})`;
  // Campeggi SOLO se l'utente li ha chiesti esplicitamente (a molte mete non c'entrano).
  if (CAMP_ASK_RX.test(fullText)) {
    const camp = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`campeggi ${dest}`)}`;
    block += `\n• [Cerca campeggi su Google Maps](${camp})`;
  }
  return block;
}

// Enforcement affiliati: riscrive nella reply i link "nudi" (Booking, Airbnb,
// Skyscanner, Viator, TheFork, GetYourGuide senza partner_id) verso gli affiliati
// monetizzati. Rete di sicurezza nel caso l'AI ignori le istruzioni del prompt.
function rewriteAffiliateLinks(text) {
  if (typeof text !== "string" || !text) return text;
  const STAY22 = "https://booking.stay22.com/waydora/5DPoKS60Cy";
  const KIWI   = "https://kiwi.tpm.li/HdS8gBCi";
  const gyg = (raw) => `https://www.getyourguide.com/s/?q=${encodeURIComponent((raw || "").trim())}&partner_id=EPBPR3R`;
  const stay22 = (dest) => dest ? `${STAY22}?address=${encodeURIComponent(dest)}&adults=2` : STAY22;
  const URL_RX = /(https?:\/\/[^\s)\]]+)/g;
  return text.replace(URL_RX, (url) => {
    let u, host;
    try { u = new URL(url); host = u.hostname.replace(/^www\./, "").toLowerCase(); }
    catch { return url; }
    // Hotel → Stay22 (estrai destinazione se presente)
    if (host.includes("booking.com")) return stay22(u.searchParams.get("ss"));
    if (host.includes("airbnb.")) {
      const m = u.pathname.match(/\/s\/([^/]+)/);
      return stay22(m ? decodeURIComponent(m[1]).replace(/-/g, " ") : "");
    }
    // Voli → Kiwi
    if (host.includes("skyscanner.")) return KIWI;
    if (host.includes("google.") && u.pathname.includes("/travel/flights")) return KIWI;
    // Tour/musei/ristoranti-prenotabili → GetYourGuide con partner_id
    if (host.includes("viator.")) return gyg(u.searchParams.get("text"));
    if (host.includes("thefork.")) return gyg(u.searchParams.get("searchText"));
    // GetYourGuide senza partner_id → aggiungilo
    if (host.includes("getyourguide.")) {
      if (!u.searchParams.has("partner_id")) { u.searchParams.set("partner_id", "EPBPR3R"); return u.toString(); }
      return url;
    }
    return url;
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
    "departure": "città di partenza dell'utente se nota dal contesto chat (es. Isernia, Italy), altrimenti ometti il campo",
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
Se l'utente chiede dove dormire, hotel, b&b, airbnb, campeggi o sistemazioni:
1. NON aggiungere alloggi nell'itinerario automaticamente.
2. CHIEDI SEMPRE con una domanda amichevole:
   "Per trovare l'alloggio perfetto, dimmi: che tipo preferisci? (hotel, B&B, Airbnb, hostel, campeggio, resort) E la fascia di prezzo per notte? (budget <€60, medio €60–130, comfort €130–220, lusso >€220)"
3. Quando hai tipo + budget: rispondi in MODALITÀ TESTO conversazionale (1-2 frasi + eventuali consigli sui quartieri/zone), confermando destinazione e tipo.
   ⚠️ NON scrivere TU alcun URL di alloggi (né Stay22 né Booking né Airbnb): il link di ricerca alloggi (e campeggi se richiesti) lo AGGIUNGE automaticamente Waydora in coda al messaggio. Limitati al testo.

━━━ VOLI — chiedi SEMPRE prima ━━━
Se l'utente chiede voli, come arrivare, biglietti aerei:
1. CHIEDI SEMPRE (se mancano):
   "Per trovare i voli migliori, ho bisogno di sapere: da quale città (o aeroporto) parti? Le date esatte o il periodo preferito? Quante persone volano?"
2. Quando hai partenza, destinazione e date: rispondi in MODALITÀ TESTO in modo conversazionale (1-2 frasi), confermando tratta e date.
   ⚠️ NON inventare e NON scrivere TU alcun URL di voli (né Skyscanner né Kiwi né Google): i link voli (risultati reali + prenotazione) li AGGIUNGE automaticamente Waydora in coda al messaggio. Limitati al testo.

━━━ CONSIGLI E RACCOMANDAZIONI — REGOLE STRICT (vale per TUTTO: ristoranti, hotel, attività, voli, treni, traghetti, bus, biglietti) ━━━

REGOLA D'ORO: **mai promesse vuote**. Se in una reply scrivi "ecco…", "ti do…", "ti mando…", "trovi qui sotto…", "guarda…", DEVE seguire IMMEDIATAMENTE il contenuto reale (nome + link cliccabile) nello STESSO messaggio. È VIETATO terminare una reply con ":" o con una frase di apertura senza elenco.

Frasi VIETATE se non seguite dal contenuto:
- "Eccoti qualche opzione…" / "Ecco i link…" / "Ti do qualche consiglio…"
- "Ti mando il link" / "Trovi il link qui" / "Puoi prenotare su…" (se poi non c'è l'URL completo cliccabile)
- "I principali operatori sono…" / "Puoi cercare su…" (senza URL effettivo)

Per OGNI cosa che consigli o menzioni come prenotabile, includi SEMPRE nello stesso messaggio un link cliccabile in formato markdown [Testo](URL). Usa questi URL pattern (sostituisci spazi con +):

⚠️ REGOLA URL CRITICA: NON inserire MAI nomi di città/stazioni/porti nel PATH dell'URL (es. ".../da-Napoli-a-Pietrarsa"): si rompono. I nomi vanno SOLO nei parametri (?query= ?q= ?address= origin= destination=). Per ogni categoria USA ESATTAMENTE il link affiliato qui sotto (da questi Waydora guadagna): è VIETATO sostituirli con Booking/Airbnb/Skyscanner/Viator/TheFork "nudi".

⚠️ ETICHETTE BRAND: ogni link va SEMPRE in formato markdown [Etichetta](url) e l'etichetta deve essere un brand riconoscibile dall'utente (es. "Cerca su Booking", "Prenota su Kiwi", "Apri in Google Maps", "Prenota su GetYourGuide"). NON mostrare MAI nel testo visibile gli URL grezzi degli intermediari di affiliazione (stay22.com, tpm.li, ecc.): l'utente non deve leggere "stay22" né "tpm.li", solo il nome del brand.

**Hotel / alloggi → Stay22 (AFFILIATO, obbligatorio):**
- "https://booking.stay22.com/waydora/5DPoKS60Cy?address=DESTINAZIONE&adults=2"

**Attività / musei / tour / esperienze / biglietti → GetYourGuide (AFFILIATO, obbligatorio):**
- "https://www.getyourguide.com/s/?q=NOME+CITTÀ&partner_id=EPBPR3R"
  (partner_id=EPBPR3R è OBBLIGATORIO: senza, non guadagniamo nulla)

**Voli → Kiwi (AFFILIATO, obbligatorio):**
- "https://kiwi.tpm.li/HdS8gBCi" (link fisso: l'utente cerca la tratta sul sito partner)

**eSIM / internet all'estero → Yesim (AFFILIATO):**
- "https://yesim.tpm.li/3DONLGQL"

**Attrezzatura da viaggio / bagaglio → Amazon (AFFILIATO):**
- "https://www.amazon.it/s?k=NOME+ARTICOLO+viaggio&tag=waydora-21" (tag=waydora-21 OBBLIGATORIO)

**Ristoranti / bar / cibo → Google Maps (nessun affiliato, va bene):**
- "https://www.google.com/maps/search/?api=1&query=NOME+POSTO+CITTÀ"

**Treni / bus / traghetti / spostamenti locali → Google Maps transit (nessun affiliato):**
- "https://www.google.com/maps/dir/?api=1&origin=PARTENZA&destination=ARRIVO&travelmode=transit"

Formato consigliato per ogni opzione:
- **Nome** — descrizione breve (prezzo indicativo). [Prenota](URL) · [Mappa](URL)

Massimo 4-5 opzioni per messaggio. Se non hai abbastanza info per costruire l'URL (es. manca la data per il volo), CHIEDI prima di promettere il link — non scrivere mai "ti do il link" senza darlo.

REGOLE GENERALI:
- Genera TUTTI i giorni richiesti in una sola risposta.
- 3-4 attività per giorno. Orari come fasce: "09:00-11:00", "Pranzo 12:30-14:00".
- NON includere indirizzi nelle descrizioni attività.
- destination: usa SEMPRE il nome inglese internazionale seguito dal paese (es. "Milan, Italy", "Prague, Czech Republic", "Paris, France"). Mai il nome italiano.
- tripPhotos: 3-4 query Unsplash per il viaggio intero.
- Se ricevi info estratte da un video TikTok, analizzale e crea un itinerario ispirato.
- Se l'utente fa domande conversazionali rispondi SOLO con reply e itinerary: null. MAX 150 parole.
- ⚠️ ANTI-INVENZIONE (CRITICO): NON inventare MAI nomi propri di ristoranti, bar, hotel, negozi o locali specifici, soprattutto in città piccole o poco turistiche. Dare un nome FALSO è PEGGIO che non darne. Se non sei certo al 100% che quel locale esista con quel nome, NON nominarlo. Per mangiare/dormire descrivi il TIPO ("una trattoria di cucina tipica in centro", "un B&B vicino alla stazione") e dai un link Google Maps di RICERCA per tipologia (query tipo "trattoria tipica Isernia centro storico"), così l'utente trova posti VERI e aggiornati. Nomi propri SOLO per luoghi famosi e verificabili (monumenti, musei, piazze, grandi catene). Se l'utente segnala che un posto non esiste, NON inventarne un altro: ammetti e rimanda a Google Maps/ricerca locale.
- COERENZA ITINERARIO: se nella reply dici di aver creato/costruito un itinerario o "una giornata", l'oggetto itinerary STRUTTURATO DEVE essere presente nella stessa risposta. È VIETATO annunciare un itinerario solo a parole lasciando itinerary: null.
- MODIFICHE (CRITICO per la mappa): quando l'utente modifica/aggiunge/toglie/sposta qualcosa in un itinerario esistente, restituisci SEMPRE l'oggetto itinerary COMPLETO e aggiornato — TUTTI i giorni e TUTTE le attività, anche quelle NON modificate — mai un frammento, mai solo il giorno cambiato, mai itinerary: null. Per le attività che NON cambi, RICOPIA identici "title", "time" e "category" dell'originale (NON riformularli): così la mappa conserva i punti già posizionati. Cambia solo ciò che l'utente ha chiesto.
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
  Il "title" di un transport deve descrivere lo SPOSTAMENTO (es. "Volo Napoli → Istanbul", "Trasferimento in auto a Tropea", "Treno per Firenze"), MAI il nome di un'agenzia viaggi, tour operator o compagnia (es. NON "Agenzia X", NON "Trenitalia"): sono tragitti, non luoghi da mettere sulla mappa.
  Se la partenza ("departure") e la destinazione sono raggiungibili in auto in modo sensato (stessa area/regione/nazione, es. Isernia → Calabria), usa transportMode "car" per il primo spostamento; usa "flight" solo per tratte lunghe/intercontinentali o via mare obbligata.
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
function routeRequest({ messages, existingItinerary, hasMedia, tier, progressive }) {
  const cap = TIER_TOKENS[tier] ?? TIER_TOKENS.guest;

  // Generazione progressiva → SEMPRE Sonnet (qualità POI/coords), token dimensionati
  // sul numero di giorni del chunk richiesto (più piccolo = più veloce).
  if (progressive && progressive.totalDays > 0) {
    const n = Math.max(1, progressive.to - progressive.from + 1);
    return { model: M.SONNET, maxTokens: Math.min(cap, Math.max(4000, n * 2200 + 2500)), kind: `progressive-${progressive.from}-${progressive.to}`, days: n };
  }
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
async function callAI(messages, existingItinerary, mediaContent, userTier = "guest", progressive = null) {
  // Iniettiamo la data corrente: senza, il modello hallucina date passate negli URL Skyscanner/Booking → 404.
  const today = new Date().toISOString().slice(0, 10);
  const dateHint = `\n\n━━━ DATA OGGI ━━━\nOggi è ${today}. TUTTE le date che metti in URL (Skyscanner, Booking, Airbnb, etc) DEVONO essere uguali o successive a oggi. NON usare mai date passate. Se l'utente non ha dato date esatte, usa il primo mese plausibile da oggi in avanti.`;
  const baseSystem = SYSTEM_PROMPT + dateHint;
  let systemPrompt = existingItinerary
    ? `${baseSystem}\n\nItinerario attuale (modifica SOLO se esplicitamente richiesto):\n${JSON.stringify(existingItinerary).substring(0, 3000)}`
    : baseSystem;

  // Generazione progressiva: chiede SOLO un sottoinsieme di giorni per mostrare
  // subito qualcosa all'utente; il resto arriva con una seconda chiamata.
  if (progressive && progressive.totalDays > 0) {
    const cont = progressive.from > 1;
    systemPrompt += `\n\n━━━ GENERAZIONE PARZIALE (mostra-subito) ━━━\nL'utente vuole un viaggio di ${progressive.totalDays} giorni. Per mostrarglielo subito SENZA attesa, genera ORA SOLO i giorni da ${progressive.from} a ${progressive.to}.\n- Imposta "durationDays": ${progressive.totalDays} (il TOTALE reale del viaggio).\n- "days" deve contenere ESCLUSIVAMENTE i giorni da ${progressive.from} a ${progressive.to} (campo "day" numerato ${progressive.from}, ${progressive.from + 1}, …).\n- Pianifica mentalmente l'intero viaggio di ${progressive.totalDays} giorni (basi/città coerenti) ma emetti solo questi giorni.` +
      (cont
        ? `\n- CONTINUAZIONE: i giorni 1..${progressive.from - 1} ESISTONO GIÀ (vedi "Itinerario attuale"). NON ripeterli e NON duplicare attività; prosegui in piena continuità (stesse città/logica di spostamento).\n- Ometti packingList e tripPhotos (già presenti): metti packingList: [] e niente tripPhotos.`
        : `\n- Includi normalmente title, destination, vibe, bestSeason, packingList e tripPhotos del viaggio intero.`);
  }

  const route = routeRequest({ messages, existingItinerary, hasMedia: !!mediaContent, tier: userTier, progressive });
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

// ── #5 Aggiunta giorni a basso consumo di token ────────────────────────────
// Problema: "aggiungi un giorno" faceva rigenerare all'AI l'INTERO itinerario JSON
// (input+output enormi) con rischio di stravolgere i giorni esistenti. Qui invece,
// quando l'utente chiede di AGGIUNGERE uno o più GIORNI INTERI, chiediamo all'AI di
// emettere SOLO i nuovi giorni ({reply, newDays}) e li uniamo lato server ai giorni
// esistenti: meno token e zero drift sui giorni già presenti. Se il riconoscimento
// non è sicuro (o l'output è malformato) si ricade sulla rigenerazione completa.
function detectAppendDays(messages, itinerary) {
  if (!itinerary || !Array.isArray(itinerary.days) || itinerary.days.length === 0) return null;
  const userMsgs = (messages || []).filter(m => m.role === "user")
    .map(m => (typeof m.content === "string" ? m.content : ""));
  const last = (userMsgs[userMsgs.length - 1] || "").toLowerCase().trim();
  if (!last) return null;

  const addIntent = /\b(aggiung\w*|inseris\w*|metti|estend\w*|allung\w*|prolung\w*|un altro giorno|un giorno in più|una giornata in più|ancora un giorno|un'altra giornata)\b/.test(last);
  const dayWord = /\b(giorn\w*|giornat\w*|nott\w*)\b/.test(last);
  if (!addIntent || !dayWord) return null;

  // Escludi le modifiche DENTRO un giorno esistente ("aggiungi una tappa al giorno 2",
  // "metti una cena nel giorno 3"): lì serve la modifica normale, non un nuovo giorno.
  if (/\b(a|al|all'|nel|nell'|del|dell'|sul|sull'|nello)\s*giorn\w*\s*\d/.test(last)) return null;
  if (/giorn\w*\s+\d/.test(last) && !/\d+\s*(?:giorn|giornat|nott)/.test(last)) return null;

  // Quanti giorni: cifra esplicita, poi parole comuni, default 1. Cap a 7 per sicurezza.
  let count = 1;
  const m = last.match(/(\d+)\s*(?:giorn|giornat|nott)/);
  if (m) count = Math.min(parseInt(m[1], 10) || 1, 7);
  else if (/\bdue\b/.test(last)) count = 2;
  else if (/\btre\b/.test(last)) count = 3;
  return { count };
}

async function callAppendDays(messages, itinerary, count, userTier) {
  const today = new Date().toISOString().slice(0, 10);
  const existingDays = Array.isArray(itinerary.days) ? itinerary.days.length : 0;
  const startNum = existingDays + 1;
  const endNum = existingDays + count;
  // Riassunto COMPATTO dei giorni esistenti (no JSON pieno): basta per continuità
  // e per non ripetere i luoghi. Risparmia token di input.
  const brief = (itinerary.days || [])
    .map(d => `G${d.day}: ${d.title || ""}${d.city ? ` (${d.city})` : ""}`)
    .join(" · ")
    .substring(0, 900);

  const sys = `${SYSTEM_PROMPT}

━━━ DATA OGGI ━━━
Oggi è ${today}. Nessuna data passata negli URL.

━━━ AGGIUNTA GIORNI (OUTPUT MINIMALE — RISPARMIO TOKEN) ━━━
Stai AGGIUNGENDO ${count} nuovo/i giorno/i a un itinerario ESISTENTE di "${itinerary.destination || ""}" che ha GIÀ ${existingDays} giorni. NON riscrivere e NON ripetere i giorni esistenti.
Rispondi SOLO con questo JSON: { "reply": "1-2 frasi in italiano che confermano cosa hai aggiunto", "newDays": [ ... ] }.
"newDays" contiene ESCLUSIVAMENTE i ${count} nuovi giorni, ciascuno con la STESSA struttura del campo days[] dell'itinerario (day, title, summary, weather, activities[] con coordinates OBBLIGATORIE per ogni attività, e affiliate dove ha senso). Numera i nuovi giorni ${count > 1 ? `${startNum}…${endNum}` : `${startNum}`}.
Continuità (NON ripetere questi luoghi già previsti): ${brief}.`;

  const cap = TIER_TOKENS[userTier] ?? TIER_TOKENS.guest;
  const maxTokens = Math.min(cap, Math.max(3500, count * 2600 + 1500));
  const orMessages = buildORMessages(messages, null);
  console.log(`[append-days] count=${count} model=${M.SONNET} maxTokens=${maxTokens} (vs regen completa)`);
  const result = await callOpenRouter({ model: M.SONNET, system: sys, messages: orMessages, maxTokens });
  return { ...result, model: M.SONNET };
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

// Riusa le coordinate già note dall'itinerario PRECEDENTE per le attività non
// cambiate (match per titolo normalizzato). Così una modifica non perde i pin
// sulla mappa anche se il re-enrichment Places fallisce, va in timeout o l'AI ha
// omesso il "city" del giorno. Va chiamata PRIMA di enrichWithGooglePlaces.
function carryOverCoordinates(newItin, oldItin) {
  if (!newItin || !oldItin || !Array.isArray(newItin.days) || !Array.isArray(oldItin.days)) return newItin;
  const norm = (s) => (s || "").toString().trim().toLowerCase();
  const byTitle = new Map();
  for (const d of oldItin.days) {
    for (const a of (d.activities || [])) {
      if (a?.coordinates?.lat && a?.coordinates?.lng && a.title) {
        const k = norm(a.title);
        if (!byTitle.has(k)) byTitle.set(k, a.coordinates);
      }
    }
  }
  for (const d of newItin.days) {
    for (const a of (d.activities || [])) {
      if (!(a?.coordinates?.lat && a?.coordinates?.lng)) {
        const hit = byTitle.get(norm(a.title));
        if (hit) a.coordinates = hit;
      }
    }
  }
  if (!(newItin.departureCoords?.lat) && oldItin.departureCoords?.lat) {
    newItin.departureCoords = oldItin.departureCoords;
  }
  return newItin;
}

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
      // I trasporti (voli/treni/trasferimenti) sono tragitti, non luoghi: NON
      // geocodificarli, altrimenti il Text Search può matchare un'agenzia viaggi
      // e produrre un pin sbagliato sulla mappa. Restano nei dati (per transportMode)
      // ma senza coordinate → la mappa non li disegna come pin.
      if ((activity.category || "").toLowerCase() === "transport") return;

      // Coordinate già note (riportate dall'itinerario precedente via carryOver):
      // non ri-geocodificare → mappa stabile, meno chiamate Places, meno timeout.
      if (activity.coordinates?.lat && activity.coordinates?.lng) return;

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

    // Geocodifica la città di partenza (se fornita) per disegnare il tragitto
    // di andata sulla mappa. Usiamo geocodeAddress (centroide città) e NON il
    // Text Search, così non rischiamo di matchare un'agenzia/tour operator.
    if (itinerary.departure) {
      tasks.push((async () => {
        const dep = await geocodeAddress(itinerary.departure, apiKey);
        if (dep) itinerary.departureCoords = dep;
      })());
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
        const { messages, existingItinerary, mediaContent, userTier, progressive } = JSON.parse(body);
        console.log(`[chat] msgs=${messages?.length}, tier=${userTier}, hasItinerary=${!!existingItinerary}, progressive=${progressive ? `${progressive.from}-${progressive.to}/${progressive.totalDays}` : "no"}`);
        const enrichedMessages = await enrichWithTikTok(messages);

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

        let payload = null;
        let raw = "";
        let stopReason = "end_turn";
        let usedModel = null;

        // #5: "aggiungi un giorno" → genera SOLO i nuovi giorni e fai il merge lato
        // server (pochi token, nessun drift). Se fallisce → rigenerazione completa.
        const appendReq = existingItinerary && !progressive && !mediaContent
          ? detectAppendDays(enrichedMessages, existingItinerary) : null;
        if (appendReq) {
          try {
            const ap = await callAppendDays(enrichedMessages, existingItinerary, appendReq.count, userTier);
            stopReason = ap.stopReason; usedModel = ap.model;
            const p = extractJsonPayload(ap.text);
            if (p && Array.isArray(p.newDays) && p.newDays.length > 0) {
              let dayNum = Array.isArray(existingItinerary.days) ? existingItinerary.days.length : 0;
              const merged = p.newDays.filter(Boolean).map(d => ({ ...d, day: ++dayNum }));
              payload = {
                reply: (typeof p.reply === "string" && p.reply.trim()) ? p.reply : "Ho aggiunto i nuovi giorni al tuo itinerario ✨",
                itinerary: {
                  ...existingItinerary,
                  days: [...(existingItinerary.days || []), ...merged],
                  durationDays: dayNum,
                },
              };
              console.log(`[chat] append-days OK: +${merged.length}gg (tot ${dayNum})`);
            } else {
              console.warn("[chat] append-days: newDays assente/vuoto → fallback regen completa");
            }
          } catch (e) {
            console.warn("[chat] append-days errore → fallback regen completa:", e.message);
          }
        }

        // Percorso normale (creazione / modifica / consulto / append fallito)
        if (!payload) {
          let aiResult = await callAI(enrichedMessages, existingItinerary, mediaContent, userTier, progressive);
          raw = aiResult.text;
          stopReason = aiResult.stopReason;
          usedModel = aiResult.model;
          payload = extractJsonPayload(raw);
        }

        // Fallback su JSON invalido: retry con Sonnet se non già usato
        if ((!payload || !payload.reply) && usedModel !== M.SONNET) {
          console.warn(`[chat] JSON invalido da ${usedModel}, retry con Sonnet`);
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
          // Modifica: riusa le coordinate note dell'itinerario precedente per le
          // attività invariate → la mappa non perde pin se l'enrichment fallisce.
          if (existingItinerary) carryOverCoordinates(payload.itinerary, existingItinerary);
          try { payload.itinerary = await enrichWithGooglePlaces(payload.itinerary); }
          catch (e) { console.error("Places err:", e.message); }
          // Safety-net: garantisce affiliate su OGNI activity anche se Sonnet dimentica
          ensureAffiliateOnItinerary(payload.itinerary);
        }

        // Enforcement affiliati + safety-net date passate negli URL della reply
        if (typeof payload.reply === "string") {
          payload.reply = rewriteAffiliateLinks(payload.reply);
          payload.reply = fixPastDatesInReply(payload.reply);
          // Voli: appendi i link generati lato codice DOPO il rewrite, così il link
          // Google Flights (risultati reali) non viene riscritto in Kiwi generico.
          const flightBlock = buildFlightBlock(messages, existingItinerary || payload.itinerary);
          if (flightBlock) payload.reply += flightBlock;
          const lodgingBlock = buildLodgingBlock(messages, existingItinerary || payload.itinerary);
          if (lodgingBlock) payload.reply += lodgingBlock;
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