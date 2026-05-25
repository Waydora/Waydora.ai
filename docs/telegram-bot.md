# Waydora Telegram Bot — Design Doc

Stato: draft 2026-05-25
Owner: Waydora

## 1. Obiettivo

Portare l'esperienza Waydora dentro Telegram con sync bidirezionale verso lo stesso backend Supabase usato dal web. L'utente deve poter consultare e modificare i propri viaggi (itinerario, bagaglio, meteo, idee, media) da Telegram senza divergenza di stato col sito.

Non-goal: replicare l'UI completa del sito. Il bot è un companion conversazionale + comandi rapidi, non un client alternativo.

## 2. Architettura

```
┌──────────┐      webhook      ┌─────────────────────┐      ┌──────────┐
│ Telegram │ ────────────────▶ │ Railway              │ ───▶ │ Supabase │
│   API    │ ◀──── replies ─── │ telegram-bot service │ ◀─── │  (RLS)   │
└──────────┘                   │ (grammY + Express)   │      └──────────┘
                               │                     │      ┌──────────┐
                               │ Anthropic via       │ ───▶ │ Anthropic│
                               │ shared chat logic   │      └──────────┘
                               └─────────────────────┘
```

Servizio separato `telegram-bot/` su Railway (non dentro `server-standalone.js`), così rate-limit, deploy e crash sono isolati dal backend web. Condivide però i moduli di business logic (build prompt, affiliates, Anthropic client) via import locale.

Webhook mode (no long-polling): Railway espone `POST /telegram/webhook/<secret>`, registrato con `setWebhook`. Secret in path = anti-spoofing base; verifichiamo anche `X-Telegram-Bot-Api-Secret-Token`.

### 2.1 Stack

- Runtime: Node.js 20
- Bot framework: [grammY](https://grammy.dev) — TS-first, plugin sessions, conversations, runner
- HTTP: Express (per condividere middleware con server-standalone se serve)
- DB: `@supabase/supabase-js` con **service role key** (il bot agisce server-side per conto dell'utente bindato)
- AI: stesso client Anthropic + OpenRouter già in uso

### 2.2 Variabili ambiente Railway (nuove)

```
TELEGRAM_BOT_TOKEN
TELEGRAM_WEBHOOK_SECRET        # path segment + header check
TELEGRAM_BIND_TOKEN_SECRET     # HMAC per i deep-link bind token
SUPABASE_SERVICE_ROLE_KEY      # solo lato bot, MAI esposta al frontend
SUPABASE_URL                   # già presente lato frontend, qui serve server
PUBLIC_BOT_USERNAME            # es. WaydoraBot, per generare deep link
```

## 3. Schema DB (migrazione Supabase)

Nuova tabella `telegram_bindings`:

```sql
create table telegram_bindings (
  telegram_user_id  bigint primary key,
  user_id           uuid not null references auth.users(id) on delete cascade,
  telegram_username text,
  language_code     text,
  created_at        timestamptz not null default now(),
  last_seen_at      timestamptz
);

create unique index telegram_bindings_user_id_uniq on telegram_bindings(user_id);
-- un account Supabase = al massimo un Telegram, e viceversa

alter table telegram_bindings enable row level security;
-- nessuna policy: solo service role accede (bot server-side)
```

Bind token: **in-memory Map** sul servizio bot (TTL 10 min, single-use, firma HMAC). Nessuna persistenza — un restart invalida i token pending, accettabile (l'utente rigenera dal sito).

Nessuna modifica a `user_trips` / `saved_trips` / `trip_messages`: il bot scrive lì come se fosse l'utente.

## 4. Auth binding (deep link)

Flusso confermato:

1. Utente loggato su waydora.com apre **Impostazioni → Collega Telegram**.
2. Frontend chiama `POST /api/telegram/bind-token` (nuovo endpoint su server-standalone) con il JWT Supabase.
3. Server verifica JWT → genera `token = base64url(hmac(user_id || nonce || exp, TELEGRAM_BIND_TOKEN_SECRET))`, insert in `telegram_bind_tokens` con `expires_at = now() + 10 min`.
4. Frontend apre `https://t.me/<PUBLIC_BOT_USERNAME>?start=<token>`.
5. Bot riceve `/start <token>`:
   - Verifica HMAC + presenza in `telegram_bind_tokens` + non scaduto + non consumato.
   - Upsert in `telegram_bindings` (`telegram_user_id`, `user_id`, `username`, `lang`).
   - Marca token `consumed_at = now()`.
   - Risponde "Collegato a `<email>` ✅".
6. Da quel momento ogni update Telegram risolve `telegram_user_id → user_id` in cache (LRU 5 min).

Edge cases:
- Token scaduto → "Link scaduto, generane uno nuovo da waydora.com".
- Telegram già bindato ad altro account → richiesta conferma di sostituzione.
- Stesso `user_id` già bindato ad altro Telegram → unique index fallisce → messaggio chiaro.

## 5. Comandi

Comandi strutturati per ridurre token AI (no LLM dove un comando basta).

| Comando | Effetto |
|---|---|
| `/start [token]` | Bind iniziale o saluto |
| `/viaggi` | Lista `user_trips` published+draft con inline keyboard, selezione → trip attivo in session |
| `/viaggio` | Mostra summary trip attivo (titolo, dest, date, hero) |
| `/oggi` | Itinerario del giorno corrente (calcolato da `days` jsonb) |
| `/giorno N` | Itinerario giorno N |
| `/bagaglio` | Lista packing |
| `/aggiungi <item>` | Append a packing |
| `/spunta <item>` | Toggle done |
| `/meteo` | Previsioni destinazione (WeatherAPI) |
| `/idea <testo>` | Append in `trip_messages` type=`idea` |
| `/mappa` | Link Google Maps centrato su destinazione |
| `/foto` (con allegato) | Upload Supabase Storage + ref in trip |
| `/scollega` | Rimuove binding |
| messaggio libero | → Anthropic con contesto trip attivo, risposta + eventuale `ai_update` su `trip_messages` |

Inline keyboard per navigazione (giorni, conferme, scelta trip). `bot.api.setMyCommands` per autocomplete.

## 6. Sync bidirezionale

- **Telegram → web**: bot scrive direttamente su Supabase (service role). Realtime esistente su `trip_messages` e `saved_trips` propaga al sito senza modifiche.
- **Web → Telegram**: opzionale fase 2. Un listener Realtime nel servizio bot ascolta `trip_messages` di trip i cui owner hanno binding attivo, invia push Telegram. Richiede subscription persistente → valutare costo.

Fase 1: solo Telegram → web (push). Fase 2: Realtime → Telegram (pull-then-push).

## 7. Sicurezza

- Service role key SOLO nel processo bot, mai loggata, mai esposta.
- Webhook protetto da secret in path + header `X-Telegram-Bot-Api-Secret-Token`.
- Rate-limit per `telegram_user_id`: 30 messaggi/min (in-memory LRU, no Redis in fase 1).
- HMAC sui bind token, exp 10 min, single-use.
- Logging: niente contenuti messaggi in chiaro in log persistenti; solo `telegram_user_id` + comando + esito.

## 8. Struttura cartelle

```
telegram-bot/
  package.json
  src/
    index.ts              # boot + Express + webhook
    bot.ts                # grammY Bot instance
    auth/
      bind.ts             # /start <token> handler + cache
      session.ts          # middleware per attach user_id + active trip
    commands/
      trips.ts            # /viaggi /viaggio /oggi /giorno
      packing.ts          # /bagaglio /aggiungi /spunta
      weather.ts          # /meteo
      ideas.ts            # /idea
      media.ts            # /foto
      misc.ts             # /scollega /mappa
    ai/
      chat.ts             # bridge a logica Anthropic condivisa
    db/
      supabase.ts         # client service-role
      bindings.ts         # repo telegram_bindings
      trips.ts            # repo user_trips / trip_messages
    util/
      rate-limit.ts
      logger.ts
  tsconfig.json
```

Deploy Railway: nuovo service con `npm start` = `tsx src/index.ts`, healthcheck `/health`.

## 9. Roadmap implementativa

1. **M1 — Skeleton + bind** (questa fase)
   - Migrazione SQL (`telegram_bindings`, `telegram_bind_tokens`)
   - Endpoint `POST /api/telegram/bind-token` su server-standalone
   - UI "Collega Telegram" minimale su pagina account
   - Servizio `telegram-bot/` con `/start <token>` + `/scollega` + healthcheck
   - Deploy Railway + setWebhook
2. **M2 — Lettura**
   - `/viaggi /viaggio /oggi /giorno /bagaglio /meteo /mappa`
   - Sessione attiva per trip selezionato
3. **M3 — Scrittura**
   - `/aggiungi /spunta /idea` con push su Supabase
   - Verifica propagazione realtime sul sito
4. **M4 — AI free-text**
   - Bridge Anthropic con contesto trip
   - Token budget per utente Telegram
5. **M5 — Media**
   - `/foto` → Supabase Storage bucket `trip-media`
6. **M6 — Push web→TG** (opzionale)
   - Listener Realtime

## 10. Aperti / da decidere

- Bucket Supabase Storage per media: nome (`trip-media`?), RLS, naming convention.
- Tier free vs paid: il bot eredita lo stesso limite token del web o ha budget separato?
- Comandi in italiano vs bilingue (rilevazione da `language_code`).
- Inline mode (`@WaydoraBot <query>`) per condividere viaggi in altre chat — fase 3+.
