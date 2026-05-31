# Waydora — Tracking Plan & Analytics Spec

> Autore: ruolo **"waydora-analytics"** · Data: **31 maggio 2026**
> Vincoli del ruolo: **privacy-first / GDPR** (mercato Italia/EU), niente PII non necessaria, anonimizzazione, consenso. Ogni metrica → una decisione (no vanity metrics).
> Questo documento è una **SPEC per i dev**: NON implementa codice, NON committa, NON deploya. Si appoggia a `docs/marketing/funnel-strategy.md` (North Star = **Weekly Active Group Trips**) e a `docs/marketing/market-analysis.md` (target Italia 20-34, loop virale di gruppo, fossato Telegram).
> Stato attuale verificato nel codice: **nessun tool di analytics installato** (`grep posthog|plausible|mixpanel|gtag` → solo riferimenti in `legal.tsx`/lockfile). Si parte da zero, niente migrazione.

---

## 1. North Star & metriche di supporto

### North Star — Weekly Active Group Trips (WAGT)

**Definizione operativa:** numero di **viaggi distinti** (`trip_id` / `share_slug`) che, in una **finestra rolling di 7 giorni**, hanno avuto **almeno 2 collaboratori distinti attivi** (almeno un'azione di contributo a testa).

**Come si calcola dagli eventi** (tutti gli eventi qui sotto portano `share_slug` hashed + `actor_id`):
- Un trip "conta" nella settimana W se:
  - `COUNT(DISTINCT actor_id)` su `{ shared_link_opened, collaborator_joined, idea_added, media_added, trip_message_sent, trip_ai_edit }` con lo stesso `share_slug` **≥ 2** nella finestra 7g, **e**
  - almeno uno di questi attori è **diverso** dall'owner (`owner_id` portato come property → distingue "attivo di gruppo" da "owner che lavora da solo").
- Formula PostHog: trends su `idea_added/media_added/collaborator_joined/shared_link_opened/trip_message_sent`, **unique by `share_slug`**, con filtro HogQL `distinct actors ≥ 2`.

> Perché così: cattura attivazione (il viaggio esiste), valore (è di gruppo) e referral (≥2 persone) in un colpo solo — coerente con §0/§8 di funnel-strategy. Esclude di proposito "utenti registrati" (vanity metric per un prodotto a loop di gruppo).

### Metriche di supporto (max 5, ognuna legata a una decisione)

| Metrica | Calcolo dagli eventi | Decisione che guida |
|---|---|---|
| **Activation rate** | utenti con `first_itinerary_generated` / utenti con `landing_viewed`∪`bot_started` (nuovi) | passare di fase (target Launch >40%); se basso → lavorare su prompt pre-compilati/zero-login (esp. #1/#2) |
| **TTV mediano (time-to-value)** | mediana `first_itinerary_generated.ts − sessione.first_seen.ts` | validare il "<60s"; se alto → ridurre frizione ingresso |
| **k-factor** | `(invite_sent + trip_shared) per utente attivante × (collaborator_joined / shared_link_opened)` | quando il loop "gira" (≥0.5 Launch) → aprire Fase 2 |
| **% viaggi di gruppo** | trip con `collaborator_joined ≥1` / trip totali (`trip_saved`) | salute del loop nativo; input diretto a WAGT |
| **Retention D7/D30 (segmentata bot sì/no)** | utenti con `return_visit` o `bot_command_used` in D7/D30, segmentati per `telegram_bind_completed` | validare l'ipotesi "chi collega il bot ritiene meglio" → priorità su acquisizione bind |

---

## 2. Scelta strumento

| Criterio | **PostHog (EU Cloud)** | **Plausible (EU)** |
|---|---|---|
| Modello | Event-based product analytics | Pageview/web analytics aggregato |
| Funnel multi-step | Sì (nativi, AARRR) | No (solo goal/pageview) |
| Eventi server-side (bot) | Sì (SDK Node + Capture API, `distinct_id` arbitrario) | Molto limitato (Events API basica, no identity merge) |
| Identity / merge anon→login | Sì (`identify`, `alias`, person merge) | No |
| Cross-channel web↔bot | Sì (stesso `distinct_id`) | No |
| GDPR / EU hosting | Sì (EU Cloud Francoforte) o self-host | Sì (EU, cookieless by design) |
| Peso/privacy sito vetrina | Più pesante, richiede consenso | Leggerissimo, cookieless, no consenso necessario |

### Raccomandazione

**PostHog EU Cloud come strumento primario di product analytics** per la webapp + il bot Telegram (eventi server-side). Motivo: il cuore di tutto ciò che funnel-strategy chiede di misurare — funnel AARRR multi-step, k-factor, activation, **identity cross-channel web↔bot**, eventi server-side dal bot — è fattibile solo con un tool event-based con merge di identità. Plausible non sa fare funnel né collegare un evento del bot allo stesso utente del web. EU Cloud copre il vincolo GDPR (DPA disponibile, hosting UE) senza dover gestire l'infra self-host in fase early.

**Plausible (opzionale, Fase 2) solo per il sito vetrina / pagine SEO itinerari**: misura pageview/sorgenti delle pagine evergreen senza consenso e senza appesantire (cookieless), tenendo PostHog per il prodotto loggato. Non è bloccante: in Fase 1 si può fare tutto con PostHog (l'autocapture pageview copre la vetrina), e si valuta Plausible se le pagine SEO crescono e si vuole un dato pubblico/leggero separato.

> Decisione: **PostHog EU Cloud da subito** (web + server bot). Plausible **rinviato** a quando esistono pagine SEO da misurare separatamente.

---

## 3. Tracking plan — tabella eventi

Convenzioni:
- **Naming:** `snake_case`, verbo al passato dove ha senso.
- **Proprietà comuni** su (quasi) ogni evento: `channel` (`web` | `telegram`), `source` (utm/referrer/`start` param), `is_authenticated` (bool), `distinct_id` (vedi §4). Niente PII libera.
- **`share_slug` → SEMPRE hashed** lato client/server prima dell'invio (`sha256(slug)` troncato), così l'analytics non riceve l'identificatore che apre il viaggio pubblico. `trip_id` (UUID Supabase) può viaggiare in chiaro (non è un secret di accesso).
- **Anchor** = punto reale nel codice dove agganciare la call.

### Acquisizione / ingresso

| Evento | Quando | Dove | Proprietà (tipo) | Stage / decisione | Anchor reale |
|---|---|---|---|---|---|
| `landing_viewed` | Render della landing | web | `source:string`, `utm_*:string?`, `referrer:string?` | Acquisition · mix sorgente | `home.tsx` ramo `if (showLanding)` (riga ~800), o autocapture pageview |
| `prompt_submitted_anon` | Invio del primo prompt **senza login** | web | `source:string`, `from_suggestion:bool`, `prompt_len:int`, `is_group_hint:bool` | Acquisition→Activation · zero-login funziona? | `home.tsx` `handleSubmit` (riga 708) quando `!user`; `HeroLanding onSubmit` (805) e `SuggestedTrips onSelect` (806) → `from_suggestion=true` |
| `bot_started` | `/start` ricevuto dal bot | telegram/server | `has_start_param:bool`, `already_bound:bool` | Acquisition (bot come hook) | `bot.ts` `bot.command("start")` (riga 63) |

> Nota privacy: NON mandare il testo del prompt. Mandare `prompt_len` e una euristica booleana `is_group_hint` (match su "amici/gruppo/comitiva/in N") calcolata client-side.

### Attivazione

| Evento | Quando | Dove | Proprietà | Stage / decisione | Anchor reale |
|---|---|---|---|---|---|
| `chat_started` | Primo turno di chat in una sessione | web/telegram | `channel`, `is_authenticated`, `entry:('hero'|'suggestion'|'sidebar'|'bot_freetext')` | Activation (inizio funnel) | web: `handleSubmit` primo turno; bot: `chat-ai.ts` `message:text` (riga 11) primo messaggio della sessione |
| **`first_itinerary_generated`** *(AHA)* | La risposta AI contiene un itinerario per la **prima volta** in quella sessione | web/telegram | `channel`, `is_authenticated`, `destination_country:string?`, `duration_days:int`, `used_railway:bool`, `ttv_ms:int` | Activation · **AHA moment** (NSM upstream) | web: `handleSubmit` → `onSuccess` quando `data.itinerary` (riga 732/735); bot: `chat-ai.ts` quando `resp.itinerary` (riga 95) |
| `itinerary_viewed` | L'utente apre/visualizza un itinerario salvato o condiviso | web | `channel`, `is_owner:bool`, `trip_id`, `share_slug_hash` | Activation/Referral · valore percepito | `trip.tsx` caricamento riuscito viaggio (riga 639-643, dentro `.then` quando `data.itinerary`) |
| `trip_saved` | Salvataggio itinerario su `saved_trips` | web/server | `channel`, `trip_id`, `share_slug_hash`, `auto_saved:bool` | Activation→Referral · denominatore "% viaggi di gruppo" | web: `handleSave`→`saveItinerary` ritorna (`home.tsx` 753 / `trips.ts` `saveItinerary` 230); bot (auto): `chat-ai.ts` `upsertSavedTripFromSession` (riga 100) → `auto_saved=true` |

> `destination_country` derivato lato client da `itinerary.destination` (solo il **paese**, non la stringa libera) per evitare PII/dati superflui.

### Collaborazione / referral (il motore di crescita)

| Evento | Quando | Dove | Proprietà | Stage / decisione | Anchor reale |
|---|---|---|---|---|---|
| `trip_shared` | Copia link viaggio / share | web | `trip_id`, `share_slug_hash`, `method:('copy'|'native_share')` | Referral · numeratore k-factor | `trip.tsx` `copy()` (riga 672); + futuro pulsante "condividi su Telegram/WhatsApp" (esp. #4) |
| `invite_sent` | Invio esplicito di un invito (deep-link TG/WA) | web | `trip_id`, `share_slug_hash`, `target:('telegram'|'whatsapp'|'link')` | Referral · inviti/utente (k-factor) | **da creare** con la CTA "Aggiungi amici" (esp. #4, oggi non esiste un pulsante invito dedicato) |
| `shared_link_opened` | Apertura di `/trip/:slug` da parte di un non-owner | web | `trip_id`, `share_slug_hash`, `is_authenticated`, `is_owner:false` | Referral · invite acceptance (denom.) | `trip.tsx` mount con `slug` (riga 624-645); distinguere owner via sessione |
| `collaborator_joined` | Un utente diverso dall'owner contribuisce per la 1ª volta a quel trip | web | `trip_id`, `share_slug_hash`, `is_authenticated`, `via:('idea'|'message'|'media'|'ai_edit')` | Referral · % viaggi di gruppo · **input WAGT** | `trip.tsx` primo `sendMsg`/`IdeasPanel.add`/media upload con `actor_id ≠ owner_id` (rige 192, 365) |
| `idea_added` | Inserimento idea condivisa | web/server | `trip_id`, `share_slug_hash`, `is_authenticated`, `channel` | Referral/Engagement · attività di gruppo (WAGT) | web: `IdeasPanel.add` insert `type:"idea"` (`trip.tsx` 365); bot: `commands/ideas.ts` (handler `/idea`) |
| `media_added` | Caricamento media nel viaggio | web/server | `trip_id`, `share_slug_hash`, `count:int`, `channel` | Retention/Referral · UGC (WAGT) | web: `MediaTool onUpload` (`home.tsx` 218) + panel media `trip.tsx`; bot: `commands/media.ts` |
| `trip_message_sent` | Messaggio nella chat collaborativa del viaggio | web | `trip_id`, `share_slug_hash`, `msg_type:('message'|'ai_request'|'ai_update')` | Engagement di gruppo (WAGT) | `trip.tsx` `sendMsg` insert (riga 192) |
| `trip_ai_edit` | Modifica itinerario via AI dentro il viaggio condiviso | web | `trip_id`, `share_slug_hash`, `used_railway:bool` | Engagement · valore collaborativo | `trip.tsx` `sendAi` quando aggiorna `saved_trips` (riga 229-238) |

### Retention

| Evento | Quando | Dove | Proprietà | Stage / decisione | Anchor reale |
|---|---|---|---|---|---|
| `trip_reminder_sent` | Il bot invia un reminder schedulato | server | `trip_id?`, `reminder_kind:('manual'|'pre_trip'|'daily'|'post_trip')` | Retention · cadenza reminder utile | `reminders.ts` `tick()` dopo `bot.api.sendMessage` (riga 51) |
| `trip_reminder_opened` | L'utente reagisce/clicca un reminder | server | `trip_id?`, `reminder_kind` | Retention · CTR reminder (anti-spam check) | callback/inline button sui messaggi reminder (**da aggiungere** ai reminder, oggi sono testo semplice) |
| `return_visit` | Sessione di un utente già visto > 24h dopo l'ultima | web/server | `channel`, `days_since_last:int` | Retention D7/D30 | derivato in PostHog (no call dedicata) oppure tag su `chat_started` con flag |
| `bot_command_used` | Esecuzione di un comando bot | telegram/server | `command:string`, `is_paid:bool` | Retention strutturale (bot collegato) | `bot.ts` middleware dopo binding (riga 128) o per-handler in `commands/*` |

### Revenue

| Evento | Quando | Dove | Proprietà | Stage / decisione | Anchor reale |
|---|---|---|---|---|---|
| `affiliate_link_clicked` | Click su link affiliate nell'itinerario | web | `provider:string`, `category:('experience'|'stay'|'flight'|'esim')`, `trip_id?`, `destination_country?` | Revenue · CTR click-out (baseline affiliazioni) | link renderizzati con `rel="sponsored"`: `renderWithLinks` (`home.tsx` 409-413), `ItineraryResults`, providers da `lib/affiliates.ts` (`AFFILIATES`) |
| `premium_viewed` | Visualizzazione del paywall/soft-paywall | web | `trigger:('trip_limit'|'group_size'|'export'|'ai_limit')` | Revenue · dove si tocca il limite | **da creare** con il soft-paywall (esp. #15, non ancora a codice) |
| `premium_started` | Avvio checkout/subscription | web | `plan:('monthly'|'annual')`, `trigger:string` | Revenue · conversione free→paying | **da creare** col flusso pagamento |

### Account / identità

| Evento | Quando | Dove | Proprietà | Stage / decisione | Anchor reale |
|---|---|---|---|---|---|
| `signup` | Registrazione completata | web | `method:('email'|'google')` | Activation/Account · cattura account post-valore | `auth.ts` `signupWithEmail` (riga 44) + `onAuthStateChange` evento `SIGNED_IN` su nuovo utente (riga 17) |
| `login` | Login completato | web | `method:('email'|'google')` | Account | `auth.ts` `loginWithEmail`/`loginWithGoogle` (39/27) |
| `telegram_bind_completed` | Binding account↔Telegram riuscito | server | `tier:('free'|'paid')` | Retention · proxy lock-in (segmenta D7/D30) | `bot.ts` `tryBind`→`upsertBinding` ok (riga 43-50); identico evento dal callback widget `bind-callback` |

---

## 4. Identity & cross-channel

**Principio:** un solo `distinct_id` per persona attraverso web e bot = `user_id` Supabase (UUID). Questo è la chiave di tutto il merge.

### Web
- Utente **loggato:** `posthog.identify(user_id)` al `SIGNED_IN` (`auth.ts` `onAuthStateChange`, riga 17). Su `set` person properties solo non-PII: `created_at`, `auth_method`, `has_telegram` (bool). **Niente email/nome nelle person properties** (vedi §5).
- Utente **anonimo (pre-login):** PostHog assegna un `distinct_id` anonimo (cookie/localStorage). Gli eventi `landing_viewed`, `prompt_submitted_anon`, `first_itinerary_generated` (guest) restano legati a quell'anon id.
- **Merge all'identificazione:** quando l'anonimo fa login/signup, `posthog.identify(user_id)` esegue il **merge automatico** dell'anon id sulla persona reale → l'aha generato da guest resta attribuito allo stesso utente (fondamentale per misurare TTV e activation reali). Nota: oggi gli utenti guest usano `localStorage waydora_sessions` (`useLocalSessions` in `trips.ts`) — il merge PostHog è l'analogo lato analytics.

### Bot Telegram
- L'evento del bot deve usare **lo stesso `distinct_id = user_id`**, non il `telegram_user_id`.
- **Meccanismo di bind reale:** il bot mappa `telegram_user_id → user_id` nella tabella `telegram_bindings` (`lib/bindings.ts`). Il binding nasce da un token one-shot HMAC emesso dal web (`lib/bind-tokens.ts` `issueBindToken`, endpoint `/api/telegram/bind-token` chiamato da `connect-telegram-button.tsx`) e consumato in `bot.ts` `tryBind` → `upsertBinding`.
- In ogni handler bot, `ctx.binding.user_id` è già disponibile dopo il middleware (`bot.ts` riga 128). **Spec:** la `capture` server-side usa `distinct_id = ctx.binding.user_id`. Così un `idea_added` da Telegram e uno dal web finiscono sulla **stessa persona** → cross-channel risolto.
- **Utente bot non ancora bound:** è bloccato dal middleware (`bot.ts` 112-116) tranne `/start` e `/bind`. Per `bot_started` pre-binding usare `distinct_id = "tg:" + telegram_user_id` (anon namespaced); su `telegram_bind_completed` chiamare `posthog.alias("tg:"+telegram_user_id, user_id)` per ricucire gli eventi pre-bind sulla persona. **Non** mandare `telegram_username` come property (è PII).

---

## 5. GDPR / consenso (Italia/EU)

1. **Banner consenso (web):** PostHog **non parte** finché non c'è opt-in esplicito per "analytics". Implementazione: `posthog.init(..., { opt_out_capturing_by_default: true })`; su consenso → `posthog.opt_in_capturing()`; su rifiuto → resta opt-out (nessun cookie/evento). Categoria separata da "necessari".
2. **IP anonimizzato:** PostHog EU Cloud → disabilitare geo-IP fine o configurare `property_blacklist`/`$ip` discard; in ogni caso non conservare l'IP grezzo. Usare solo `destination_country` (derivato, non geolocalizzazione utente).
3. **Niente PII non necessaria:** mai inviare email, nome, `telegram_username`, testo dei prompt/messaggi, contenuto idee/media. Solo id tecnici (`user_id`, `trip_id`), `share_slug` **hashed**, conteggi, enum, booleani, lunghezze.
4. **Diritto all'oblio:** su cancellazione account, chiamare l'API PostHog di delete-person per `user_id` (collegabile al flusso di delete Supabase).
5. **Eventi server-side del bot:** sono il punto delicato. Il bot è riservato al piano Pro e richiede un binding esplicito iniziato dall'utente dal web → si tratta l'**attivazione del bot come consenso contestuale al tracciamento funzionale del bot**, ma:
   - documentare nella privacy policy (`legal.tsx`) che l'uso del bot genera eventi di prodotto pseudonimizzati;
   - rispettare comunque la scelta analytics fatta sul web: se l'utente ha rifiutato analytics, propagare un flag `analytics_opt_out` sulla persona/binding e **non** fare `capture` server-side per quegli eventi (solo gli eventi strettamente funzionali, es. reminder, restano lato DB senza finire in PostHog).
   - i reminder (`trip_reminder_sent`) sono già azionabili e devono avere opt-out lato bot (comando per silenziare, previsto in funnel-strategy §5).

---

## 6. Spec implementazione per i dev

> Solo punti d'aggancio. Nessun codice qui.

### `fullstack-dev` (webapp `artifacts/waydora`)
1. **Init SDK:** aggiungere `posthog-js`, init in `src/main.tsx`/root provider con host EU (`https://eu.i.posthog.com`), `opt_out_capturing_by_default:true`, autocapture pageview ON (copre `landing_viewed` e la vetrina).
2. **Wrapper di tracking:** creare `src/lib/analytics.ts` con `track(event, props)`, `identify(userId, props)`, `optIn()/optOut()`, e un helper `hashSlug(slug)` (sha256 troncato). Tutti gli eventi passano da qui (single choke-point per scrubbing PII e per il gating sul consenso).
3. **Banner consenso:** componente cookie/consent (categoria "analytics") che chiama `optIn()/optOut()`.
4. **Punti di chiamata (anchor §3):**
   - `home.tsx`: `handleSubmit` (708) → `chat_started` / `prompt_submitted_anon`; `onSuccess` con `data.itinerary` (732) → `first_itinerary_generated` (+ `ttv_ms`); `handleSave` (750) → `trip_saved`; render `showLanding` (800) → `landing_viewed`; click su `WELCOME_PROMPTS`/`SuggestedTrips` → `from_suggestion=true`.
   - `trip.tsx`: mount con slug (624) → `shared_link_opened`/`itinerary_viewed`; `copy()` (672) → `trip_shared`; `sendMsg` (192) → `trip_message_sent` (+ logica `collaborator_joined`); `sendAi` update (229) → `trip_ai_edit`; `IdeasPanel.add` (365) → `idea_added`; media panel → `media_added`.
   - `auth.ts`: `onAuthStateChange` (17) → `identify` + `signup`/`login`; gestire **merge anonimo** chiamando `identify` PRIMA di scollegare l'anon id.
   - itinerary affiliate links (`renderWithLinks` 409, `ItineraryResults`, `lib/affiliates.ts`) → `affiliate_link_clicked` su `onClick` con `provider/category`.
5. **Owner detection per `collaborator_joined`:** confrontare `actor_id` (user loggato o `waydora_guest_name` hashed) con l'`owner_id` del `saved_trips` row; emettere `collaborator_joined` solo al primo contributo di un attore ≠ owner.

### `bot-dev` (bot `artifacts/telegram-bot`)
1. **SDK server-side:** aggiungere `posthog-node`, singleton in `src/lib/analytics.ts` (capture + flush; `posthog.shutdown()` su SIGTERM). Host EU, no PII.
2. **Identity:** ogni `capture` usa `distinct_id = ctx.binding.user_id` (disponibile dopo middleware `bot.ts` 128). Pre-bind: `distinct_id = "tg:"+telegram_user_id`; su bind riuscito `alias` → `user_id`.
3. **Punti di chiamata (anchor §3):**
   - `bot.ts`: `command("start")` (63) → `bot_started`; `tryBind` ok (43) e `bind-callback` → `telegram_bind_completed`; middleware (128) → `bot_command_used`.
   - `commands/chat-ai.ts`: `message:text` primo turno → `chat_started`; quando `resp.itinerary` (95) → `first_itinerary_generated (channel=telegram)`; `upsertSavedTripFromSession` (100) → `trip_saved (auto_saved=true)`.
   - `commands/ideas.ts` → `idea_added (channel=telegram)`; `commands/media.ts` → `media_added`.
   - `lib/reminders.ts`: dopo `bot.api.sendMessage` in `tick()` (51) → `trip_reminder_sent`; aggiungere inline button per `trip_reminder_opened`.
4. **Gating consenso:** se la persona ha `analytics_opt_out`, saltare la `capture` (eventi funzionali DB restano).

### Eventi che richiedono prima lavoro di prodotto (non solo tracking)
- `invite_sent` → dipende dalla CTA "Aggiungi amici" / share Telegram (esp. #4 funnel-strategy).
- `premium_viewed` / `premium_started` → dipende dal soft-paywall + checkout (esp. #15, non ancora a codice).
- `trip_reminder_opened` → richiede inline button sui reminder (oggi testo semplice).

---

## 7. Dashboard / funnel KPI (in PostHog)

Creare un progetto **Waydora — Product** con questi insight, mappati 1:1 sugli stage di funnel-strategy §8:

1. **Funnel Activation (critico):** `landing_viewed`/`bot_started` → `chat_started` → `first_itinerary_generated` → `trip_saved`. Breakdown per `channel` e `source` (TikTok/TG/SEO/referral). Target Launch: activation >40%.
2. **Funnel Referral / loop:** `first_itinerary_generated` → `trip_shared`/`invite_sent` → `shared_link_opened` → `collaborator_joined`. Da qui il **k-factor** (target ≥0.5 Launch). + insight "% viaggi di gruppo" (`collaborator_joined≥1` / `trip_saved`).
3. **Dashboard North Star (WAGT):** insight weekly su trip con ≥2 attori distinti (HogQL su `share_slug`), con trend e segmentazione per `is_group`. È la tile in cima.
4. **Retention:** retention chart D7/D30 ancorata a `first_itinerary_generated`, **segmentata per `telegram_bind_completed`** (validare l'ipotesi bot→retention). + trend `trip_reminder_sent` vs `trip_reminder_opened` (CTR reminder, anti-spam).
5. **Revenue:** trend `affiliate_link_clicked` per `provider/category` (baseline CTR click-out, oggi mancante); funnel `premium_viewed` → `premium_started` (conversione free→paying, target 1-2% Launch).
6. **Acquisition mix:** breakdown di `landing_viewed`/`bot_started` per `source` (target Launch: TikTok+TG >60%).

Target numerici già definiti nella tabella §8 di `funnel-strategy.md` — le dashboard li rendono leggibili per fase (Pre-launch / Launch / Scale).

---

## 8. Sequenza di implementazione

**Bloccante #1 (funnel-strategy §10):** sbloccare l'analytics prima di tutto il resto, perché senza misura activation/k-factor/retention non sono valutabili.

1. **Setup base + consenso:** init PostHog EU (web), wrapper `analytics.ts` + `hashSlug`, banner consenso, `identify` su login con merge anonimo. (Niente eventi finché c'è il choke-point + consenso.)
2. **Percorso critico / AHA:** `landing_viewed`, `prompt_submitted_anon`, `chat_started`, **`first_itinerary_generated`** (web), `trip_saved`. → abilita Activation funnel + TTV (la prima cosa che serve a marketing).
3. **Referral loop:** `trip_shared`, `shared_link_opened`, `collaborator_joined`, `idea_added`, `media_added`. → abilita k-factor + % viaggi di gruppo + base WAGT.
4. **Bot server-side:** SDK `posthog-node`, identity via `ctx.binding.user_id`, `bot_started`, `first_itinerary_generated (telegram)`, `telegram_bind_completed`, `bot_command_used`. → completa cross-channel e la segmentazione retention bot.
5. **Retention & account:** `return_visit` (derivato), `signup`/`login`, `trip_reminder_sent`, poi `trip_reminder_opened` (quando i reminder avranno button).
6. **Revenue:** `affiliate_link_clicked` (subito misurabile, baseline affiliazioni mancante), poi `premium_viewed`/`premium_started` quando il paywall esiste.
7. **(Fase 2) Plausible** sulle pagine SEO vetrina, se separare il dato leggero diventa utile.

---

## Riassunto

- **Strumento scelto:** **PostHog EU Cloud** per web + bot Telegram (eventi server-side). Motivo: solo un tool event-based con funnel multi-step e **merge di identità** può misurare activation/k-factor/WAGT e collegare lo stesso utente tra web e bot; EU Cloud copre il GDPR senza gestire self-host. Plausible è rinviato (Fase 2) per le sole pagine SEO vetrina.
- **Eventi del percorso critico:** `landing_viewed`/`bot_started` → `prompt_submitted_anon`/`chat_started` → **`first_itinerary_generated` (AHA)** → `trip_saved` → loop di referral (`trip_shared`, `shared_link_opened`, `collaborator_joined`, `idea_added`, `media_added`). Identità unificata su `user_id` Supabase via il binding reale `telegram_bindings` (`lib/bindings.ts` + `lib/bind-tokens.ts`).
- **Prima cosa che i dev devono implementare:** il **setup base con consenso** (init PostHog EU + wrapper `src/lib/analytics.ts` con `hashSlug` + banner consenso + `identify`/merge anonimo su login in `auth.ts`), poi **`first_itinerary_generated`** in `home.tsx` `handleSubmit→onSuccess` — è l'evento AHA che sblocca activation rate, TTV e l'intero funnel.
- **File prodotto:** `docs/analytics/tracking-plan.md`
