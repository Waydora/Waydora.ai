# GenAI Pipeline — Generazione immagini/video/voce self-hosted

> Stato: **DESIGN** (non ancora implementato). Documento di progettazione.
> Data: 2026-06-01

## Obiettivo

Tool per generare **immagini, video e voce con AI** per Waydora (content-producer / PED),
**senza pagare servizi esterni** → modelli **open-weight self-hosted**.
Due interfacce d'uso richieste:
- **Script CLI** (uso manuale dell'utente)
- **Tool per l'agente** `waydora-content-producer`

## Principio chiave: software gratis, hardware no

"Senza pagare servizi" = far girare modelli open-source in locale. Il software è gratuito
e libero; il costo che resta è la **GPU**.

| Tipo      | Modello open consigliato            | Realtà hardware                                   |
|-----------|-------------------------------------|---------------------------------------------------|
| Immagini  | Flux.1-schnell / SDXL               | OK con GPU 8–12 GB VRAM. Su CPU: minuti/immagine  |
| Video     | LTX-Video, Wan2.1, AnimateDiff      | Serve GPU ≥12–24 GB VRAM. Su CPU: non realistico  |
| Voce      | Piper (veloce), XTTS-v2 (qualità)   | Gira anche su CPU decente                          |

**Vincolo n.1 = GPU disponibile.** Da definire prima di implementare (vedi "Decisioni aperte").
Se manca una GPU adeguata, alternative gratuite-ma-con-limiti: Google Colab free, Kaggle.

### DECISIONE (2026-06-01): generazione in cloud free-tier, NON in locale

Hardware utente verificato: **NVIDIA GeForce GT 730M, 4 GB DDR3 dedicati** (+5,9 GB
condivisi). GPU da portatile del 2013 (architettura Kepler):
- PyTorch moderno **non supporta più** la compute capability di Kepler → ComfyUI/SD
  non parte o crasha.
- Memoria DDR3 lentissima vs GDDR6 moderna.

Conclusione: **immagini in locale = non praticabile, video in locale = escluso.**
→ ComfyUI girerà su **GPU cloud free-tier**, non sulla macchina dell'utente.

| Opzione            | GPU gratis              | Note                                          |
|--------------------|-------------------------|-----------------------------------------------|
| Google Colab free  | T4 16 GB VRAM           | OK immagini + video brevi. Sessioni a tempo   |
| Kaggle Notebooks   | T4 ×2 / P100, ~30h/sett | Più ore di Colab                              |

L'architettura (ComfyUI + `lib/genai-client`) resta invariata: cambia solo *dove* gira
ComfyUI (cloud invece che locale). Il client TS lo raggiunge via URL pubblico
(es. tunnel ngrok/cloudflared esposto dal notebook Colab).

## Architettura: un solo motore, due interfacce

Motore = **ComfyUI** (open-source, gratis), che espone API HTTP + WebSocket.
Sia la CLI sia il tool agente parlano con lo stesso motore → niente codice duplicato.

```
                    ┌─────────────────────────────┐
                    │  ComfyUI (locale, gratis)   │
                    │  - workflow JSON immagini    │
                    │  - workflow JSON video       │
                    │  - modelli .safetensors      │
                    └──────────────▲──────────────┘
                                   │ HTTP/WS API
                    ┌──────────────┴──────────────┐
                    │  lib/genai-client (TS)      │  ← nuovo package nel pnpm workspace
                    │  submit() · poll() · fetch() │
                    └───────▲───────────────▲──────┘
                            │               │
              ┌─────────────┴───┐   ┌───────┴──────────────┐
              │ scripts/gen.ts  │   │ tool per agente       │
              │ (CLI manuale)   │   │ content-producer      │
              └─────────────────┘   └───────────────────────┘
```

Perché ComfyUI come backbone:
- Gratis e locale, nessun servizio a pagamento.
- Fa immagini, video E audio con lo stesso server (cambia solo il workflow JSON).
- Ha già API + WebSocket per il progresso → integrazione semplice con Node/TypeScript.
- Si incastra nel pnpm workspace come nuovo `lib/genai-client`, come l'esistente
  `lib/api-client-react`.

## STRATEGIA A DUE FASI (2026-06-01) — priorità: velocità su TikTok

Priorità utente aggiornata: **andare sui social (TikTok = canale #1 acquisizione)
il più velocemente e gratis possibile.** La pipeline self-hosted è gratis-per-sempre
ma LENTA da montare → non è la strada per partire.

### Fase 1 — ORA: tool web free-tier (zero setup, costo zero)
Saltare l'infrastruttura. Generare dal browser con free-tier di generatori già online.
- **Immagini:** Bing Image Creator / Microsoft Designer (DALL·E 3), Google ImageFX/Whisk,
  Ideogram (migliore per testo dentro l'immagine), Leonardo.ai, Krea — crediti gratis.
- **Video:** Kling e Hailuo/MiniMax (crediti video gratis giornalieri), Luma Dream Machine,
  LTX Studio, Pika. Free-tier video = poche generazioni/giorno.
- **Tecnica chiave:** il free-tier video affidabile è **image-to-video**. Genera prima
  un'immagine perfetta (gratis, di fatto illimitata) → poi spendi i pochi crediti video
  solo per animarla. Vedi prompt pronti: `docs/content/tiktok-genai-prompts.md`.

### Fase 2 — DOPO: ComfyUI self-hosted (solo se i limiti free diventano un collo di bottiglia)
Quando il volume cresce e i crediti gratuiti dei tool web non bastano, montare la pipeline
ComfyUI su Kaggle (più stabile di Colab). Il design qui sotto resta valido per questa fase.

**Regola:** non costruire l'infrastruttura prima di sapere che serve davvero.

## Struttura nel repo (proposta)

```
lib/genai-client/          # client TS verso ComfyUI (submit/poll/download)
  src/client.ts
  src/types.ts
  workflows/               # grafi JSON: image.json, video.json, voice.json
scripts/gen.ts             # CLI: pnpm gen:image --prompt "..." --out ./asset.png
                           # tool agente: stessa funzione importata da content-producer
```

## Decisioni aperte (da chiudere prima del codice)

1. ~~**Hardware**~~ → CHIUSA: GT 730M inadatta, si va su cloud free-tier (vedi DECISIONE sopra).
2. **Colab vs Kaggle** — quale free-tier usare come motore ComfyUI.
3. **Esposizione del notebook** — come raggiungere ComfyUI cloud dal client TS
   (tunnel cloudflared/ngrok). Gratis ma URL che cambia a ogni sessione.
4. **Destinazione asset** — salvataggio su disco dallo script, oppure upload su Supabase
   Storage per riuso da webapp/bot.

## Prossimi passi

- [x] Raccogliere specifiche hardware PC (GPU/VRAM) — GT 730M 4 GB: inadatta, si va cloud
- [x] Decidere se locale vs Colab in base all'hardware — **cloud free-tier**
- [ ] Scegliere Colab vs Kaggle + notebook ComfyUI con tunnel pubblico
- [ ] Scaffolding `lib/genai-client` + primo workflow immagini su ComfyUI cloud
- [ ] Workflow video (se hardware lo consente)
- [ ] Integrazione con content-producer (tool agente) e Supabase Storage
