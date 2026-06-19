# 6 Video di lancio TikTok — pronti da produrre

> Waydora — pacchetto lancio. Versione 1.0 — 2026-06-18.
> Deriva dal PED ufficiale (`PED-tiktok-settimana-1.md`) e dal calendario (`tiktok-calendario-settimana-1.md`).
> Aggiunge lo strato di produzione che mancava: testo a schermo esatto, caption, hashtag.
> Prompt immagine/animazione completi in `tiktok-genai-prompts.md`.

## Pre-requisiti (stato)

- [x] Landing `waydora.com/start` attiva — `artifacts/waydora/src/pages/start.tsx` (MVP B). Quick destinations coincidono con le mete sotto.
- [ ] Bio TikTok: "Pianifica i tuoi viaggi in 2 minuti. Gratis. waydora.com" + link a /start (non homepage).
- [ ] Tracking PostHog sugli eventi di /start (click da TikTok, completion form, apertura itinerario).

## Regole fisse (da PED)

- Formato 9:16, durata 7–15s, hook nei primi 2 secondi.
- CTA sempre con dominio esplicito `waydora.com` — mai "link in bio" generico.
- Logo Waydora basso a destra. CTA finale leggibile ≥ 2 secondi.
- Audio trending = fattore #1 di reach: cambialo spesso.
- Produzione gratis: immagine (Ideogram/Bing/ImageFX) → anima 2-3 migliori (Kling/Hailuo) → montaggio CapCut.

---

## Video 1 — Santorini · Dream destination
- **Immagine:** `Cinematic vertical 9:16 travel shot of Santorini white cliffs at sunset, ultra realistic, dramatic sky, vivid colors, depth of field, 35mm, no text, aspirational mood`
- **Animazione:** `Slow cinematic drone push-in, gentle parallax, clouds drifting slowly, photorealistic, 5 seconds`
- **Testo a schermo (0–2s):** "3 giorni a Santorini e zero piano 😳"
- **Testo finale:** "Itinerario Santorini gratis → waydora.com"
- **Audio:** trending dreamy/cinematic
- **Caption:** 3 giorni a Santorini senza piano? Te lo costruisco in 2 minuti, gratis. 🌅 waydora.com
- **Hashtag:** #santorini #grecia #viaggi #itinerario #travelplanner #cosafare #greciavacanze
- **Goal:** stop-scroll + primi follow

## Video 2 — Kyoto · Hidden gem (punta ai salvataggi)
- **Immagine:** `Vertical 9:16 hyper-realistic photo of Kyoto bamboo forest in morning mist, empty no crowds, magical atmosphere, soft natural light, no text`
- **Animazione:** `Slow forward camera dolly revealing the scene, soft light rays, gentle leaves movement, dreamy, 5 seconds`
- **Testo a schermo (0–2s):** "A Kyoto ci vanno tutti. Qui no. 🤫"
- **Testo finale:** "Salva 📌 poi costruiscilo su waydora.com"
- **Audio:** soft/asmr trending
- **Caption:** Il Giappone che non ti fanno vedere. Salva questo prima del tuo viaggio 📌 Itinerario completo su waydora.com
- **Hashtag:** #kyoto #giappone #japantravel #hiddengem #postinascosti #viaggigiappone
- **Goal:** salvataggi (segnale forte algoritmo)

## Video 3 — Costiera Amalfitana · Planning (CTA Telegram)
- **Immagine:** `Vertical 9:16 flat lay of a travel planning desk: open map of Amalfi Coast, camera, sunglasses, coffee, pastel aesthetic, top-down, soft shadows, no text`
- **Animazione:** `Slow top-down zoom, gentle hand entering frame pointing at the map, soft shadow movement, 5 seconds`
- **Testo a schermo (0–2s):** "Costiera pianificata in 2 minuti. Come?"
- **Testo finale:** "Provalo tu → waydora.com"
- **Audio:** upbeat/produttività trending
- **Caption:** Ho pianificato tutta la Costiera Amalfitana in 2 minuti. Senza Excel, senza 40 schede aperte. Prova: waydora.com
- **Hashtag:** #costieraamalfitana #amalficoast #italia #travelhack #organizzareviaggio #itinerario
- **NOTA:** inserire qui la CTA Telegram (azione ICE 7.7 del PED): "Ricevi l'itinerario completo su Telegram".
- **Goal:** click su waydora.com / awareness prodotto

## Video 4 — Bali · POV you are there
- **Immagine:** `POV first person vertical 9:16, hands holding a coffee on a balcony overlooking Bali rice terraces, warm morning light, cozy aesthetic, cinematic, no text`
- **Animazione:** `Subtle handheld motion, steam rising from the coffee, soft breeze, light shifting gently, 5 seconds`
- **Testo a schermo (0–2s):** "POV: ti sei svegliato a Bali ☕"
- **Testo finale:** "Il tuo piano Bali → waydora.com"
- **Audio:** lofi/chill trending
- **Caption:** Sveglia, caffè, terrazze di riso. Questo è il piano che ti costruisci in 2 minuti su waydora.com 🌴
- **Hashtag:** #bali #balitravel #pov #viaggiare #digitalnomad #itinerariobali
- **Goal:** immersione + watch time

## Video 5 — Dolomiti · Quanto costa (intent alto)
- **Immagine:** `Cinematic vertical 9:16 of Dolomites alpine lake at golden hour, ultra realistic, dramatic sky, depth of field, 35mm, no text`
- **Animazione:** `Slow cinematic drone push-in, clouds drifting, photorealistic, 5 seconds`
- **Testo a schermo (0–2s):** "Un weekend in Dolomiti costa meno di così 👇"
- **Testo finale:** "Calcola il tuo budget → waydora.com"
- **Audio:** trending del momento
- **Caption:** Quanto costa davvero un weekend in Dolomiti? Te lo calcolo in 60 secondi, gratis. waydora.com ⛰️
- **Hashtag:** #dolomiti #montagna #weekend #budgetviaggio #italiadascoprire #quantocosta
- **Goal:** salvataggi + lega al budget planner

## Video 6 — Polignano a Mare · Hidden gem (weekend)
- **Immagine:** `Vertical 9:16 hyper-realistic photo of a hidden coastal village in Puglia near Polignano a Mare, empty, magical light, travel blog aesthetic, no text`
- **Animazione:** `Slow forward camera dolly revealing the scene, gentle water movement, 5 seconds`
- **Testo a schermo (0–2s):** "Questo posto in Puglia quasi nessuno lo conosce 🤯"
- **Testo finale:** "Pianifica la gita → waydora.com"
- **Audio:** trending sabato
- **Caption:** 5 posti nascosti in Puglia che non sono su nessuna guida. Salva e pianifica la gita su waydora.com 📌
- **Hashtag:** #polignanoamare #puglia #italia #postinascosti #pugliatravel #weekenditalia
- **Goal:** reach ampia weekend + salvataggi

---

## Scheduling consigliato
- Video 1–5: Lun–Ven 13:00. Video 6: Sab 19:30.
- A fine settimana: guarda completion rate + salvataggi per pillar → raddoppia sui vincenti in settimana 2.

## KPI (da PED)
| Metrica | Target | Dove |
|---|---|---|
| Completion rate | > 40% | TikTok Analytics |
| Salvataggi | 80–150 | TikTok Analytics |
| Click waydora.com | 30–70 | PostHog / TikTok |
| Signup/email | 5–15 | PostHog su /start |
| View totali | 500–2.000 | TikTok Analytics |
