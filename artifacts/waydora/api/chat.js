import Anthropic from "@anthropic-ai/sdk";
import https from "https";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const ITINERARY_SYSTEM_PROMPT = `
Sei Waydora, assistente di viaggio italiano.

Rispondi SOLO con JSON valido.
Mai markdown.
Mai testo fuori JSON.

{
  "reply":"2 frasi calde in italiano",
  "itinerary":{
    "title":"max 5 parole",
    "destination":"città",
    "durationDays":2,
    "vibe":"mood viaggio",
    "totalBudget":"€400 totali",
    "bestSeason":"Aprile-Ottobre",
    "heroEmoji":"🏖",
    "days":[
      {
        "day":1,
        "title":"titolo giornata",
        "summary":"frase",
        "weather":"Soleggiato 22C",
        "activities":[
          {
            "time":"09:00",
            "title":"Nome Luogo",
            "description":"frase vivida",
            "category":"food",
            "estimatedCost":"€10",
            "coordinates":{
              "lat":40.85,
              "lng":14.27
            },
            "photoQuery":"napoli pizza italy",
            "affiliate":{
              "provider":"Booking",
              "label":"Prenota",
              "url":"https://www.booking.com/searchresults.html?ss=napoli"
            }
          }
        ]
      }
    ],
    "packingList":[
      {
        "category":"Essenziali",
        "items":["Passaporto"]
      }
    ]
  }
}

REGOLE:
- SOLO luoghi reali
- Coordinate GPS reali
- URL reali
- photoQuery deve SEMPRE includere città + luogo
- Tutto in italiano
- 4 attività massimo
`;

function enrichWithGooglePlaces(itinerary) {
  return new Promise(async (resolve) => {
    const apiKey = process.env.GOOGLE_MAPS_KEY;

    if (!apiKey) {
      resolve(itinerary);
      return;
    }

    for (const day of itinerary.days || []) {
      for (const activity of day.activities || []) {
        try {
          const query = encodeURIComponent(
            `${activity.title} ${itinerary.destination}`
          );

          const url =
            `https://maps.googleapis.com/maps/api/place/textsearch/json` +
            `?query=${query}` +
            `&key=${apiKey}`;

          const data = await new Promise((res, rej) => {
            https
              .get(url, (response) => {
                let raw = "";

                response.on("data", (chunk) => {
                  raw += chunk;
                });

                response.on("end", () => {
                  try {
                    res(JSON.parse(raw));
                  } catch (e) {
                    rej(e);
                  }
                });
              })
              .on("error", rej);
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

            // Nome corretto
            if (place.name) {
              activity.title = place.name;
            }

            // Indirizzo reale
            if (place.formatted_address) {
              activity.description =
                `${activity.description}\n📍 ${place.formatted_address}`;
            }

            // Foto Google Places
            if (place.photos?.[0]?.photo_reference) {
              activity.photoUrl =
                `https://maps.googleapis.com/maps/api/place/photo` +
                `?maxwidth=1200` +
                `&photo_reference=${place.photos[0].photo_reference}` +
                `&key=${apiKey}`;
            }
          }
        } catch (e) {
          console.error("Google Places error:", e.message);
        }
      }
    }

    resolve(itinerary);
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed",
    });
  }

  try {
    const { messages, existingItinerary } = req.body;

    const systemPrompt = existingItinerary
      ? `${ITINERARY_SYSTEM_PROMPT}

Il viaggiatore sta modificando un itinerario esistente.
Modifica SOLO quello che chiede.

${JSON.stringify(existingItinerary).substring(0, 2000)}`
      : ITINERARY_SYSTEM_PROMPT;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2500,
      system: systemPrompt,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    });

    let raw =
      response.content?.[0]?.type === "text"
        ? response.content[0].text
        : "";

    raw = raw
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();

    let payload;

    try {
      payload = JSON.parse(raw);
    } catch (e) {
      console.error("JSON INVALIDO:");
      console.error(raw);

      return res.status(502).json({
        error: "Risposta AI non valida",
      });
    }

    // ENRICH GOOGLE PLACES
    payload.itinerary = await enrichWithGooglePlaces(
      payload.itinerary
    );

    if (!payload.reply || !payload.itinerary) {
      return res.status(502).json({
        error: "Risposta incompleta",
      });
    }

    return res.status(200).json(payload);
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      error: "Qualcosa è andato storto",
    });
  }
}