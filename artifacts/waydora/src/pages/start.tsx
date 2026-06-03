// src/pages/start.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Landing /start — MVP B
// Flusso: input destinazione → genera itinerario (Railway/Sonnet) →
//         salva → mostra preview prime 2 tappe → CTA "Vedi completo" → /trip/:slug
//
// Vincoli rispettati:
//  - NO framer-motion (vincolo memoria: no framer-motion su mobile)
//  - Mobile-first (min-h-[100dvh], touch-friendly targets)
//  - Nessun gate email/Telegram (MVP B)
//  - Tracking PostHog via choke-point track() — niente PII in chiaro
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Loader2, ArrowRight, MapPin, Clock, Sparkles } from "lucide-react";
import { useChat, useSaveItinerary, type ItineraryData, type ItineraryDay } from "@/hooks/api";
import { Logo } from "@/components/layout";
import { fetchPhoto } from "@/lib/photos";
import { track, destinationCountry, hashSlug } from "@/lib/analytics";

// ── Costanti ─────────────────────────────────────────────────────────────────

const DEFAULT_BG = "https://images.pexels.com/photos/1285625/pexels-photo-1285625.jpeg"; // Santorini

const QUICK_DESTINATIONS = [
  "Santorini",
  "Kyoto",
  "Costiera Amalfitana",
  "Bali",
  "Dolomiti",
  "Polignano a Mare",
] as const;

const LOADING_PHRASES: Array<{ emoji: string; text: string }> = [
  { emoji: "🧭", text: "Sto cercando i posti migliori..." },
  { emoji: "🗺️", text: "Sto disegnando la mappa..." },
  { emoji: "🍝", text: "Chiedo consiglio agli chef del posto..." },
  { emoji: "🌅", text: "Guardo gli orari del tramonto..." },
  { emoji: "✈️", text: "Verifico voli e treni..." },
  { emoji: "🏛", text: "Leggo le guide dei locali..." },
  { emoji: "📍", text: "Piazzo i pin sull'itinerario..." },
  { emoji: "✨", text: "Ultimi ritocchi..." },
];

// ── Tipi interni ──────────────────────────────────────────────────────────────

type Phase = "idle" | "loading" | "preview";

// ── Sotto-componente: indicatore di caricamento senza framer-motion ───────────

function LoadingIndicator({ phraseIdx }: { phraseIdx: number }) {
  const phrase = LOADING_PHRASES[phraseIdx % LOADING_PHRASES.length];
  return (
    <div className="flex flex-col items-center gap-4 py-8">
      <Loader2 className="w-10 h-10 animate-spin" style={{ color: "rgba(255,255,255,0.7)" }} />
      <div
        className="flex items-center gap-3 px-5 py-3 rounded-2xl"
        style={{
          background: "rgba(255,255,255,0.12)",
          border: "1px solid rgba(255,255,255,0.18)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
        }}
      >
        <span style={{ fontSize: "1.4rem" }}>{phrase.emoji}</span>
        <span
          className="text-sm font-medium"
          style={{ color: "rgba(255,255,255,0.9)" }}
        >
          {phrase.text}
        </span>
      </div>
    </div>
  );
}

// ── Sotto-componente: card tappa minima ────────────────────────────────────────

function DayPreviewCard({ day, index }: { day: ItineraryDay; index: number }) {
  const topActivities = day.activities.slice(0, 3);
  return (
    <div
      className="rounded-2xl p-4"
      style={{
        background: "rgba(255,255,255,0.10)",
        border: "1px solid rgba(255,255,255,0.18)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
      }}
    >
      {/* Header giorno */}
      <div className="flex items-center gap-2 mb-3">
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black text-white shrink-0"
          style={{ background: "var(--wd-grad-warm)" }}
        >
          {index + 1}
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.45)" }}>
            Giorno {day.day}
          </p>
          <p className="text-sm font-bold leading-tight" style={{ color: "#fff" }}>
            {day.title}
          </p>
        </div>
      </div>

      {/* Attività */}
      <div className="space-y-2">
        {topActivities.map((activity, i) => (
          <div key={i} className="flex items-start gap-2.5">
            <Clock className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: "rgba(255,255,255,0.4)" }} />
            <div className="min-w-0">
              <span className="text-xs font-semibold" style={{ color: "rgba(255,255,255,0.85)" }}>
                {activity.time && (
                  <span className="mr-1.5" style={{ color: "rgba(255,255,255,0.45)" }}>
                    {activity.time}
                  </span>
                )}
                {activity.title}
              </span>
            </div>
          </div>
        ))}
        {day.activities.length > 3 && (
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.38)" }}>
            +{day.activities.length - 3} altre attività...
          </p>
        )}
      </div>
    </div>
  );
}

// ── Sotto-componente: sezione preview post-generazione ────────────────────────

function StartPreview({
  itinerary,
  shareSlug,
}: {
  itinerary: ItineraryData;
  shareSlug: string;
}) {
  const [, setLocation] = useLocation();
  const previewDays = itinerary.days.slice(0, 2);

  return (
    <div className="w-full max-w-md mx-auto space-y-4">
      {/* Intestazione risultato */}
      <div className="text-center space-y-1">
        <div className="text-3xl">{itinerary.heroEmoji ?? "✈️"}</div>
        <h2 className="text-xl font-black tracking-tight" style={{ color: "#fff" }}>
          {itinerary.title}
        </h2>
        <p className="text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>
          {itinerary.durationDays} giorni · {itinerary.totalBudget}
        </p>
      </div>

      {/* Prime 2 tappe */}
      <div className="space-y-3">
        {previewDays.map((day, i) => (
          <DayPreviewCard key={day.day} day={day} index={i} />
        ))}
      </div>

      {/* Teaser giorni rimanenti */}
      {itinerary.days.length > 2 && (
        <div
          className="rounded-2xl px-4 py-3 text-center"
          style={{
            background: "rgba(255,255,255,0.06)",
            border: "1px dashed rgba(255,255,255,0.2)",
          }}
        >
          <p className="text-sm font-semibold" style={{ color: "rgba(255,255,255,0.5)" }}>
            + altri {itinerary.days.length - 2} giorni nell'itinerario completo
          </p>
        </div>
      )}

      {/* CTA principale */}
      <button
        onClick={() => setLocation(`/trip/${shareSlug}`)}
        className="w-full flex items-center justify-center gap-2 rounded-2xl py-4 text-base font-black tracking-tight text-white transition-opacity active:opacity-80"
        style={{ background: "var(--wd-grad-warm)", boxShadow: "0 8px 32px rgba(251,146,60,0.35)" }}
      >
        <MapPin className="w-5 h-5" />
        Vedi l'itinerario completo
        <ArrowRight className="w-5 h-5" />
      </button>
    </div>
  );
}

// ── Componente principale: StartHero ─────────────────────────────────────────

function StartHero({
  destination,
  onDestinationChange,
  onSubmit,
  isPending,
  error,
  hasSuggestionClickRef,
}: {
  destination: string;
  onDestinationChange: (v: string) => void;
  onSubmit: () => void;
  isPending: boolean;
  error: string | null;
  hasSuggestionClickRef: React.MutableRefObject<boolean>;
}) {
  const canSubmit = destination.trim().length >= 2 && !isPending;

  const handleSuggestion = (dest: string) => {
    hasSuggestionClickRef.current = true;
    onDestinationChange(dest);
  };

  return (
    <div className="w-full max-w-md mx-auto space-y-6">
      {/* Headline */}
      <div className="text-center space-y-3">
        <h1
          className="text-3xl sm:text-4xl font-black leading-tight tracking-tight"
          style={{ color: "#fff", textShadow: "0 2px 16px rgba(0,0,0,0.45)" }}
        >
          Il tuo itinerario personalizzato in{" "}
          <span style={{ background: "var(--wd-grad-warm)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            30 secondi
          </span>
          , gratis
        </h1>
        <p
          className="text-base sm:text-lg font-medium leading-relaxed"
          style={{ color: "rgba(255,255,255,0.78)", textShadow: "0 1px 8px rgba(0,0,0,0.4)" }}
        >
          Scrivi la destinazione, Waydora fa il resto.
        </p>
      </div>

      {/* Input + CTA */}
      <div className="space-y-3">
        <div className="relative">
          <MapPin
            className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 pointer-events-none"
            style={{ color: "rgba(255,255,255,0.5)" }}
          />
          <input
            type="text"
            value={destination}
            onChange={(e) => onDestinationChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && canSubmit) onSubmit(); }}
            placeholder="Es. Bali, Dolomiti, Kyoto..."
            className="w-full rounded-2xl pl-12 pr-4 py-4 text-base font-semibold outline-none transition-all"
            style={{
              background: "rgba(255,255,255,0.14)",
              border: "1.5px solid rgba(255,255,255,0.28)",
              color: "#fff",
              caretColor: "#fff",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
            }}
            autoComplete="off"
            autoFocus
            disabled={isPending}
          />
        </div>

        <button
          onClick={onSubmit}
          disabled={!canSubmit}
          className="w-full flex items-center justify-center gap-2 rounded-2xl py-4 text-base font-black tracking-tight text-white transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            background: canSubmit ? "var(--wd-grad-warm)" : "rgba(255,255,255,0.15)",
            boxShadow: canSubmit ? "0 8px 32px rgba(251,146,60,0.35)" : "none",
          }}
        >
          {isPending ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Sparkles className="w-5 h-5" />
          )}
          {isPending ? "Generazione..." : "Pianifica ora"}
        </button>

        {error && (
          <div
            className="rounded-xl px-4 py-3 text-sm font-medium text-center"
            style={{
              background: "rgba(239,68,68,0.18)",
              border: "1px solid rgba(239,68,68,0.35)",
              color: "#fca5a5",
            }}
          >
            {error}
          </div>
        )}
      </div>

      {/* Suggerimenti rapidi */}
      <div className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-widest text-center" style={{ color: "rgba(255,255,255,0.38)" }}>
          Mete popolari
        </p>
        <div className="flex flex-wrap gap-2 justify-center">
          {QUICK_DESTINATIONS.map((dest) => (
            <button
              key={dest}
              onClick={() => handleSuggestion(dest)}
              disabled={isPending}
              className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all active:scale-95 disabled:opacity-40"
              style={{
                background: "rgba(255,255,255,0.10)",
                border: "1px solid rgba(255,255,255,0.22)",
                color: "rgba(255,255,255,0.82)",
              }}
            >
              {dest}
            </button>
          ))}
        </div>
      </div>

      {/* Trust badges */}
      <div className="flex items-center justify-center gap-4 flex-wrap">
        {["Gratis", "30 secondi", "Nessun account"].map((badge) => (
          <span
            key={badge}
            className="text-xs font-bold px-3 py-1 rounded-full"
            style={{
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.15)",
              color: "rgba(255,255,255,0.65)",
            }}
          >
            ✓ {badge}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Pagina principale ─────────────────────────────────────────────────────────

export default function Start() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [destination, setDestination] = useState("");
  const [bgUrl, setBgUrl] = useState(DEFAULT_BG);
  const [error, setError] = useState<string | null>(null);
  const [itinerary, setItinerary] = useState<ItineraryData | null>(null);
  const [shareSlug, setShareSlug] = useState("");
  const [loadingPhraseIdx, setLoadingPhraseIdx] = useState(0);

  // Ref per evitare invii multipli e tenere traccia di suggestion click
  const hasSuggestionClickRef = useRef(false);
  const startTimeRef = useRef<number>(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const chatMutation = useChat();
  const saveMutation = useSaveItinerary();

  // ── Tracking: start_page_viewed al mount ────────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    track("start_page_viewed", {
      utm_source: params.get("utm_source") ?? undefined,
      utm_medium: params.get("utm_medium") ?? undefined,
      utm_campaign: params.get("utm_campaign") ?? undefined,
    });
  }, []);

  // ── Background dinamico con debounce 600ms ──────────────────────────────────
  useEffect(() => {
    if (phase !== "idle") return;
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const query = destination.trim() || "Santorini Greece";
    debounceRef.current = setTimeout(async () => {
      const url = await fetchPhoto(query);
      setBgUrl(url);
    }, 600);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [destination, phase]);

  // ── Carosello frasi durante loading (no framer-motion: solo setState) ────────
  useEffect(() => {
    if (phase !== "loading") return;
    const t = setInterval(() => {
      setLoadingPhraseIdx((i) => (i + 1) % LOADING_PHRASES.length);
    }, 2800);
    return () => clearInterval(t);
  }, [phase]);

  // ── Submit ───────────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    const dest = destination.trim();
    if (dest.length < 2) return;
    if (phase === "loading") return;

    setError(null);
    setPhase("loading");
    startTimeRef.current = Date.now();

    track("start_destination_submitted", {
      destination_country: destinationCountry(dest),
      source: "tiktok_start",
      has_suggestion_click: hasSuggestionClickRef.current,
    });

    try {
      // 1. Genera itinerario via Railway/Sonnet
      const chatResult = await chatMutation.mutateAsync({
        data: {
          messages: [
            {
              role: "user",
              content: `Pianificami un itinerario per ${dest}`,
            },
          ],
          userTier: "guest",
        },
        useRailway: true,
      });

      const generatedItinerary = chatResult.itinerary;
      if (!generatedItinerary) {
        throw new Error("Non ho ricevuto un itinerario valido. Riprova con una destinazione più specifica.");
      }

      // 2. Salva e ottieni shareSlug
      const saved = await saveMutation.mutateAsync({
        data: { itinerary: generatedItinerary },
      });

      const slug = saved.shareSlug;
      const elapsed = Date.now() - startTimeRef.current;

      // 3. Aggiorna background con la destinazione reale dell'itinerario
      if (generatedItinerary.destination) {
        const url = await fetchPhoto(generatedItinerary.destination);
        setBgUrl(url);
      }

      // 4. Tracking attivazione
      track("start_activation", {
        share_slug_hash: hashSlug(slug),
        destination_country: destinationCountry(generatedItinerary.destination ?? dest),
        time_to_activation_ms: elapsed,
      });

      setItinerary(generatedItinerary);
      setShareSlug(slug);
      setPhase("preview");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Errore durante la generazione. Riprova.";
      setError(message);
      setPhase("idle");
    }
  }, [destination, phase, chatMutation, saveMutation]);

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Background fullscreen */}
      <div
        aria-hidden="true"
        className="fixed inset-0 z-0 bg-cover bg-center transition-all duration-700"
        style={{ backgroundImage: `url(${bgUrl})` }}
      />
      {/* Overlay scuro */}
      <div
        aria-hidden="true"
        className="fixed inset-0 z-0"
        style={{ background: "rgba(0,0,0,0.55)" }}
      />

      {/* Contenuto */}
      <div className="relative z-10 min-h-[100dvh] flex flex-col">
        {/* Header minimale: solo logo */}
        <header className="flex items-center px-5 pt-5 pb-2 shrink-0">
          <Logo variant="header" />
        </header>

        {/* Corpo centrale */}
        <main className="flex-1 flex flex-col items-center justify-center px-4 py-8">
          {phase === "idle" && (
            <StartHero
              destination={destination}
              onDestinationChange={setDestination}
              onSubmit={handleSubmit}
              isPending={chatMutation.isPending || saveMutation.isPending}
              error={error}
              hasSuggestionClickRef={hasSuggestionClickRef}
            />
          )}

          {phase === "loading" && (
            <div className="w-full max-w-md mx-auto flex flex-col items-center gap-2">
              <p
                className="text-lg font-bold text-center mb-2"
                style={{ color: "rgba(255,255,255,0.9)", textShadow: "0 1px 8px rgba(0,0,0,0.4)" }}
              >
                Creo il tuo itinerario per{" "}
                <span style={{ background: "var(--wd-grad-warm)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                  {destination}
                </span>
              </p>
              <LoadingIndicator phraseIdx={loadingPhraseIdx} />
            </div>
          )}

          {phase === "preview" && itinerary && shareSlug && (
            <StartPreview itinerary={itinerary} shareSlug={shareSlug} />
          )}
        </main>
      </div>
    </>
  );
}
