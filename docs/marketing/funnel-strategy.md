# Waydora — Funnel & Growth Strategy (Italia)

> Autore: ruolo "waydora-funnel-strategist" · Data: **31 maggio 2026**
> Base: costruito sopra `docs/marketing/market-analysis.md` (personas, posizionamento, sizing). **Non ripete** l'analisi: ne usa le conclusioni.
> Obiettivo del documento: portare **traffico e utenza** con esperimenti prioritizzati per **ICE**, partendo da risorse early-stage e **budget marketing non definito** → tutto progettato a **fasi**, Fase 1 a **costo ~0** e scalabile.
> Vincolo operativo: questo è un documento di strategia. Non committa, non deploya, non implementa codice.

---

## 0. Premesse che guidano ogni scelta (dall'analisi)

- **Target primario = "Giulia, la planner del gruppo"** (26, organizza per la comitiva, TikTok + Telegram). Secondari: Marco backpacker budget-first, coppia esperienziale Sara&Luca.
- **Fossato distributivo = Telegram** (16,5M MAU IT, 53,5% nei 18-34, nessun competitor mainstream con bot nativo). Va usato come canale di **acquisizione E retention**.
- **Il prodotto ha un loop virale intrinseco:** pianificare un viaggio di gruppo *richiede* invitare gli amici. Questo è il motore di crescita principale, non un add-on.
- **Il target è budget-conscious:** il paywall precoce sul core uccide l'adozione. Revenue arriva **tardi** nel funnel.
- **One-liner di posizionamento:** *"Pianifica i tuoi viaggi parlando, insieme ai tuoi amici. Anche da Telegram."*

**North Star Metric (NSM) proposta:** **viaggi di gruppo attivi con ≥2 collaboratori per settimana (WAGT — Weekly Active Group Trips).** Cattura simultaneamente attivazione (un viaggio creato), valore (è di gruppo), e referral (≥2 persone dentro). È la metrica che meglio predice la crescita virale di Waydora — meglio di "utenti registrati", che per un prodotto a loop di gruppo è una vanity metric.

---

## 1. Funnel AARRR completo

Per ogni stage: obiettivo, leve/tattiche per *questo* target, messaggio, metrica principale.

### Acquisition
- **Obiettivo:** far arrivare Giulia (e i suoi amici) sul prodotto a costo ~0, sfruttando i canali dove già passa il tempo (TikTok, Telegram, gruppi viaggi).
- **Leve/tattiche:** short-form video "POV: organizzi il viaggio per il gruppo" su TikTok/Reels; entry-point Telegram (genera itinerario nel bot senza registrarti); SEO long-tail su itinerari ("cosa fare a Lisbona in 3 giorni"); seeding in gruppi/canali Telegram e gruppi FB di viaggi; passaparola dalla condivisione del link viaggio.
- **Messaggio:** *"Smetti di organizzare i viaggi nelle chat di gruppo."*
- **Metrica principale:** **nuovi visitatori unici / nuovi bot-starter a settimana** + CAC organico (≈0 in Fase 1) → guardare il **mix di sorgente** (quanti da TikTok vs Telegram vs condivisione virale).

### Activation
- **Obiettivo:** portare l'utente all'**aha moment** (primo itinerario completo generato) in **<60 secondi**, sia su web sia su bot.
- **Leve/tattiche:** zero-friction entry (prima generazione *senza login*), prompt pre-compilato/esempi tappabili ("Weekend a Lisbona con 4 amici"), conversazione che chiede solo l'essenziale (dove, quando, quanti, budget), itinerario giorno-per-giorno generato subito.
- **Messaggio:** *"Parli, lui pianifica. In italiano."*
- **Metrica principale:** **% di nuovi utenti che generano il 1° itinerario completo** (activation rate) + **time-to-value mediano (TTV)**.

### Retention
- **Obiettivo:** far tornare l'utente tra la pianificazione e il viaggio, e oltre — usando Telegram come canale di re-engagement utile (non spam).
- **Leve/tattiche:** reminder contestuali pre-viaggio (packing, meteo, check-in), countdown, suggerimenti "cosa fare oggi" durante il viaggio, ri-ingaggio post-viaggio ("com'è andata? salva le foto / pianifica il prossimo").
- **Messaggio:** *"Tutto il gruppo a bordo — idee, link e foto in un posto solo, anche su Telegram."*
- **Metrica principale:** **retention a 7/30 giorni** + **% utenti con bot Telegram collegato** (proxy di retention strutturale) + viaggi riaperti.

### Referral
- **Obiettivo:** trasformare il loop nativo "viaggio di gruppo → inviti amici" nel motore di crescita (k-factor ≥0.5 in Fase 1, target ≥1 a regime).
- **Leve/tattiche:** invito frictionless via link/Telegram a entrare nel viaggio; gli invitati vedono valore immediato (itinerario già pronto) prima di doversi registrare; incentivo a invitare (sblocco funzione gruppo / premium temporaneo).
- **Messaggio:** *"Aggiungi gli amici al viaggio — decidete insieme, senza 200 messaggi su WhatsApp."*
- **Metrica principale:** **k-factor** = (inviti inviati per utente) × (tasso di conversione invito) + **% viaggi che diventano di gruppo (≥2 collaboratori)**.

### Revenue
- **Obiettivo:** monetizzare **dopo** che il valore è dimostrato e il loop gira — premium su profondità/offline/AI illimitata + affiliazioni contestuali. Non danneggiare attivazione/crescita.
- **Leve/tattiche:** paywall solo su limiti "alti" (gruppi grandi, export/offline, AI illimitata, archivio); affiliazioni contestuali e oneste dentro l'itinerario (esperienze, hostel, voli, eSIM); upsell premium al momento di alto intent (export calendario prima della partenza).
- **Messaggio:** *"Gratis per partire. Premium quando il viaggio fa sul serio."*
- **Metrica principale:** **conversione free→paying** (target 2-5%) + **ricavo affiliazioni / viaggio attivo** (click-out × booking × take-rate).

---

## 2. Acquisizione — canali prioritizzati

Valutazione di ciascun canale per **fit col target**, **tipo di contenuto**, **costo**, **sforzo**. I canali sono ordinati per priorità di attacco.

| # | Canale | Fit col target | Tipo di contenuto | Costo | Sforzo | Fase |
|---|---|---|---|---|---|---|
| 1 | **TikTok (short-form organico)** | Altissimo — Giulia/Marco scoprono mete su TikTok; TikTok batte IG per discovery viaggi | "POV: organizzi il viaggio per il gruppo", itinerari generati live a schermo, before/after "caos chat → piano", duetti su mete | ~0 | Medio (costante: 4-7 post/sett) | **1** |
| 2 | **Telegram (canale + seeding gruppi)** | Altissimo — fossato distributivo, target già lì, bot = entry point a frizione zero | Canale ufficiale @waydora con itinerari pronti settimanali; bot demo condivisibile; seeding in gruppi viaggi/interrail/Erasmus | ~0 | Medio | **1** |
| 3 | **SEO long-tail (itinerari)** | Alto — alta intent, cattura chi cerca "cosa fare a X in N giorni"; compounding nel tempo | Pagine itinerario evergreen generate dal prodotto + blog, ottimizzate su keyword long-tail IT | ~0 (tempo) | Medio-Alto (lento, compounding) | **1→2** |
| 4 | **Instagram Reels / carousel** | Alto — secondario a TikTok, buono per coppia esperienziale | Riuso dei TikTok + carousel "5 cose da fare a…" salvabili | ~0 | Basso (riuso) | **2** |
| 5 | **Gruppi Facebook viaggi** | Medio-Alto — gruppi "Viaggiare low cost", "Interrail Italia", Erasmus | Risposte utili + condivisione itinerari (no spam, value-first) | ~0 | Medio | **2** |
| 6 | **Reddit (r/italy, r/travel, r/solotravel)** | Medio — utile per Marco, meno per Giulia | Risposte genuine + AMA, link soft | ~0 | Medio | **2** |
| 7 | **University / Student ambassador** | Alto per Marco e gruppi giovani — viaggi Erasmus/laurea | Ambassador che usano e condividono in gruppi universitari; kit contenuti | Basso (gadget/premium gratis) | Alto (gestione persone) | **2→3** |
| 8 | **Micro-influencer travel IT** | Alto — leva word-of-mouth (52% si fida del consiglio) | Collaborazioni con creator 10-100k follower (barter prima di paid) | Basso→Medio | Medio | **2→3** |
| 9 | **Paid (TikTok/Meta ads)** | Alto ma solo dopo aver validato il funnel | UGC-style ads sui top organici | Alto | Basso (setup) | **3** |

### TOP 3 da cui partire in Fase 1 (costo ~0)
1. **TikTok organico** — il motore di awareness sul target primario. Formula vincente: video brevi che mostrano *il prodotto in azione* + *il pain del caos di gruppo*. È il canale con il potenziale di reach più alto a costo zero.
2. **Telegram (canale ufficiale + bot come hook + seeding mirato)** — sfrutta il fossato distributivo. Il bot è insieme prodotto e annuncio: "genera il tuo itinerario gratis qui dentro" è un'esca distribuibile in ogni chat.
3. **SEO long-tail sugli itinerari** — non porta traffico domani, ma è l'unico canale *compounding* a costo zero: ogni pagina itinerario lavora per mesi. Partire subito perché il payoff è ritardato.

> **Perché non paid in Fase 1:** budget non definito + funnel non ancora validato = bruciare cassa. Il paid si attiva in Fase 3, e solo riusando i creativi organici che hanno già dimostrato hook (de-risking del CAC).

---

## 3. Lead magnet / hook d'ingresso (basso costo, alto valore)

1. **"Genera il tuo itinerario gratis in 30 secondi — anche da Telegram"** *(hook principale)*
   - Esca: il prodotto stesso, a frizione zero. Niente download, niente registrazione per la prima generazione. Su Telegram: `t.me/WaydoraBot` → scrivi dove vai → ricevi itinerario.
   - Perché funziona: TTV bassissimo, condivisibile in chat, dimostra il valore prima di chiedere qualsiasi cosa. **Distribuibile come singolo link in ogni post/commento/chat.**

2. **Itinerari pronti scaricabili / "starter pack" mete** (PDF o link viaggio precompilato)
   - Es. "Weekend a Lisbona per 4 amici — itinerario pronto", "Interrail 7 giorni Spagna low-cost". Pubblicati sul canale Telegram e come pagine SEO, ognuno apribile/clonabile nel prodotto.
   - Perché funziona: alto valore percepito per Giulia/Marco, doppia funzione SEO + Telegram, porta dentro l'app con un viaggio già impostato (riduce il TTV a zero — l'aha è già lì).

3. **"Template viaggio di gruppo"** — link condivisibile pre-strutturato (es. "vacanza estiva comitiva", "addio al nubilato/celibato")
   - Giulia lo apre, ci mette le date e gli amici, e ha già lo scheletro. Pensato per essere *postato nella chat di gruppo* → ogni amico che entra è acquisizione.
   - Perché funziona: è il lead magnet che innesca direttamente il **referral loop** (vedi §6). Massimo allineamento col loop nativo.

> Tutti e tre evitano il "lead magnet morto" (PDF scaricato e dimenticato): portano *dentro il prodotto* o *dentro Telegram*, dove inizia il funnel reale.

---

## 4. Attivazione — aha moment & time-to-value <60s

### Aha moment (misurabile)
**"L'utente genera il primo itinerario completo giorno-per-giorno."** È il momento in cui il valore conversazionale diventa tangibile. Evento da tracciare: `first_itinerary_generated`.

Un secondo aha, più forte (predittivo di retention/referral): **"l'utente condivide il link del viaggio o invita ≥1 amico"** → evento `trip_shared` / `collaborator_invited`. Questo è l'*aha sociale* e va incoraggiato subito dopo il primo.

### Come accorciare il TTV sotto i 60s

**Webapp:**
- **Niente login per la prima generazione.** Login richiesto solo per *salvare/condividere* (cattura account dopo aver dimostrato valore).
- **Prompt pre-compilati tappabili** in home: "Weekend a Lisbona con 4 amici", "Interrail 7 giorni", "3 giorni a Barcellona budget". Eliminano la sindrome del foglio bianco.
- **Conversazione minimale:** chiedere solo dove / quando / quanti / budget; poi generare. No form lunghi.
- **Itinerario visibile immediatamente** (anche parziale in streaming) per dare percezione di velocità.
- **CTA post-generazione unica e forte:** "Aggiungi i tuoi amici" → innesca §6.

**Bot Telegram:**
- Entry da deep-link `t.me/WaydoraBot?start=...` (binding già supportato nel design doc) ma **prima generazione possibile anche senza binding** (demo).
- `/start` → messaggio di benvenuto con 2-3 esempi tappabili (inline keyboard) → risposta con itinerario in chat.
- Bind dell'account proposto *dopo* la prima generazione, non prima ("Salva questo viaggio e portalo sul web → collega l'account").
- Comandi rapidi per evitare frizione (`/oggi`, `/viaggi`) già previsti.

### Metriche attivazione
- **Activation rate** = % nuovi che raggiungono `first_itinerary_generated` (target Fase 1: >40%).
- **TTV mediano** dall'ingresso al primo itinerario (target: <60s).
- **Social activation** = % nuovi che raggiungono `trip_shared`/`collaborator_invited` entro 24h (target Fase 1: >15%).

---

## 5. Retention via Telegram (utile, non spam)

Principio: **ogni messaggio bot deve essere utile in quel momento del ciclo di viaggio.** Mai promozionale puro. Opt-out sempre disponibile. Cadenze legate alle date del viaggio, non al calendario di marketing.

| Momento (relativo alle date viaggio) | Messaggio | Valore per l'utente | Cadenza |
|---|---|---|---|
| **Subito dopo creazione** | "Viaggio salvato. Aggiungi gli amici per decidere insieme 👇" | Innesca referral | 1 volta |
| **T-14 giorni** | "Mancano 2 settimane a [meta]! Controlla il meteo e inizia il bagaglio 🧳" | Pre-viaggio utile + riapre l'app | 1 volta |
| **T-3 giorni** | "Tra 3 giorni si parte! Checklist bagaglio + check-in voli" | Azionabile | 1 volta |
| **T-1 giorno** | "Domani parti per [meta] 🎉 Ecco l'itinerario del giorno 1" | Countdown + valore | 1 volta |
| **Durante il viaggio (ogni mattina)** | "Buongiorno! Ecco cosa fare oggi a [meta] ☀️ + meteo" | Companion quotidiano (alto valore) | Giornaliera, solo durante il viaggio |
| **Durante il viaggio (contestuale)** | Suggerimenti su richiesta / "ristorante vicino?" | On-demand | Solo se richiesto |
| **T+2 giorni (post-viaggio)** | "Com'è andata a [meta]? Salva le foto del gruppo 📸" | Chiusura + UGC | 1 volta |
| **T+7 giorni** | "Pronti per il prossimo? Ecco 3 idee per la comitiva ✈️" | Re-engagement + nuovo loop | 1 volta |

**Regole anti-spam:**
- Mai più di 1 messaggio/giorno fuori dal periodo viaggio (eccetto il quotidiano *durante* il viaggio, che è il valore core).
- Tono amichevole, in italiano, emoji moderate, sempre azionabile.
- Frequenza configurabile + comando per silenziare.
- I reminder avanzati/smart possono diventare leva **premium** (vedi §7) senza rendere spam quelli base.

**Metrica retention chiave:** **% utenti con Telegram collegato** (lock-in strutturale) + **CTR sui messaggi reminder** + **retention D7/D30** segmentata bot-collegato vs no (ipotesi: chi collega il bot ritiene molto meglio → da validare con analytics).

---

## 6. Referral / growth loop (il motore)

### Il loop nativo
```
Giulia crea un viaggio di gruppo
        │
        ▼
Invita gli amici (link / Telegram) ── perché DEVE: il viaggio è del gruppo
        │
        ▼
Gli amici aprono il link → vedono itinerario già pronto (valore immediato, no signup richiesto)
        │
        ▼
Alcuni amici creano un PROPRIO viaggio → diventano "Giulia" di un altro gruppo
        │
        └──────────► loop si ripete (k-factor)
```
Questo è il differenziatore: **il prodotto non è virale per artificio, lo è per natura** (pianificare in gruppo = invitare). Il lavoro di growth è **rimuovere ogni frizione** dal loop e **incentivarne** la parte volontaria.

### Meccaniche di invito (ridurre frizione)
- **Invito a 1 tap:** "Aggiungi amici" → genera link condivisibile + bottone "Condividi su Telegram/WhatsApp" (deep-link diretto alla chat).
- **Valore prima del signup:** l'invitato apre il link e *vede l'itinerario* (read-only) senza registrarsi; il signup è richiesto solo per *contribuire* (idee/media/modifiche) → cattura account al picco di intent.
- **Inline mode Telegram** (`@WaydoraBot <viaggio>`, già in roadmap fase 3 del bot): condividere un viaggio direttamente in qualsiasi chat Telegram senza uscire dalla chat → frizione minima sul canale primario.
- **CTA contestuale post-aha:** subito dopo il primo itinerario, prompt "Chi viene con te? Aggiungili".

### Incentivi (parte volontaria del loop)
Progettati per **non** introdurre paywall precoce, ma per usare il premium come *reward* gratuito:
- **Sblocco "gruppo grande" temporaneo:** invitando ≥2 amici che entrano, sblocchi i gruppi grandi premium per quel viaggio. (Allinea referral e attivazione della feature collaborativa.)
- **Premium temporaneo per referral riusciti:** chi porta N amici *attivati* (che generano un itinerario) ottiene 1 mese premium gratis. Doppia leva: cresce il funnel E fa provare il premium (→ revenue, §7).
- **Riconoscimento sociale leggero:** "Hai organizzato il viaggio per 5 persone 🏆" (badge condivisibile → ancora awareness).

### Metrica referral chiave
- **k-factor** = inviti per utente × conversione invito. Target Fase 1 ≥0.5, regime ≥1.0.
- **% viaggi di gruppo** (≥2 collaboratori) sul totale viaggi creati.
- **Invite acceptance rate** (apertura link → entrata nel viaggio).

---

## 7. Revenue — come e QUANDO introdurre premium e affiliazioni

**Principio guida (dall'analisi):** il target è budget-conscious; **il paywall precoce sul core è letale**. Revenue arriva *dopo* attivazione e con il loop già in moto. La sequenza conta più delle feature.

### Quando introdurre (per fase del funnel utente, non per fase di prodotto)
1. **Mai prima dell'aha:** zero attriti monetari fino al primo itinerario + primo viaggio salvato.
2. **Affiliazioni: subito ma contestuali e oneste** — appaiono *dentro* l'itinerario al momento giusto ("prenota questa esperienza", "hostel consigliato", "eSIM per [paese]"). Non sono un paywall, non bloccano nulla, e monetizzano anche i non-paganti (cruciale per Marco). Sono la **prima fonte di ricavo** e non danneggiano la crescita.
3. **Premium: introdotto al momento di alto intent**, mai come gate iniziale. Trigger naturali:
   - Tentativo di superare il limite (3° viaggio attivo, gruppo > 4 persone, AI oltre il limite mensile).
   - **Export calendario/offline prima della partenza** (momento di massima willingness-to-pay: l'utente *parte davvero*).
   - Reminder smart/avanzati.
4. **Soft paywall, non hard:** quando si tocca un limite, mostrare il valore ("hai 3 viaggi, sblocca illimitati") con possibilità di guadagnare premium via referral (§6) → la crescita alimenta la revenue invece di scontrarcisi.

### Confezionamento (coerente con §6 dell'analisi)
- **Free generoso:** core planning conversazionale illimitato-ish (con limite mensile alto), 2-3 viaggi attivi, gruppi piccoli (3-4), condivisione link, mappa, Telegram base.
- **Premium (~€2,99-3,99/mese o €24-29/anno, sotto i competitor):** viaggi illimitati + archivio, gruppi grandi + ruoli, export/offline, AI illimitata, reminder smart, link branded.
- **Affiliazioni** (esperienze GetYourGuide/Viator, hostel Booking/Hostelworld, voli Skyscanner, eSIM Airalo): contestuali, mai banner intrusivi.

### Metriche revenue
- **Conversione free→paying** (target 2-5%, vedi §8).
- **Ricavo affiliazioni / viaggio attivo** = click-out × conv. booking × take-rate (da misurare con dati reali — dipendenza analytics).
- **ARPU** e mix premium vs affiliazioni.

> **Anti-pattern da evitare (esplicito):** non mettere il bot Telegram dietro paywall (è acquisizione + retention), non limitare la condivisione del link (è il referral loop), non chiedere carta per provare. Ognuno di questi spegnerebbe il motore di crescita.

---

## 8. KPI per stage + target per fase

NSM: **Weekly Active Group Trips (WAGT)** — viaggi con ≥2 collaboratori attivi/settimana.

Tre fasi: **Pre-launch** (validazione, beta chiusa/aperta limitata), **Launch** (apertura pubblica + spinta organica), **Scale** (canali multipli, paid acceso). I target utenti sono ancorati al SOM dell'analisi: **4.500-50.000 utenti / 600-2.500 paganti** su 24 mesi.

| Stage | KPI | Pre-launch | Launch | Scale |
|---|---|---|---|---|
| **North Star** | WAGT (viaggi gruppo attivi/sett) | 20-50 | 200-500 | 1.000-3.000 |
| **Acquisition** | Nuovi utenti/mese | 100-300 | 1.000-3.000 | 5.000-15.000 |
| | Utenti totali (cumulato) | ~500 | 4.500-10.000 | 15.000-50.000 |
| | Mix sorgente organica | qualitativo | TikTok+TG >60% | diversificato |
| **Activation** | Activation rate (1° itinerario) | >35% | >40% | >45% |
| | TTV mediano | <90s | <60s | <60s |
| | Social activation (24h) | >10% | >15% | >20% |
| **Retention** | Retention D30 | >15% | >25% | >30% |
| | % utenti con bot TG collegato | >20% | >30% | >40% |
| **Referral** | k-factor | ≥0.3 | ≥0.5 | ≥1.0 |
| | % viaggi di gruppo | >30% | >40% | >50% |
| **Revenue** | Conversione free→paying | — (no paywall) | 1-2% | 2-5% |
| | Paganti (cumulato) | — | ~100-300 | 600-2.500 |
| | Ricavo affiliazioni/viaggio | misurare baseline | crescente | ottimizzato |

> I target sono **[STIMA]** coerenti col sizing dell'analisi; vanno ricalibrati con i primi dati reali (dipendenza analytics). Le percentuali di activation/retention sono benchmark consumer prudenti, non misurati su Waydora.

---

## 9. Backlog esperimenti prioritizzato (ICE)

ICE = Impact × Confidence × Ease (ciascuno 1-10; Score = media). Ordinato per Score decrescente. **I primi 5 sono eseguibili a budget ~0.**

| # | Esperimento | Stage | Impact | Conf. | Ease | **Score** | Budget |
|---|---|---|---|---|---|---|---|
| 1 | **Prima generazione senza login** (web + bot) | Activation | 9 | 9 | 8 | **8.7** | ~0 |
| 2 | **Prompt pre-compilati tappabili** in home/bot | Activation | 8 | 9 | 9 | **8.7** | ~0 |
| 3 | **Bot Telegram come hook condivisibile** ("genera gratis qui") | Acquisition | 9 | 8 | 8 | **8.3** | ~0 |
| 4 | **CTA "Aggiungi amici" post-itinerario** (innesca loop) | Referral | 9 | 8 | 7 | **8.0** | ~0 |
| 5 | **TikTok organico "POV: organizzi il viaggio"** (4-7/sett) | Acquisition | 9 | 7 | 7 | **7.7** | ~0 |
| 6 | **Itinerari pronti SEO** (10-20 pagine long-tail IT) | Acquisition | 8 | 8 | 6 | **7.3** | ~0 (tempo) |
| 7 | **Invitato vede itinerario read-only senza signup** | Referral | 8 | 8 | 6 | **7.3** | ~0 |
| 8 | **Reminder pre-viaggio utili via TG** (T-14/T-3/T-1) | Retention | 8 | 8 | 6 | **7.3** | ~0 |
| 9 | **Canale Telegram ufficiale** + itinerari settimanali | Acquisition | 7 | 8 | 7 | **7.3** | ~0 |
| 10 | **Companion quotidiano durante il viaggio** ("cosa fare oggi") | Retention | 8 | 7 | 6 | **7.0** | ~0 |
| 11 | **Premium temporaneo per referral riusciti** | Referral/Revenue | 8 | 6 | 6 | **6.7** | ~0 |
| 12 | **Affiliazioni contestuali nell'itinerario** | Revenue | 7 | 7 | 6 | **6.7** | ~0 |
| 13 | **Seeding gruppi FB/Telegram/Reddit viaggi** (value-first) | Acquisition | 6 | 7 | 6 | **6.3** | ~0 |
| 14 | **Inline mode Telegram** (`@WaydoraBot` condividi viaggio in chat) | Referral | 8 | 6 | 4 | **6.0** | ~0 (dev) |
| 15 | **Soft paywall su export/offline pre-partenza** | Revenue | 7 | 6 | 5 | **6.0** | ~0 |
| 16 | **UGC-style paid ads sui top organici** | Acquisition | 7 | 6 | 6 | **6.3** | €€ (Fase 3) |
| 17 | **Student ambassador program** | Acquisition | 6 | 5 | 4 | **5.0** | € (gadget) |

> Nota: alcuni esperimenti (es. #1, #2, #4, #7, #14) richiedono lavoro di prodotto/dev, non spesa marketing — sono "budget ~0" in senso di cassa marketing ma vanno sequenziati con il team dev. Vedi §10.

---

## 10. Dipendenze (per sequenziare il lavoro con gli altri agenti)

### Da **analytics / tracking** (bloccante per misurare tutto)
- Eventi prodotto strumentati: `signup`, `first_itinerary_generated`, `trip_saved`, `trip_shared`, `collaborator_invited`, `invite_opened`, `invite_accepted`, `telegram_bound`, `reminder_sent`, `reminder_clicked`, `affiliate_click`, `paywall_view`, `subscription_start`.
- Funnel report per stage AARRR + segmentazione per sorgente (TikTok/TG/SEO/referral).
- Calcolo k-factor, activation rate, TTV, retention D7/D30, NSM (WAGT).
- Baseline affiliazioni: CTR click-out, conversione booking (manca nei dati — vedi §7 analisi).
- **Senza questo, §4/§6/§8 non sono misurabili.** È la prima dipendenza da chiudere.

### Da **content-producer**
- Calendario editoriale TikTok/Reels (4-7 video/sett) coi format di §2: "POV organizzi il viaggio", before/after caos chat, itinerario generato live.
- Itinerari pronti / starter pack per i lead magnet (§3) e per il canale Telegram.
- Copy onboarding (web + bot), copy reminder Telegram (§5), copy inviti referral (§6).
- Asset condivisibili (badge "hai organizzato per 5 persone", template viaggio gruppo).

### Da **seo-specialist**
- Keyword research long-tail IT: "cosa fare a [città] in [N] giorni", "itinerario [meta] [giorni]", "[meta] con amici budget", "interrail [paese]".
- Struttura pagine itinerario evergreen ottimizzate (titoli, schema, internal linking).
- Priorità mete da coprire per primo (intersezione volume × fit target Giulia/Marco).

### Da **dev / prodotto** (per gli esperimenti che toccano il prodotto)
- Prima generazione senza login (#1).
- Prompt pre-compilati tappabili (#2).
- CTA "aggiungi amici" + invito a 1 tap + condivisione deep-link (#4, #7).
- Reminder pre-viaggio e companion quotidiano via bot (#8, #10) — il design doc bot prevede già scrittura/lettura; serve lo scheduler dei reminder.
- Inline mode Telegram (#14) — già in roadmap fase 3 del bot.
- Soft paywall e meccaniche di referral/premium temporaneo (#11, #15).

### Sequenza consigliata
1. **Sblocca analytics** (tracking eventi) — senza misura si vola alla cieca.
2. **Fase 1 a costo 0 in parallelo:** dev fa #1/#2/#4 (activation+loop), content avvia TikTok + lead magnet, seo imposta le prime pagine itinerario, si apre il canale Telegram.
3. **Misura activation + k-factor** → se il loop gira (k≥0.5) e l'activation regge (>40%), passa a **Fase 2** (IG, gruppi, micro-influencer, reminder TG completi).
4. **Fase 3 (paid)** solo dopo aver validato funnel + creativi organici performanti.

---

## Riassunto per l'utente

**Tesi di crescita:** Waydora ha un **loop virale nativo** (pianificare in gruppo = invitare gli amici) e un **fossato distributivo su Telegram**. La strategia non inventa viralità: rimuove frizione dal loop esistente e usa Telegram come canale di acquisizione *e* retention. Revenue arriva **tardi** (il target è budget-conscious; il paywall precoce è letale) e parte dalle **affiliazioni contestuali**, non dal premium.

**North Star:** Weekly Active Group Trips (viaggi di gruppo con ≥2 collaboratori/settimana) — predice crescita meglio di "utenti registrati".

**TOP 3 esperimenti da cui partire SUBITO (tutti budget ~0, ICE più alto):**
1. **Prima generazione senza login** (web + bot) — ICE 8.7. Abbatte il TTV sotto i 60s e massimizza l'activation rate. È il moltiplicatore di tutto il resto del funnel.
2. **Prompt pre-compilati tappabili** — ICE 8.7. Elimina la sindrome del foglio bianco, porta l'utente all'aha immediatamente.
3. **Bot Telegram come hook condivisibile** ("genera il tuo itinerario gratis qui") — ICE 8.3. Trasforma il prodotto stesso nell'esca distribuibile, sfruttando il canale dove il target già vive.

(Subito dietro: CTA "Aggiungi amici" post-itinerario per innescare il referral loop, e TikTok organico per l'awareness.)

**Prima dipendenza da chiudere:** tracking eventi con l'agente analytics — senza misura, activation/k-factor/retention non sono valutabili e non si può decidere quando passare di fase.

**File prodotto:** `docs/marketing/funnel-strategy.md`
