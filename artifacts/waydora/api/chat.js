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

// Safety-net: garantisce che ogni activity abbia un link affiliate valido
function ensureAffiliateOnItinerary(itinerary) {
  if (!itinerary || !Array.isArray(itinerary.days)) return itinerary;
  const dest = itinerary.destination || "";
  for (const day of itinerary.days) {
    if (!Array.isArray(day.activities)) continue;
    for (const a of day.activities) {
      const hasValid = a.affiliate && typeof a.affiliate.url === "string" && a.affiliate.url.startsWith("http");
      if (!hasValid) a.affiliate = buildAffiliate(a.category, a.title, dest);
      else if ((a.category || "").toLowerCase() === "stay") a.affiliate = buildAffiliate("stay", a.title, dest);
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
2. CHIEDI SEMPRE: "Per trovare l'alloggio perfetto, dimmi: che tipo preferisci? (hotel, B&B, Airbnb, hostel, resort) E la fascia di prezzo per notte? (budget <€60, medio €60–130, comfort €130–220, lusso >€220)"
3. Solo dopo, rispondi in MODALITÀ TESTO con 3–4 opzioni specifiche.

━━━ VOLI — chiedi SEMPRE prima ━━━
Se l'utente chiede voli, come arrivare, biglietti aerei:
1. CHIEDI SEMPRE: da quale città parti? Le date? Quante persone?
2. Solo dopo, rispondi in MODALITÀ TESTO con link Skyscanner.

REGOLE GENERALI:
- Genera TUTTI i giorni richiesti in una sola risposta.
- 3-4 attività per giorno. Orari come fasce: "09:00-11:00", "Pranzo 12:30-14:00".
- NON includere indirizzi nelle descrizioni attività.
- destination: usa SEMPRE il nome inglese internazionale (es. "Milan, Italy"). Mai il nome italiano.
- tripPhotos: 3-4 query Unsplash per il viaggio intero.
- Se l'utente fa domande conversazionali rispondi SOLO con reply e itinerary: null. MAX 150 parole.
- Sii amichevole e naturale.

━━━ POI E COORDINATE — OBBLIGATORI ━━━
- title: usa SEMPRE il nome REALE e SPECIFICO del posto.
  ✅ "Trattoria Da Enzo al 29", "Colosseo", "Teatro alla Scala", "Mercato Centrale Firenze"
  ❌ "Ristorante locale", "Museo del centro", "Caffè caratteristico"
- coordinates: lat/lng GPS REALI del posto specifico. Verifica mentalmente che siano nella città giusta.
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

Sostituisci <NOME+POSTO> con il title dell'activity (spazi → +) e <DESTINAZIONE> con la città principale. NON omettere mai il campo affiliate.`;

// ── Router: classifica la richiesta e sceglie modello + maxTokens ─────────
function routeRequest({ lastUserMsg, existingItinerary, hasMedia, tier }) {
  const cap = TIER_TOKENS[tier] ?? TIER_TOKENS.guest;
  const text = (lastUserMsg || "").toString().toLowerCase().trim();

  // Estrai numero giorni dalla richiesta (default 3)
  const daysMatch = text.match(/(\d+)\s*(giorni|day|notti|notte|gg)/i);
  const days = daysMatch ? Math.min(parseInt(daysMatch[1]), 21) : 3;

  // Vision: sempre Haiku (vision-capable, economico)
  if (hasMedia) {
    return { model: M.HAIKU, maxTokens: Math.min(cap, 10000), kind: "vision", days };
  }

  // Intent itinerario
  const itineraryRx = /itinerar|viagg|pianifica|organizza|programm|crea.+(gior|gg)|gior(no|ni)\s|vacanz|weekend|trip|tour|visit|cosa\s+(fare|vedere)|dove\s+(andare|visitare)/i;
  const editRx = /aggiungi|togli|sposta|rimuov|sostitu|cambia|modifica|elimina|metti|aggiorna/i;

  const hasItineraryIntent = itineraryRx.test(text);

  // Pure chat: saluti / risposte corte / nessun riferimento a viaggio
  const greetRx = /^(ciao|salve|hey|ehi|grazie|prego|ok|sì|si|no|wow|bene|perfetto|fantastico|chi sei|come stai|che fai)\b/i;
  if (!hasItineraryIntent && (greetRx.test(text) || text.length < 60)) {
    return { model: M.CHEAP_CHAT, maxTokens: Math.min(cap, 1200), kind: "chat-cheap", days };
  }

  // Modifica itinerario esistente
  if (existingItinerary && (hasItineraryIntent || editRx.test(text))) {
    const tokens = Math.min(cap, Math.max(8000, days * 1500 + 5000));
    return { model: M.HAIKU, maxTokens: tokens, kind: "edit", days };
  }

  // Consulto su itinerario esistente (ristoranti, meteo, curiosità) — no itinerary intent
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
    const locParam = destCoords ? `&location=${destCoords.lat},${destCoords.lng}&radius=50000` : "";
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

    await Promise.race([
      Promise.allSettled(activities.map(enrichOne)),
      new Promise(res => setTimeout(res, 5000)),
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

    const lastMsg = enrichedMessages?.[enrichedMessages.length - 1]?.content || "";
    const lastText = typeof lastMsg === "string" ? lastMsg : (Array.isArray(lastMsg) ? lastMsg.find(c => c.type === "text")?.text || "" : "");

    const route = routeRequest({
      lastUserMsg: lastText,
      existingItinerary,
      hasMedia: !!mediaContent,
      tier: userTier,
    });

    const systemPrompt = existingItinerary
      ? `${SYSTEM_PROMPT}\n\nItinerario attuale (modifica SOLO se esplicitamente richiesto):\n${JSON.stringify(existingItinerary).substring(0, 3000)}`
      : SYSTEM_PROMPT;

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

    return res.status(200).json(payload);
  } catch (err) {
    console.error("Chat err:", err.message);
    return res.status(500).json({ error: "Qualcosa è andato storto. Riprova." });
  }
}
