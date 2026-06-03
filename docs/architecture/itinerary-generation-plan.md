# Piano: ottimizzazione generazione itinerari (token, routing modelli, step-wise)

> Documento di **sola pianificazione**. Nessun codice modificato. Architetto: waydora-bot-dev + waydora-fullstack-dev.
> Data: 2026-06-01.

---

## A. Stato attuale (architettura reale)

### A.1 Le tre implementazioni di `/api/chat` (non due)

L'esplorazione conferma il sospetto ma lo precisa: esistono **tre** copie di logica chat, di cui due vive e una morta.

| # | File | Runtime | Modello "nuovo itinerario" | Timeout | Usato da |
|---|------|---------|----------------------------|---------|----------|
| 1 | `artifacts/waydora/api/chat.js` | Vercel serverless (Hobby) | **Haiku** (`anthropic/claude-haiku-4-5`) | **hard 60s** | Webapp, quando `useRailway=false` |
| 2 | `artifacts/api-server/server-standalone.js` | Railway (Docker, `node server-standalone.js`) | **Sonnet** (`anthropic/claude-sonnet-4-6`) | nessun limite piattaforma; `FETCH_TIMEOUT_MS=50s` self-imposto | Webapp quando `useRailway=true` **e** bot Telegram |
| 3 | `artifacts/api-server/src/routes/chat.ts` (Express) | — | Sonnet via SDK Anthropic diretto (`claude-sonnet-4-20250514`) | `max_tokens: 8192` | **NESSUNO — codice morto** |

Verifiche puntuali:
- `artifacts/api-server/railway.toml:6` → `startCommand = "node server-standalone.js"`. Quindi su Railway gira **solo** `server-standalone.js`. Il router Express (`src/app.ts` → `src/routes/index.ts` → `src/routes/chat.ts`) **non viene mai avviato** per la chat. Il `Dockerfile` copia solo `server-standalone.js`.
- `artifacts/telegram-bot/src/lib/chat-bridge.ts:16` → il bot chiama `${API_SERVER_URL}/api/chat`, cioè la copia #2 (Railway), con `userTier: "paid"`.
- `artifacts/waydora/src/hooks/api.ts:146-148` + `artifacts/waydora/src/lib/affiliates.ts:93-97` → la webapp sceglie Vercel(#1, Haiku) o Railway(#2, Sonnet) tramite `shouldUseRailway(prompt, hasItinerary)`.

**`shouldUseRailway` (affiliates.ts:93):**
- nessun itinerario esistente (creazione) → **Railway/Sonnet**
- edit "pesante" (`HEAVY_EDIT_RX`: aggiungi giorno, rigenera, cambia destinazione…) → **Railway/Sonnet**
- tutto il resto (edit leggero, chat) → **Vercel/Haiku**

> Conseguenza non ovvia: l'affermazione "i nuovi itinerari usano SEMPRE Haiku" è **vera solo per la copia Vercel**. In produzione la webapp instrada le **creazioni** verso Railway/Sonnet. Haiku-su-Vercel serve di fatto solo agli **edit leggeri** e alla chat. Il vincolo 60s morde quindi soprattutto quando un edit "leggero" sfora (raro) o se in futuro si volesse far creare a Vercel.

### A.2 Divergenze tra le due copie vive (#1 Vercel vs #2 Railway)

Le due copie condividono ~90% del codice (stesse funzioni `buildAffiliate`, `inferTransportMode`, `enrichWithGooglePlaces`, `extractJsonPayload`, `fixPastDatesInReply`, stesso `SYSTEM_PROMPT` con minime differenze). Differenze sostanziali:

1. **Modello di creazione** (il cuore): Vercel `chat.js:362-364` → sempre Haiku; Railway `server-standalone.js:481-484` → sempre Sonnet.
2. **Router `routeRequest`**: Railway distingue `edit-small` (Haiku) vs `edit-large`/`create` (Sonnet) con `heavyEditRx` (`server-standalone.js:464-484`). Vercel ha solo `edit`/`consult`/`create-*` tutti Haiku (`chat.js:350-364`).
3. **Token caps**: Vercel `create` = `days*1100+3500`; Railway `create` = `days*2200+5000` (Sonnet, più verboso, tetto più alto).
4. **Affiliate config**: Vercel `AFF` include `TIQETS_URL` (chat.js:31); Railway no. Irrilevante per il flusso.
5. **Rate limiting**: solo Railway lo implementa (in-memory per IP, 20 req/h, `server-standalone.js:131-158`). Vercel si affida ai limiti di piattaforma.
6. **System prompt**: due definizioni quasi identiche ma mantenute a mano in due punti → **rischio drift**. La copia #3 (`itinerary-prompt.ts`) ha invece uno schema **diverso e più ricco** (vedi A.4) ed è quella citata nei test, ma è morta.

**Rischio:** ogni regola di prompt o ogni provider affiliate va aggiornato in 2 (o 3) punti. Già oggi divergono.

### A.3 Cosa è LLM vs Code/API (audit API-offload)

| Dato | Chi lo genera oggi | Dettaglio | Note risparmio |
|------|--------------------|-----------|----------------|
| **Coordinate (lat/lng)** | **API (Google Places)**, NON LLM | Il prompt vieta esplicitamente all'LLM di emettere coordinate (`chat.js:283`, `server-standalone.js:335`). `enrichWithGooglePlaces` (chat.js:559 / server:635) geocoda ogni `city` una volta, poi fa `placesTextSearch(title, cityBias)` per ogni attività, valida entro `MAX_KM_FROM_CITY=50`, e **corregge anche il `title`** col nome ufficiale di Places. Fallback: pin sul centro città. | Già offloadato. **Nessun token da risparmiare** — è già ottimale. |
| **Affiliate** | **Code-side** | `ensureAffiliateOnItinerary` (chat.js:115) sovrascrive SEMPRE `stay` e `transport`, e riempie i mancanti. L'LLM emette comunque un blocco `affiliate` placeholder perché il prompt glielo impone (chat.js:287-313). | **Opportunità reale:** l'LLM scrive ~40-60 token di JSON affiliate per attività che vengono **buttati e riscritti**. Su 7gg × 4 attività ≈ 28 blocchi → ~1.400-1.700 token output sprecati. Rimuovere il blocco `affiliate` dallo schema richiesto (l'LLM emette solo `transportMode` per i transport) e generarlo 100% code-side. |
| **Meteo** | **API (WeatherApi.com)** lato webapp; **MA** lo schema #3 morto ha un campo `weather` per giorno, e la card `DayHeader` lo mostra (`itinerary-results.tsx:173`, `weather` opzionale). | Le copie VIVE (#1/#2) **non chiedono `weather`** all'LLM. Il meteo reale arriva dal `WeatherTool` (home.tsx:164, `lib/weather.ts`) via API. Quindi nel flusso vivo il meteo NON costa token. | Già offloadato nel flusso vivo. Da NON reintrodurre nel prompt. |
| **Foto** | **API (Pexels)** lato client | L'LLM emette solo `tripPhotos` (3-4 query testuali) e, nello schema morto, `photoQuery` per attività. Le immagini vere le scarica `fetchPhoto` (`lib/photos.ts`) da Pexels. | Quasi gratis: `tripPhotos` ≈ 15-25 token totali. Lasciare. |
| **Testo itinerario** (title, summary, description, vibe, packing) | **LLM** | È il valore aggiunto, non offloadabile. | Vedi C (routing) e D (step-wise) per la riduzione. |

**Conclusione audit:** coordinate e meteo sono già su API; foto idem. L'unico vero **token-waste residuo lato schema** è il blocco `affiliate` per-attività (riscritto comunque dal codice). Risparmio stimato: **~1.5-2k token output su un 7gg** (~10-12% dell'output di un itinerario lungo) eliminando l'affiliate dal contratto JSON.

### A.4 Schema di output e rendering (feature-parity baseline)

Lo schema **realmente prodotto** dalle copie vive (chat.js:173-210, server:210-247):
```
{ reply, itinerary: { title, destination, durationDays, vibe, totalBudget,
  bestSeason, heroEmoji, tripPhotos[], days[{ day, title, summary, city,
  activities[{ time, title, description, category, estimatedCost, transportMode?, affiliate{} }] }],
  packingList[{ category, items[] }] } }
```
Differenze schema #3 morto (`itinerary-prompt.ts`): ha `weather` per giorno, `coordinates` OBBLIGATORIE dall'LLM, `photoQuery` per attività, niente `city`, niente `tripPhotos`, niente `transportMode`. **Non usarlo come riferimento** — il contratto vivo è quello di chat.js/server.

**Come il client consuma** (per gli acceptance criteria):
- **Mappa** (`trip-map.tsx:52-71`): legge `day.activities[].coordinates.{lat,lng}`. Salta le attività senza coordinate. Polyline per giorno se ≥2 punti con coordinate. → **coordinate sono il contratto critico mappa**.
- **Calendario webapp** (`home.tsx:118` `CalendarTool`): NON genera `.ics`, genera **deep-link Google Calendar** uno per giorno, parsing `a.time`. Usa `day.activities[].time/title`, `day.summary`.
- **Calendario bot** (`telegram-bot/src/lib/calendar.ts`): genera **vero `.ics`** via libreria `ics`, parsa `time` con `TIME_RX = /(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})/`, usa `coordinates` per `geo`. → **il formato `time` "HH:MM-HH:MM" è contratto critico .ics**.
- **Packing** (`itinerary-results.tsx:250` `PackingList`): legge `packingList[{category, items[]}]`, aggancia link Amazon per categoria.
- **Foto** (`itinerary-results.tsx:196` `TripPhotos`): legge `tripPhotos[]`, fallback su `${destination} landmark/street/food`.
- **Affiliate** (`itinerary-results.tsx:151`): legge `activity.affiliate.{url,label,provider}` + banner Stay22/GoCity/Yesim derivati da `destination`.

**Persistenza** (`hooks/trips.ts`): `chat_sessions` (turns + api_messages + itinerary completo) e `saved_trips` (itinerary + share_slug). Il bot auto-salva ogni itinerario in `saved_trips` (`chat-ai.ts:133`). La webapp salva on-demand (`home.tsx:801 handleSave`) e persiste la sessione a ogni turno con itinerario (`home.tsx:787 persistSession`).

### A.5 Il vincolo Vercel 60s

`chat.js:7-17`: caps tarati su Haiku ~150 tok/s; `FETCH_TIMEOUT_MS=50s` per lasciare 10s a Places+serializzazione; `SONNET_MAX_TOKENS=4000` perché Sonnet ~50 tok/s ⇒ 4000 tok ≈ 80s (già oltre 60s, accettato solo come fallback raro). È il motivo per cui la creazione "vera" è stata spostata su Railway. Vercel resta sul percorso solo per edit leggeri/chat, dove l'output è piccolo.

---

## B. Obiettivi & vincoli

**Obiettivi**
1. **Risparmio token/costo** senza perdita di feature.
2. **Modello giusto per complessità** (DeepSeek/Haiku/Sonnet) misurata oggettivamente.
3. **Viaggi lunghi a step** per stare nei limiti di tempo e tagliare il picco di token per chiamata.

**Feature da PRESERVARE (acceptance gate non negoziabile)**
- Link **affiliate** su ogni attività (code-side, già robusto).
- **Export calendario**: deep-link Google Calendar (webapp) **e** `.ics` reale (bot) → formato `time` "HH:MM-HH:MM".
- **Mappa con coordinate**: ogni attività con `coordinates` valide (via Places).
- **Packing list** strutturata.
- **Foto** (`tripPhotos` + Pexels).
- Banner Stay22/GoCity/Yesim (derivati da `destination`).

**Vincoli**
- Vercel Hobby **60s hard** sul path #1.
- Costo OpenRouter: DeepSeek ≪ Haiku < Sonnet.
- Qualità: POI reali, italiano naturale, JSON valido.
- Si tocca **il cuore in produzione** (sia webapp sia bot passano da qui) → rollout prudente + feature flag.

---

## C. Proposta 1 — Routing modelli per complessità

### C.1 Idea
Estendere `routeRequest` perché scelga **modello** in funzione di una **complessità calcolata**, non solo i token. Oggi la scelta modello è binaria e duplicata (Vercel sempre Haiku; Railway sempre Sonnet per create). Va resa una funzione pura, **condivisa**, testabile.

### C.2 Segnali di complessità (già disponibili nel router)
- `days` (parsed da history, `chat.js:329`) — proxy principale.
- `n. destinazioni`: contare `city` uniche stimando dai messaggi (es. "Atene e Santorini", multi-tappa) → euristica su congiunzioni/virgole + nomi nel dizionario `lib/weather.ts CITY_MAP` (riusabile lato server).
- `kind`: create vs edit-small vs edit-large vs consult vs chat-cheap vs vision (già esiste).
- `tier`: guest/free/paid (cap token).
- `quality-critical`: tier=paid (bot) o flag esplicito → preferire qualità.

`complexityScore = f(days, nDest, isCreate, isHeavyEdit)`. Soglie indicative:
- score basso → DeepSeek/Haiku; score alto → Sonnet (solo dove il timeout non morde, vedi E).

### C.3 Mappa richiesta → modello (raccomandata)

| kind | condizione | modello | dove gira | razionale |
|------|-----------|---------|-----------|-----------|
| `chat-cheap` | saluto/ack, no intent viaggio | **DeepSeek v3.1** | Vercel | banale, 1200 tok, costo minimo |
| `consult` | domanda su itinerario esistente, no edit | **DeepSeek** o Haiku | Vercel | testo breve; DeepSeek se eval ok |
| `edit-small` | sposta/togli/cambia nome | **Haiku** | Vercel | piccolo, veloce, <60s garantito |
| `edit-large` | aggiungi giorno, rigenera | **Sonnet** | Railway | qualità su rigenerazione |
| `create` ≤3gg | nuovo breve | **Haiku** (default) / Sonnet se paid | Railway (o Vercel se Haiku) | Haiku 4.5 ≈ Sonnet su 3gg, 3× più veloce |
| `create` 4-6gg | nuovo medio | **Sonnet** | Railway | qualità POI su durata media |
| `create` ≥7gg o multi-dest | lungo/complesso | **Sonnet + step-wise** (vedi D) | Railway | timeout + token → chunk |
| `vision` | media allegato | **Haiku** (vision) | Vercel | come oggi |

> Punto chiave: **DeepSeek** oggi è dichiarato (`CHEAP_CHAT`) ma usato solo in `chat-cheap`. Proposta: estenderne l'uso a `consult` (e valutare `edit-small`) previa eval (F). Risparmio: DeepSeek costa una frazione di Haiku.

### C.4 Come misurare "complessità" — pseudo-codice
```
function classify({ days, nDest, isCreate, isHeavyEdit, hasMedia, tier }) {
  if (hasMedia) return "vision";
  if (!isCreate && !isHeavyEdit && trivial) return "chat-cheap";
  if (!isCreate && consultOnly) return "consult";
  if (!isCreate && !isHeavyEdit) return "edit-small";
  if (!isCreate && isHeavyEdit) return "edit-large";
  // create
  const score = days + (nDest-1)*2;
  if (score <= 3) return "create-small";
  if (score <= 6) return "create-medium";
  return "create-large"; // → step-wise
}
```
Il mapping `kind → {model, maxTokens, useStepwise}` vive in **un solo modulo** (`lib/itinerary-router`) condiviso da Vercel, Railway e (indirettamente) bot.

---

## D. Proposta 2 — Generazione a step per viaggi lunghi

### D.1 Flusso
1. Richiesta create con `days ≥ N` (soglia da eval, indicativamente 6-7).
2. **Chunk 1**: genera giorni **1-3** completi + **scheletro** dei rimanenti (solo `day`, `title`, `city` stimata, `summary` 1 frase, `activities: []`). Più header itinerario (title, destination, durationDays totale, vibe, budget, bestSeason, heroEmoji, tripPhotos, packingList).
3. Client mostra subito i 3 giorni pieni + i giorni "in arrivo" (placeholder cliccabile "Genera questi giorni").
4. **Chunk 2…**: azione "continua" → genera giorni 4-6 (poi 7-9…), passando come contesto **solo l'header + gli scheletri + l'ultimo giorno pieno** (non l'intero itinerario), riducendo i token di input.
5. **Merge** lato client/server: i giorni nuovi sostituiscono gli scheletri corrispondenti per `day`.

### D.2 Cosa serve
- **Schema esteso (additivo, retro-compatibile):**
  - opzionale `itinerary.meta = { partial: true, generatedDays: [1,2,3], totalDays: 7 }`.
  - i giorni scheletro hanno `activities: []` → mappa/calendario li ignorano già senza crash (trip-map salta day senza coordinate; calendar itera `activities ?? []`).
- **Nuovo intent/azione "continua":** body `{ action: "continue_days", from: 4, to: 6, existingItinerary }`. Il server genera **solo** quei giorni e li restituisce in `itinerary.days` (parziale) con `meta`.
- **Prompt dedicato chunk:** "Genera SOLO i giorni X-Y. Mantieni stile/budget/vibe dell'header fornito. Non ripetere i giorni già generati." → output piccolo, sotto i 60s anche con Sonnet.
- **UI webapp:** sotto l'ultimo giorno pieno, bottone "✨ Genera giorni 4-7" (riusa `QUICK_SUGGESTIONS` pattern, home.tsx:47). Stato `currentItinerary` aggiornato via merge; `persistSession` salva l'itinerario parziale.
- **Bot:** la `buildItineraryKeyboard` (chat-ai.ts:228) mostra già `G1..Gn`; aggiungere bottone "▶️ Genera resto" che invia `continue_days`. Auto-save (`upsertSavedTripFromSession`) già idempotente per sessione → salva il merge.

### D.3 Come risolve 60s e taglia token
- Ogni chiamata produce **≤3 giorni** (~3.000-4.000 token output) ⇒ ben sotto i 60s anche con Sonnet su Vercel; su Railway margine ampio.
- Input ridotto: i chunk successivi NON rispediscono tutto l'itinerario completo come `existingItinerary` (oggi `chat.js:652` tronca a 3000 char) ma solo header+scheletri+ultimo giorno → meno token input ripetuti.
- L'utente che voleva solo "vedere com'è" spesso si ferma a 3 giorni → token dei giorni 4-7 **mai spesi** (risparmio reale on-demand).

### D.4 Salvataggio incrementale, mappa, calendario su parziale
- **`saved_trips`/`chat_sessions`**: salvano l'itinerario corrente (anche parziale). Nessuna migrazione DB necessaria: `itinerary` è JSON. Il merge avviene prima del salvataggio.
- **Mappa**: funziona su parziale (mostra solo i giorni con coordinate). Le coordinate dei nuovi giorni arrivano da `enrichWithGooglePlaces` applicato **solo al chunk nuovo** (meno chiamate Places per richiesta).
- **Calendario/.ics**: itera i giorni presenti; gli scheletri (activities vuote) non producono eventi. Coerente.
- **Idempotenza**: il merge per `day` evita duplicati se l'utente clicca "continua" due volte.

---

## E. Proposta 3 — Gestire il vincolo Vercel 60s

| Opzione | Pro | Contro | Costo |
|---------|-----|--------|-------|
| **(a) Step-wise** (D) | risolve 60s by design; taglia token; nessun upgrade infra; migliora UX (primi giorni subito) | richiede lavoro client+server+bot; nuovo intent | 0 € infra |
| **(b) Spostare TUTTA la creazione su Railway** (già parzialmente fatto via `shouldUseRailway`) | nessun limite 60s; Sonnet pieno; **già la strada di produzione** | Railway single-instance = SPOF e costo always-on; rate-limit in-memory non scala su multi-istanza | costo Railway già sostenuto |
| **(c) Vercel Pro 300s** | fix immediato, zero refactor | 20$/mese/utente team; non taglia token né costo LLM; non migliora UX | ~20$/mese + token pieni |
| **(d) Streaming SSE** | UX (token progressivi); evita "timeout percepito" | il 60s di Vercel resta hard sulla durata totale della function; complica parsing JSON incrementale; non taglia token | 0 € ma rischio JSON |

**Raccomandazione:** **(b) come base già attiva + (a) step-wise per i lunghi.**
- Mantenere la creazione su **Railway/Sonnet** (è già così via `shouldUseRailway`), così il 60s di Vercel **non è sul percorso critico** delle creazioni.
- Introdurre **step-wise** per viaggi lunghi/multi-destinazione: serve sia su Railway (taglio token/costo) sia per rendere **Vercel di nuovo capace di creare** itinerari corti con Haiku in sicurezza (chunk piccoli).
- **Non** comprare Vercel Pro per ora: non riduce costo LLM né migliora UX.
- Streaming: rinviato (nice-to-have UX, non risolve costo).

---

## F. Proposta 4 — Eval & scelta modello (da progettare, non eseguire)

### F.1 Setup
- Script Node che chiama OpenRouter (riusa `callOpenRouter`) iterando su una **matrice modelli × prompt** e salva output JSON + usage + latenza.
- Modelli candidati: `deepseek/deepseek-chat-v3.1`, `anthropic/claude-haiku-4-5`, `anthropic/claude-sonnet-4-6` (+ eventuale `deepseek` reasoning / un Gemini Flash come outsider).
- Eseguire **offline/CI**, mai in produzione. Output in `docs/architecture/eval-results/`.

### F.2 Set di prompt (~18, rappresentativi)
1-3. Create breve (2-3gg): Roma, Lisbona, Tokyo low-budget.
4-6. Create medio (5gg): Andalusia, Croazia famiglia, weekend lungo Parigi coppia.
7-9. Create lungo (7-10gg): Giappone, Grecia multi-isola (multi-dest), road-trip Portogallo.
10-11. Multi-destinazione (stress `city`): Atene+Santorini+Mykonos; Roma+Firenze+Venezia.
12-13. Edit-small: "sposta il museo al pomeriggio"; "togli la cena di giorno 2".
14-15. Edit-large: "aggiungi 2 giorni a Napoli"; "rigenera con budget lusso".
16. Discovery multi-turno (sequenza "vado a Lisbona" → "in 2" → "budget medio").
17. Vision (foto di un posto → itinerario).
18. Gruppo/famiglia con vincoli (bambini, accessibilità).

### F.3 Metriche per riga
- **Validità JSON**: parse al primo colpo (sì/no) + recupero via `extractJsonPayload`.
- **Conformità schema**: presenza campi obbligatori, `category` in enum, `time` matcha `TIME_RX` (gate .ics).
- **Qualità italiano**: rubrica 1-5 (naturalezza, no inglese fuori dai nomi propri).
- **Realismo luoghi**: % attività i cui `title` trovano match Places entro 50km (riusa `placesTextSearch`) → proxy oggettivo di "POI reale".
- **Completezza feature**: ogni attività ha category valida; packing ≥3 categorie; tripPhotos presenti.
- **Costo/1k token** (da pricing OpenRouter) e **costo medio per itinerario**.
- **Latenza** (ms) e **tok/s** → verifica fattibilità 60s.

### F.4 Decisione
Per ogni `kind` scegliere il modello **più economico che supera le soglie** (es. JSON ok ≥98%, italiano ≥4/5, realismo POI ≥85%, latenza chunk <45s). Output: una tabella `kind → model` che alimenta il modulo router (C). Ripetere l'eval a ogni cambio versione modello.

---

## G. Sequenza d'implementazione (step piccoli, reversibili)

> Si tocca il cuore in produzione (webapp **e** bot). Ogni step dietro **feature flag** dove possibile e validato con la **suite E2E Playwright esistente** (feature-parity: affiliate, mappa, calendario, packing, foto).

1. **[Refactor, zero comportamento] Unificare la logica in `lib/`**
   Estrarre `routeRequest`, `buildAffiliate`/`ensureAffiliate`, `enrichWithGooglePlaces`, `extractJsonPayload`, `fixPastDatesInReply`, `SYSTEM_PROMPT` in un modulo condiviso importato da Vercel(#1) e Railway(#2). Eliminare/marcare deprecata la copia morta #3 (`src/routes/chat.ts`). *Verifica:* E2E identici + diff output byte-compatibile su un set di prompt. Reversibile (revert import).

2. **[Token saving, basso rischio] Rimuovere il blocco `affiliate` dal contratto JSON**
   Il prompt non chiede più `affiliate{}` (solo `transportMode` per i transport). `ensureAffiliateOnItinerary` già genera tutto code-side. *Verifica:* E2E "ogni attività ha affiliate.url http"; conteggio affiliate invariato; misurare −token output. Feature flag `LEAN_SCHEMA`. Reversibile.

3. **[Routing] Introdurre la mappa `kind → model` parametrica + DeepSeek su `consult`**
   Dietro flag `MODEL_ROUTING_V2`. Default conservativo = comportamento attuale; flag attiva le nuove scelte. *Verifica:* log `kind/model`, E2E, A/B su costo. Reversibile (flag off).

*(Step successivi: 4. eval F e taratura soglie; 5. step-wise server `continue_days` dietro flag; 6. UI webapp "genera resto"; 7. bottone bot "genera resto"; 8. eventuale streaming.)*

---

## H. Rischi & mitigazioni + Acceptance criteria

### H.1 Rischi
| Rischio | Mitigazione |
|---------|-------------|
| Drift tra le 2 copie peggiora durante il refactor | Step 1 unifica PRIMA di ogni altra modifica; un solo modulo sorgente. |
| Rimuovere `affiliate` dal prompt fa perdere `transportMode` | Tenere `transportMode` esplicito nel prompt; `inferTransportMode` resta come safety-net. |
| DeepSeek peggiora qualità su `consult` | Gate F (eval) prima di attivare; flag reversibile. |
| Step-wise rompe mappa/calendario su parziale | `activities: []` già gestito da client/bot senza crash; test E2E su itinerario parziale. |
| Merge duplica giorni | Merge per chiave `day` (upsert), non append. |
| Sonnet su Vercel sfora 60s | Sonnet resta su Railway; su Vercel solo Haiku + chunk piccoli. |
| Cambio modello degrada italiano/POI | Eval ricorrente + canary (1 flag per kind). |

### H.2 Acceptance criteria (misurabili)
- **Affiliate**: 100% delle attività hanno `affiliate.url` che inizia con `http`; numero affiliate per itinerario **invariato** vs baseline (test E2E + conteggio).
- **Coordinate**: ≥95% attività con `coordinates` valide entro 50km dalla city (oggi garantito da Places + fallback centro città); 0 attività con coordinate mancanti che rompono la mappa.
- **Calendario**: ogni attività con `time` che matcha `HH:MM-HH:MM` → `.ics` del bot valido (parse senza errori) e deep-link Google Calendar generati per ogni giorno.
- **Packing**: ≥3 categorie, ogni categoria con ≥1 item.
- **Foto**: `tripPhotos` presente (≥3) o fallback funzionante.
- **Token**: **−10-15% token output** su itinerario 7gg dopo step 2 (rimozione affiliate dallo schema); **−ulteriore** su lunghi con step-wise (giorni 4-7 generati solo on-demand).
- **Latenza**: ogni **chunk** completa <60s (target <45s) — verificabile via `usage`/log; nessun timeout Vercel su create corte.
- **Costo**: riduzione costo medio/itinerario misurata via eval (F) per i `kind` spostati su DeepSeek.
- **Regressione**: suite E2E Playwright verde (feature-parity totale) su tutti gli step.

---

## Sintesi raccomandazioni

- **Proposta 1 (routing):** un modulo `lib` condiviso con mappa `kind → {model, tokens, stepwise}`; DeepSeek esteso a `consult`, Haiku per edit-small/create-small, Sonnet per create-medium/large ed edit-large; scelta guidata da `complexityScore = days + (nDest-1)*2`.
- **Proposta 2 (step-wise):** chunk di 3 giorni + scheletro, intent `continue_days`, merge per `day`, UI webapp + bottone bot, salvataggio incrementale su JSON esistente (nessuna migrazione DB).
- **Proposta 3 (60s):** mantenere creazione su Railway/Sonnet (già attivo) + step-wise per i lunghi; **no** Vercel Pro, streaming rinviato.
- **Proposta 4 (eval):** ~18 prompt × 3 modelli, metriche JSON/italiano/realismo-POI/costo/latenza, offline, output in `docs/architecture/eval-results/`.

**Primi 3 step consigliati (reversibili):**
1. Unificare la logica chat in `lib/` condiviso (refactor a comportamento invariato; deprecare la copia morta `src/routes/chat.ts`).
2. Rimuovere il blocco `affiliate` dal contratto JSON del prompt (generazione 100% code-side già esistente) → risparmio token immediato, dietro flag `LEAN_SCHEMA`.
3. Introdurre la mappa `kind → model` parametrica con DeepSeek su `consult`, dietro flag `MODEL_ROUTING_V2`.

**Percorso file:** `docs/architecture/itinerary-generation-plan.md`
