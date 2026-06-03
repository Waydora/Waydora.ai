# Piano Editoriale TikTok — Settimana 1 (PED ufficiale)
> Waydora — canale TikTok lancio
> Versione 1.0 — 2026-06-02
> Consolidato da: waydora-copywriter (hook/CTA), waydora-funnel-strategist (funnel/KPI), waydora-content-producer (questo documento).

---

## 1. Obiettivo della settimana

TikTok e il canale #1 di acquisizione per Waydora. La settimana 1 ha tre scopi:

1. Avviare il profilo con contenuto reale e coerente (4 pillar testati in 7 giorni).
2. Costruire il primo bridge acquisizione → attivazione: ogni video porta a waydora.com/start, non alla homepage generica.
3. Raccogliere dati sufficienti per capire quali pillar convertono in salvataggi e click — base per la settimana 2.

Tutto il materiale visivo si produce gratis (Fase 1 della pipeline: tool web free-tier).
Vedi strategia di produzione completa in `docs/architecture/genai-pipeline.md`.

---

## 2. Funnel target — bridge TikTok → /start → attivazione

Il problema identificato dal funnel-strategist: il percorso dal video all'attivazione del prodotto era spezzato (CTA generiche, nessuna landing dedicata, nessun lead magnet tangibile).

Il bridge operativo per questa settimana:

```
TikTok video
    |
    | CTA specifica per pillar (dominio esplicito waydora.com)
    v
waydora.com/start          <-- landing dedicata [DIPENDENZA: fullstack-dev]
    |
    | Headline: "Il tuo itinerario personalizzato in 30 secondi, gratis"
    | Singolo campo: destinazione + CTA "Pianifica ora"
    v
Preview itinerario (prime 2-3 tappe visibili)
    |
    | Gate: email o Telegram per ricevere l'itinerario completo
    v
Attivazione utente
    |
    | URL itinerario condivisibile [DIPENDENZA: fullstack-dev]
    v
Growth loop: condivisione organica
```

CTA per pillar (non usare mai "link in bio" generico, usare dominio esplicito):

| Pillar | CTA specifica |
|---|---|
| Dream / POV | "Itinerario [DEST] gratis su waydora.com" |
| Hidden gem | "Ti mando i 5 posti nascosti di [DEST] — waydora.com" |
| Planning | "Guarda come l'ho fatto in 2 minuti — waydora.com" |
| Quanto costa | "Budget planner [DEST] gratis su waydora.com" |

---

## 3. Tabella operativa 7 giorni

| Giorno | Data | Destinazione | Pillar | Hook | CTA | Audio | Asset da produrre |
|---|---|---|---|---|---|---|---|
| 1 | Lun | Santorini | Dream destination | "3 giorni a Santorini e zero piano. Guarda cosa ho fatto." | "Vuoi il tuo itinerario personalizzato? Inizia gratis su waydora.com" | Dreamy/cinematic trending | Immagine Pillar 1 + animazione drone reveal |
| 2 | Mar | Kyoto | Hidden gem | "A Kyoto ci vanno tutti. Questo posto non lo conosce nessuno." | "Salva questo e poi costruisci il tuo itinerario Giappone su waydora.com" | Soft/asmr trending | Immagine Pillar 3 + animazione dolly reveal |
| 3 | Mer | Costiera Amalfitana | Planning | "Costiera Amalfitana pianificata in 2 minuti. Come?" | "Prova tu stesso: waydora.com — ci vuole meno di 2 minuti." | Upbeat/produttivita trending | Immagine Pillar 4 + animazione flat lay |
| 4 | Gio | Bali | POV you are there | "Sveglia. Caffe. Terrazze di riso. Questo e il piano che ho costruito per Bali." | "Costruisci il tuo itinerario Bali in 2 minuti su waydora.com" | Lofi/chill trending | Immagine Pillar 2 + animazione POV ambient |
| 5 | Ven | Dolomiti | Quanto costa | "Un weekend in Dolomiti costa meno di quanto pensi. Ti spiego quanto." | "Calcola il tuo budget Dolomiti gratis su waydora.com — in 60 secondi." | Trending venerdi | Immagine Pillar 1 + animazione drone reveal |
| 6 | Sab | Polignano a Mare | Hidden gem | "Questo posto in Italia non lo trovi su Google Maps. Quasi nessuno ci va." | "Salva questo e pianifica la gita su waydora.com — ci vogliono 2 minuti." | Trending sabato | Immagine Pillar 3 + animazione dolly reveal |
| 7 | Dom | Riepilogo (Santorini + Kyoto + Dolomiti) | Brand / serie | "Santorini, Kyoto, Dolomiti: 3 piani, 3 minuti, 0 stress." | "Tutti questi piani li trovi su waydora.com. Gratis. Inizia dal tuo." | Trending energico | Riusa 3 immagini migliori + montaggio CapCut |

Orari di pubblicazione consigliati: 13:00 oppure 19:00–21:00 (fuso IT).
Formato obbligatorio: 9:16 verticale, durata 7–15 secondi, hook testuale nei primi 2 secondi.

---

## 4. Checklist produzione batch (da completare prima del lancio)

### 4a. Pre-lancio — azioni a costo zero (priorita ICE funnel-strategist)

- [ ] **CTA specifiche per destinazione** — verificare che ogni video usi la CTA della tabella, mai generica. ICE score 8.7 — priorita massima.
- [ ] **Landing waydora.com/start** — deve essere attiva prima del primo post. Headline "Il tuo itinerario personalizzato in 30 secondi, gratis", campo destinazione, CTA "Pianifica ora". ICE score 8.0. DIPENDENZA: waydora-fullstack-dev.
- [ ] **Lead magnet** — itinerario pre-generato per Santorini, Kyoto, Dolomiti (top 3 destinazioni della settimana). Condivisibile via URL. DIPENDENZA: waydora-fullstack-dev.
- [ ] **Bottone "Condividi itinerario"** — growth loop base. DIPENDENZA: waydora-fullstack-dev.
- [ ] **Gate email/Telegram** — preview prime 2-3 tappe visibile, poi gate per itinerario completo. ICE score 7.7. DIPENDENZA: waydora-fullstack-dev.
- [ ] **Tracking PostHog** — eventi da tracciare: click su waydora.com/start da TikTok bio, completion del form destinazione, apertura itinerario, condivisione itinerario. DIPENDENZA: waydora-analytics / PostHog gia nel repo.
- [ ] **Bio profilo TikTok** — impostare: "Pianifica i tuoi viaggi in 2 minuti. Gratis. waydora.com" + link a waydora.com/start (non homepage).

### 4b. Produzione asset visivi

- [ ] Sessione batch: genera 7–10 immagini 9:16 in un'unica sessione (Ideogram / Bing Image Creator / Google ImageFX — gratis)
- [ ] Usa i prompt della sezione A di `tiktok-genai-prompts.md` per ogni pillar
- [ ] Seleziona le 7 migliori (una per giorno) e le 2–3 da animare con priorita
- [ ] Anima massimo 1 immagine/giorno su Kling o Hailuo (crediti free limitati) — usa i prompt sezione B di `tiktok-genai-prompts.md`
- [ ] Salva tutti gli asset in `marketing/assets/settimana-1/` con naming: `g1-santorini-img.png`, `g1-santorini-vid.mp4`, ecc.

### 4c. Montaggio video

- [ ] Monta su CapCut (gratis): clip animata + hook testuale in alto (primi 2 sec) + audio trending + logo Waydora basso a destra + CTA finale con dominio esplicito
- [ ] Verifica durata: 7–15 secondi per ogni video
- [ ] Verifica che ogni CTA sia leggibile a schermo per almeno 2 secondi finali

### 4d. Scheduling

- [ ] Prepara batch post con orari: Lun–Ven 13:00, Sab–Dom 19:30
- [ ] Tool di pubblicazione: Buffer o Metricool (o Make.com webhook). NOTA: la pubblicazione effettiva richiede conferma esplicita dell'utente.
- [ ] Verifica che il link in bio punti a waydora.com/start (DIPENDENZA: landing attiva)

---

## 5. KPI per stage del funnel

> Settimana 1 e una fase di test. Non ottimizzare per vanity metrics (like, follower).
> KPI target forniti da waydora-funnel-strategist.

| Stage | Metrica | Target sett. 1 | Fonte dati |
|---|---|---|---|
| Attenzione | View totali | 500 – 2.000 | TikTok Analytics |
| Retention | Completion rate video | > 40% | TikTok Analytics |
| Intent reale | Salvataggi totali | 80 – 150 | TikTok Analytics |
| Acquisizione | Click su waydora.com/start | 30 – 70 | PostHog + TikTok Analytics |
| Attivazione | Signup / email / Telegram raccolte | 5 – 15 | PostHog su /start |

Come leggere i risultati a fine settimana:
- Completion rate basso (< 30%) = hook non funziona → cambia il testo dei primi 2 secondi.
- Salvataggi alti ma click bassi = contenuto piace ma CTA non converte → CTA piu specifica o landing /start da ottimizzare.
- Click alti ma signup bassi = landing /start da ottimizzare → test headline e form.
- Pillar con piu salvataggi nella settimana 1 = quelli da raddoppiare nella settimana 2.

---

## 6. Dipendenze su altri team

Queste azioni bloccano il lancio o riducono il funnel a meta se non completate.

| Azione | Team responsabile | Priorita | Blocca il lancio? |
|---|---|---|---|
| Landing waydora.com/start (headline + campo dest + CTA) | waydora-fullstack-dev | CRITICA | Si — senza questa il bridge non esiste |
| Gate email/Telegram su itinerario | waydora-fullstack-dev | ALTA | No — ma riduce attivazione a zero |
| URL itinerario condivisibile + bottone "Condividi" | waydora-fullstack-dev | ALTA | No — ma blocca il growth loop |
| Lead magnet: itinerario pre-generato per top 3 destinazioni | waydora-fullstack-dev | ALTA | No — ma impatta click → attivazione |
| Tracking PostHog: eventi click/form/condivisione su /start | waydora-analytics | MEDIA | No — ma senza dati non si ottimizza |

---

## 7. Azioni pre-lancio — priorita ICE (top 3 funnel-strategist)

Queste tre azioni hanno il ritorno piu alto a costo quasi zero.
Devono essere completate prima della pubblicazione del Giorno 1.

**Azione 1 — CTA specifica per destinazione (ICE 8.7)**
Non usare mai CTA generiche come "link in bio" o "vai su Waydora". Ogni video ha la sua CTA nella tabella al paragrafo 3. L'utente deve capire esattamente cosa ottiene cliccando.
Responsabile: content-producer (gia implementato nel calendario).
Stato: pronto.

**Azione 2 — Landing waydora.com/start (ICE 8.0)**
Pagina singola, senza distrazioni: headline "Il tuo itinerario personalizzato in 30 secondi, gratis", un campo di input (destinazione), CTA "Pianifica ora". Nessun menu, nessun footer lungo. Ottimizzata mobile-first (utenti TikTok su telefono).
Responsabile: waydora-fullstack-dev.
Stato: APERTO — da assegnare prima del lancio.

**Azione 3 — CTA Telegram in almeno 1 video a settimana (ICE 7.7)**
Uno dei 7 video (suggerito: Giorno 3 o Giorno 5) include CTA specifica per Telegram: "Ricevi l'itinerario completo su Telegram". Gate piu leggero dell'email, converte meglio su mobile.
Responsabile: waydora-fullstack-dev (bot Telegram gia nel repo) + content-producer (aggiungere CTA al video).
Stato: APERTO.

---

## 8. Riferimenti

- Calendario dettagliato (aggiornato): `docs/content/tiktok-calendario-settimana-1.md`
- Prompt immagini e video AI: `docs/content/tiktok-genai-prompts.md`
- Strategia pipeline GenAI (Fase 1 web free-tier, Fase 2 ComfyUI): `docs/architecture/genai-pipeline.md`
- Asset prodotti: `marketing/assets/settimana-1/` (da popolare durante la produzione)

---

> Fine PED Settimana 1. Al termine della settimana, aggiornare con i risultati reali e produrre il PED Settimana 2 sui pillar vincenti.
