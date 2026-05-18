const http = require("http");
const https = require("https");

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

REGOLE:
- Genera TUTTI i giorni richiesti in una sola risposta.
- 3-4 attività per giorno. Orari come fasce: "09:00-11:00", "Pranzo 12:30-14:00".
- NON includere indirizzi nelle descrizioni attività.
- tripPhotos: 3-4 query Unsplash per il viaggio intero.
- Se ricevi info estratte da un video TikTok di viaggio, analizzale e crea un itinerario ispirato a ciò che viene mostrato nel video.
- Se l'utente fa domande conversazionali rispondi SOLO con reply e itinerary: null. MAX 150 parole.
- Sii amichevole e naturale.`;

// ── Estrae info da video TikTok via RapidAPI ──────────────────────────────
function fetchTikTokData(videoUrl) {
  return new Promise((resolve, reject) => {
    const apiKey = process.env.RAPIDAPI_KEY;
    if (!apiKey) {
      resolve(null);
      return;
    }

    const encodedUrl = encodeURIComponent(videoUrl);
    const options = {
      hostname: "tiktok-scraper7.p.rapidapi.com",
      path: `/?url=${encodedUrl}&hd=1`,
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
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed);
        } catch (e) {
          console.error("Errore parsing risposta TikTok:", e.message);
          resolve(null);
        }
      });
    });

    req.on("error", (err) => {
      console.error("Errore chiamata TikTok API:", err.message);
      resolve(null); // Non blocca — continua senza dati TikTok
    });

    req.setTimeout(8000, () => {
      req.destroy();
      console.error("Timeout chiamata TikTok API");
      resolve(null);
    });

    req.end();
  });
}

// ── Rileva e arricchisce messaggi con link TikTok ─────────────────────────
async function enrichWithTikTok(messages) {
  const lastMsg = messages[messages.length - 1];
  const text = typeof lastMsg?.content === "string" ? lastMsg.content : "";

  const tiktokRegex = /https?:\/\/(www\.|vm\.)?tiktok\.com\/[^\s]*/gi;
  const matches = text.match(tiktokRegex);

  if (!matches || matches.length === 0) {
    return messages; // Nessun link TikTok — ritorna invariato
  }

  console.log("Link TikTok rilevato:", matches[0]);

  // Prende il primo link TikTok trovato
  const tiktokUrl = matches[0];
  const tiktokData = await fetchTikTokData(tiktokUrl);

  if (!tiktokData) {
    // API fallita — chiedi all'utente di descrivere il video
    const enrichedText = `${text}

[Nota: Ho rilevato un link TikTok ma non sono riuscita ad accedere ai dati del video in questo momento. 
Puoi descrivermi cosa hai visto nel video? Destinazione, attività, luoghi mostrati?]`;

    const enrichedMessages = [...messages];
    enrichedMessages[enrichedMessages.length - 1] = {
      ...lastMsg,
      content: enrichedText,
    };
    return enrichedMessages;
  }

  // Estrae le informazioni utili dalla risposta di TikTok Scraper7
  // La risposta ha struttura: data.data.title, data.data.author.nickname, ecc.
  const videoData = tiktokData?.data || tiktokData;
  const title = videoData?.title || videoData?.desc || "";
  const authorName = videoData?.author?.nickname || videoData?.author?.unique_id || "";
  const hashtags = (videoData?.text_extra || [])
    .filter((t) => t.hashtag_name)
    .map((t) => `#${t.hashtag_name}`)
    .join(" ");
  const musicTitle = videoData?.music?.title || "";
  const stats = videoData?.statistics || videoData?.stats || {};
  const plays = stats?.play_count || stats?.playCount || 0;

  // Costruisce un contesto dettagliato per Claude
  const tiktokContext = `
[VIDEO TIKTOK RILEVATO]
URL: ${tiktokUrl}
Autore: @${authorName}
Descrizione/Caption: ${title}
Hashtag: ${hashtags}
Musica: ${musicTitle}
Visualizzazioni: ${plays.toLocaleString()}

Analizza queste informazioni e crea un itinerario di viaggio ispirato al contenuto del video. 
Identifica la destinazione dagli hashtag e dalla descrizione, poi crea un itinerario dettagliato.
Se non riesci a identificare la destinazione con certezza, chiedi conferma all'utente.
`;

  const userText = text.replace(tiktokRegex, "").trim();
  const fullContent = userText
    ? `${userText}\n\n${tiktokContext}`
    : tiktokContext;

  const enrichedMessages = [...messages];
  enrichedMessages[enrichedMessages.length - 1] = {
    ...lastMsg,
    content: fullContent,
  };

  console.log("Dati TikTok estratti:", { title, authorName, hashtags });
  return enrichedMessages;
}

// ── Chiama Claude ─────────────────────────────────────────────────────────
function callClaude(messages, existingItinerary, mediaContent) {
  return new Promise((resolve, reject) => {
    const systemPrompt = existingItinerary
      ? `${SYSTEM_PROMPT}\n\nItinerario attuale (modifica SOLO se esplicitamente richiesto):\n${JSON.stringify(existingItinerary).substring(0, 3000)}`
      : SYSTEM_PROMPT;

    const lastUserMsg = messages[messages.length - 1]?.content || "";
    const textContent = typeof lastUserMsg === "string" ? lastUserMsg : "";
    const daysMatch = textContent.match(/(\d+)\s*(giorni|day|notti|notte)/i);
    const requestedDays = daysMatch ? parseInt(daysMatch[1]) : 3;
    const maxTokens = Math.min(10000, Math.max(2000, requestedDays * 600 + 2000));

    // Costruisce messaggi con eventuale media
    let claudeMessages = [...messages];
    if (mediaContent && claudeMessages.length > 0) {
      const lastMsg = claudeMessages[claudeMessages.length - 1];
      const msgText = typeof lastMsg.content === "string" ? lastMsg.content : "";
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
            text: msgText || "Analizza questa immagine e suggerisci un itinerario di viaggio ispirato a ciò che vedi.",
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
          text = text
            .replace(/^```json\s*/i, "")
            .replace(/^```\s*/i, "")
            .replace(/```\s*$/i, "")
            .trim();
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
              activity.coordinates = {
                lat: place.geometry.location.lat,
                lng: place.geometry.location.lng,
              };
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

        // Arricchisce con dati TikTok se presente un link
        const enrichedMessages = await enrichWithTikTok(messages);

        const raw = await callClaude(enrichedMessages, existingItinerary, mediaContent);

        let payload;
        try {
          payload = JSON.parse(raw);
        } catch {
          // Prova a riparare JSON troncato
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
          try {
            payload.itinerary = await enrichWithGooglePlaces(payload.itinerary);
          } catch (e) {
            console.error("Places err:", e.message);
          }
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