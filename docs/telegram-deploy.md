# Deploy Bot Telegram — Guida pratica

Tempo stimato: 30–45 minuti. Fai i passi NELL'ORDINE.

---

## 1. Crea il bot su @BotFather

Su Telegram cerca `@BotFather` → start.

```
/newbot
```

BotFather chiede:
- **Nome visibile** (es. `Waydora Travel`) — modificabile dopo
- **Username** che DEVE finire con `bot` (es. `WaydoraTravelBot`)

Riceverai:
```
Use this token to access the HTTP API:
1234567890:AAH...   ← QUESTO È IL TUO TELEGRAM_BOT_TOKEN
```

Conserva sia il **token** sia lo **username** (senza la @).

Opzionale ma consigliato:
```
/setdescription   → "Assistente di viaggio Waydora — costruisce itinerari, meteo, idee e reminder."
/setabouttext     → "Waydora dentro Telegram. Solo per utenti registrati."
/setuserpic       → carica logo Waydora
/setprivacy       → Disable  (così il bot vede tutti i messaggi nei gruppi se servisse in futuro)
```

NON serve `/setcommands` su BotFather: lo fa il bot in automatico al boot via `setMyCommands`.

---

## 2. Genera i secret

Genera due stringhe casuali lunghe (32+ char). Su Mac/Linux:

```bash
openssl rand -base64 32   # → TELEGRAM_WEBHOOK_SECRET
openssl rand -base64 32   # → TELEGRAM_BIND_TOKEN_SECRET
```

Su Windows PowerShell (eseguilo DUE volte):
```powershell
$b = New-Object byte[] 32; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); [Convert]::ToBase64String($b)
```

Alternativa semplice (alfanumerica):
```powershell
-join ((48..57)+(65..90)+(97..122) | Get-Random -Count 48 | ForEach-Object {[char]$_})
```

Devono essere DIVERSE.

---

## 3. Esegui le migration su Supabase

Dashboard Supabase → progetto Waydora → **SQL Editor** → New query → incolla e Run:

### Query 1 — bindings
Copia integralmente da `migrations/001_telegram_bindings.sql`.

### Query 2 — reminders
Copia integralmente da `migrations/002_telegram_reminders.sql`.

### Query 3 — Realtime publication
```sql
alter publication supabase_realtime add table public.user_trips;
alter publication supabase_realtime add table public.trip_messages;
```
Se ricevi "relation is already member of publication" va bene: significa che è già abilitato.

### Recupera la Service Role Key
Project Settings → API → **service_role secret** (sotto a anon key). Copiala — la userai a step 5.

⚠️ Non condividerla mai col frontend. Solo nel servizio bot Railway.

---

## 4. Crea il servizio Railway per il bot

Hai due opzioni:

### Opzione A — Stesso repo, servizio separato (consigliata)
1. Railway dashboard → progetto Waydora → **+ New** → **GitHub Repo** → stesso repo
2. Settings del nuovo service:
   - **Root Directory**: `artifacts/telegram-bot`
   - **Builder**: Dockerfile (auto-rilevato dal `Dockerfile` presente)
3. Naming: rinomina il service in `waydora-telegram-bot`

### Opzione B — Repo separato
Solo se vuoi tenere il bot in un repo dedicato. Più complesso, non consigliato ora.

### Ottieni l'URL pubblico
Settings → **Networking** → **Generate Domain**. Esempio: `waydora-telegram-bot-production.up.railway.app`. Salvalo: sarà il tuo `PUBLIC_BOT_URL`.

---

## 5. Imposta le env var su Railway

Nel service `waydora-telegram-bot`, tab **Variables**, aggiungi:

| Variabile | Valore |
|---|---|
| `TELEGRAM_BOT_TOKEN` | token da BotFather (step 1) |
| `TELEGRAM_WEBHOOK_SECRET` | primo secret (step 2) |
| `TELEGRAM_BIND_TOKEN_SECRET` | secondo secret (step 2) |
| `PUBLIC_BOT_USERNAME` | username senza @ (es. `WaydoraTravelBot`) |
| `PUBLIC_BOT_URL` | URL Railway del bot (step 4) |
| `SUPABASE_URL` | stessa URL già in Vercel (`https://xxx.supabase.co`) |
| `SUPABASE_SERVICE_ROLE_KEY` | service role key (step 3) |
| `API_SERVER_URL` | URL del servizio api-server esistente (Railway), es. `https://waydora-api.up.railway.app` |
| `WEB_ORIGIN` | `https://www.waydora.com` |
| `WEATHER_API_KEY` | stessa chiave WeatherAPI usata sul frontend |
| `TELEGRAM_REQUIRE_PAID` | (vuoto per ora; metti `1` quando attiverai il piano Pro) |

`PORT` non serve: Railway la imposta automaticamente.

Salva → Railway redeploya. Aspetta che lo stato diventi **Active** e i log mostrino:
```
[bot] webhook set: https://...
[realtime] user_trips OK
[realtime] trip_messages OK
[bot] listening on :PORT
```

---

## 6. Verifica il webhook

Apri nel browser (sostituendo `<TOKEN>`):
```
https://api.telegram.org/bot<TOKEN>/getWebhookInfo
```

Dovresti vedere:
```json
{
  "ok": true,
  "result": {
    "url": "https://waydora-telegram-bot-production.up.railway.app/telegram/webhook/<secret>",
    "has_custom_certificate": false,
    "pending_update_count": 0,
    ...
  }
}
```

Se l'URL è vuoto o sbagliato, il bot non è partito bene → controlla i log Railway.

---

## 7. Aggiungi l'env var su Vercel

Vercel dashboard → progetto waydora → **Settings** → **Environment Variables**:

| Variabile | Valore | Environments |
|---|---|---|
| `VITE_TELEGRAM_BOT_URL` | URL Railway del bot (step 4) | Production, Preview, Development |

Salva → **Redeploy** dell'ultimo deployment (Deployments → ⋯ → Redeploy). Senza redeploy l'env var nuova non entra nel bundle Vite.

---

## 8. Test end-to-end

1. Apri https://www.waydora.com e fai login.
2. Nella sidebar, sotto al logo, vedi "Continua su Telegram" → click.
3. Si apre nuova tab → `t.me/WaydoraTravelBot?start=<token>` → "Avvia" su Telegram.
4. Il bot risponde: `✅ Collegato a Waydora (piano: free)`.
5. Scrivi: `3 giorni a Lisbona con cibo locale` → il bot fa qualche domanda e poi manda l'itinerario con i bottoni G1/G2/G3.
6. Clicca G1 → vedi le attività del giorno con bottoni "✓".
7. `/meteo` → previsioni 5 giorni Lisbona.
8. `/idea cena al tramonto` → poi `/idee` → vedi l'idea.
9. `/calendario` → ricevi file `.ics`.
10. `/reminder tra 2m | Test reminder` → dopo 2 min ricevi `⏰ Test reminder`.

Sul sito (waydora.com) prova a salvare un viaggio: nel bot ricevi notifica push grazie al realtime bridge.

---

## 9. Troubleshooting

| Sintomo | Causa probabile | Fix |
|---|---|---|
| Pulsante mostra "Bot non ancora attivo (config mancante)" | `VITE_TELEGRAM_BOT_URL` non in Vercel oppure non redeployato | Step 7 |
| "Servizio non raggiungibile" | URL Railway sbagliato o service down | Step 4 + log Railway |
| "Errore 500" su bind-token | `SUPABASE_SERVICE_ROLE_KEY` errata o migration non eseguita | Step 3 + 5 |
| Bot non risponde su Telegram | Webhook non settato | Step 6 + restart Railway |
| `/start <token>` dice "Link scaduto" | Token > 10min o il bot è stato riavviato | Click di nuovo "Continua su Telegram" |
| Bot risponde "Account non collegato" | Binding mancante (es. dopo /scollega) | Rifai bind dal sito |
| `/meteo` dice "Meteo non disponibile" | `WEATHER_API_KEY` mancante o quota finita | Step 5 |
| Reminder non parte | Cron loop non attivo | Controlla log per `[reminders]` |
| Niente notifiche dal sito al bot | Realtime publication non abilitata | Step 3 query 3 |

---

## 10. Attivare il gate paid (quando ci sarà)

Quando avrai il sistema di subscription:

1. Quando un utente paga: server-side, esegui
   ```sql
   update auth.users
   set raw_app_meta_data = raw_app_meta_data || '{"tier":"paid"}'::jsonb
   where id = '<uuid>';
   ```
2. Su Railway bot service, setta `TELEGRAM_REQUIRE_PAID=1`. Redeploy.
3. Da quel momento `assertCanUseBot()` rifiuta utenti `tier != 'paid'` sia al bind sia ad ogni messaggio.

Nessun'altra modifica al codice serve.
