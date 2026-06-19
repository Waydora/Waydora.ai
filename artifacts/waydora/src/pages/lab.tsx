// ── [LAB] Esperimento: itinerario in STREAMING (stile Mindtrip) + tool reali ──
// Pagina isolata (route nascosta /lab). Il modello emette NDJSON (una riga per
// oggetto) e qui renderizziamo le card man mano → l'itinerario "si scrive". A fine
// stream assembliamo l'oggetto canonico e lo arricchiamo (coordinate Places) per
// alimentare i TOOL REALI di produzione: Mappa, Meteo, Bagaglio. Prod intatta.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TripMap } from "@/components/trip-map";
import { PackingList } from "@/components/itinerary-results";
import { fetchWeather, type WeatherData } from "@/lib/weather";
import type { ItineraryData } from "@/hooks/api";

const API_BASE = (import.meta.env.VITE_API_URL ?? "https://waydoraai-production.up.railway.app") + "/api";

type Meta = { title?: string; destination?: string; departure?: string; durationDays?: number; vibe?: string; heroEmoji?: string };
type DayHead = { day: number; title: string; summary: string; city: string };
type Act = { day: number; time: string; title: string; description: string; category: string; estimatedCost?: string };
type Pack = { category: string; items: string[] };
type Status = "idle" | "streaming" | "done" | "error";
type Tab = "itinerario" | "mappa" | "meteo" | "bagaglio";

const CAT_EMOJI: Record<string, string> = {
  sightseeing: "📸", food: "🍝", experience: "✨", transport: "🚆", stay: "🏨",
  nightlife: "🍸", shopping: "🛍️", culture: "🎭", nature: "🌿",
};

// Assembla le righe NDJSON nell'oggetto itinerario canonico (stesso shape della prod).
function buildItinerary(meta: Meta | null, dayHeads: DayHead[], acts: Act[], packing: Pack[]): ItineraryData {
  const days = [...dayHeads].sort((a, b) => a.day - b.day).map((dh) => ({
    day: dh.day,
    title: dh.title,
    summary: dh.summary,
    // 'city' non è nel tipo ItineraryDay ma il server lo usa per il geocoding.
    city: dh.city,
    activities: acts.filter((a) => a.day === dh.day).map((a) => ({
      time: a.time, title: a.title, description: a.description,
      category: a.category as any, estimatedCost: a.estimatedCost,
    })),
  })) as any;
  return {
    title: meta?.title ?? meta?.destination ?? "Viaggio",
    destination: meta?.destination ?? "",
    durationDays: meta?.durationDays ?? days.length,
    vibe: meta?.vibe ?? "",
    totalBudget: "",
    bestSeason: "",
    heroEmoji: meta?.heroEmoji ?? "🗺️",
    days,
    packingList: packing,
  };
}

export default function Lab() {
  const [input, setInput] = useState("");
  const [meta, setMeta] = useState<Meta | null>(null);
  const [dayHeads, setDayHeads] = useState<DayHead[]>([]);
  const [acts, setActs] = useState<Act[]>([]);
  const [packing, setPacking] = useState<Pack[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [timing, setTiming] = useState<{ first?: number; total?: number }>({});
  const [errMsg, setErrMsg] = useState("");
  const [tab, setTab] = useState<Tab>("itinerario");
  const [enriched, setEnriched] = useState<ItineraryData | null>(null);
  const [enriching, setEnriching] = useState(false);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const startedAt = useRef(0);

  const assembled = useMemo(() => buildItinerary(meta, dayHeads, acts, packing), [meta, dayHeads, acts, packing]);

  const run = useCallback(async (prompt: string) => {
    const text = prompt.trim();
    if (!text || status === "streaming") return;
    setMeta(null); setDayHeads([]); setActs([]); setPacking([]); setTiming({}); setErrMsg("");
    setEnriched(null); setWeather(null); setTab("itinerario");
    setStatus("streaming");
    startedAt.current = Date.now();
    let gotFirst = false;
    try {
      const res = await fetch(`${API_BASE}/lab/stream-itinerary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [{ role: "user", content: text }], userTier: "guest" }),
      });
      if (!res.ok || !res.body) {
        const e = await res.json().catch(() => ({} as any));
        throw new Error(e.error || `Errore ${res.status}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      const markFirst = () => { if (!gotFirst) { gotFirst = true; setTiming((t) => ({ ...t, first: Date.now() - startedAt.current })); } };
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let sep: number;
        while ((sep = buf.indexOf("\n\n")) !== -1) {
          const frame = buf.slice(0, sep).trim();
          buf = buf.slice(sep + 2);
          if (!frame.startsWith("data:")) continue;
          let obj: any;
          try { obj = JSON.parse(frame.slice(5).trim()); } catch { continue; }
          if (obj.error) { setStatus("error"); setErrMsg("Lo stream si è interrotto."); return; }
          if (obj.done) { setStatus("done"); setTiming((t) => ({ ...t, total: Date.now() - startedAt.current })); return; }
          const l = obj.line;
          if (!l || typeof l.t !== "string") continue;
          if (l.t === "meta") { markFirst(); setMeta(l); }
          else if (l.t === "day") { markFirst(); setDayHeads((d) => [...d, l]); }
          else if (l.t === "act") { markFirst(); setActs((a) => [...a, l]); }
          else if (l.t === "packing" && Array.isArray(l.items)) { setPacking((p) => [...p, { category: l.category || "Bagaglio", items: l.items }]); }
        }
      }
      setStatus((s) => (s === "streaming" ? "done" : s));
    } catch (e: any) {
      setStatus("error");
      setErrMsg(e?.message || "Errore di rete");
    }
  }, [status]);

  // A fine stream: arricchisci (coordinate per i pin) e carica il meteo.
  useEffect(() => {
    if (status !== "done") return;
    if (assembled.destination) {
      fetchWeather(assembled.destination, Math.min((assembled.durationDays ?? 3) + 1, 14)).then(setWeather).catch(() => {});
    }
    if (assembled.days.length && !enriched && !enriching) {
      setEnriching(true);
      fetch(`${API_BASE}/lab/enrich`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itinerary: assembled }),
      })
        .then((r) => r.json())
        .then((j) => { if (j.itinerary) setEnriched(j.itinerary); })
        .catch(() => {})
        .finally(() => setEnriching(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const days = [...dayHeads].sort((a, b) => a.day - b.day);
  const mapItinerary = enriched ?? assembled;
  const hasItinerary = !!meta || days.length > 0;

  const TABS: { id: Tab; label: string }[] = [
    { id: "itinerario", label: "📋 Itinerario" },
    { id: "mappa", label: "🗺 Mappa" },
    { id: "meteo", label: "☁️ Meteo" },
    { id: "bagaglio", label: "🧳 Bagaglio" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "var(--wd-bg, #0a0a12)", color: "var(--wd-text, #fff)", padding: "32px 16px" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <span style={{ fontSize: 22 }}>🧪</span>
          <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>Lab · Itinerario in streaming</h1>
        </div>
        <p style={{ fontSize: 13, opacity: 0.6, margin: "0 0 18px" }}>
          L'itinerario si scrive man mano (NDJSON). A fine generazione si popolano mappa, meteo e bagaglio. Non è la produzione.
        </p>

        <form onSubmit={(e) => { e.preventDefault(); run(input); }} style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Es. Un viaggio da Isernia a Barcellona, 4 giorni"
            style={{ flex: 1, padding: "12px 14px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.06)", color: "inherit", fontSize: 14, outline: "none" }}
          />
          <button type="submit" disabled={status === "streaming"}
            style={{ padding: "12px 20px", borderRadius: 12, border: "none", fontWeight: 700, fontSize: 14, cursor: status === "streaming" ? "default" : "pointer", background: "var(--wd-grad-warm, linear-gradient(135deg,#f97316,#ec4899))", color: "#fff", opacity: status === "streaming" ? 0.7 : 1 }}>
            {status === "streaming" ? "Genero…" : "Genera"}
          </button>
        </form>

        {(timing.first != null || status === "streaming") && (
          <div style={{ fontSize: 12, opacity: 0.65, marginBottom: 14, display: "flex", gap: 16, flexWrap: "wrap" }}>
            <span>⏱ prima card: {timing.first != null ? `${(timing.first / 1000).toFixed(1)}s` : "…"}</span>
            <span>✅ completato: {timing.total != null ? `${(timing.total / 1000).toFixed(1)}s` : (status === "streaming" ? "in corso…" : "—")}</span>
            <span>{acts.length} attività</span>
            {enriching && <span>📍 geocodifico i luoghi…</span>}
          </div>
        )}

        {errMsg && <div style={{ color: "#f87171", fontSize: 13, marginBottom: 16 }}>⚠️ {errMsg}</div>}

        {hasItinerary && (
          <div style={{ display: "flex", gap: 6, marginBottom: 18, flexWrap: "wrap" }}>
            {TABS.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)}
                style={{ padding: "7px 14px", borderRadius: 999, fontSize: 13, fontWeight: 700, cursor: "pointer", border: "1px solid rgba(255,255,255,0.12)",
                  background: tab === t.id ? "var(--wd-grad-warm, linear-gradient(135deg,#f97316,#ec4899))" : "rgba(255,255,255,0.05)",
                  color: "#fff", opacity: tab === t.id ? 1 : 0.7 }}>
                {t.label}
              </button>
            ))}
          </div>
        )}

        {/* ── TAB ITINERARIO (streaming) ── */}
        {tab === "itinerario" && (
          <>
            {meta && (
              <div style={{ animation: "labIn .35s ease", padding: 18, borderRadius: 16, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", marginBottom: 20 }}>
                <div style={{ fontSize: 26 }}>{meta.heroEmoji || "🗺️"}</div>
                <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>{meta.title || meta.destination}</div>
                <div style={{ fontSize: 13, opacity: 0.7, marginTop: 4 }}>
                  {meta.destination}{meta.departure ? ` · da ${meta.departure}` : ""}{meta.durationDays ? ` · ${meta.durationDays} giorni` : ""}{meta.vibe ? ` · ${meta.vibe}` : ""}
                </div>
              </div>
            )}
            {days.map((d) => (
              <div key={d.day} style={{ animation: "labIn .35s ease", marginBottom: 22 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 800, padding: "3px 10px", borderRadius: 999, background: "var(--wd-grad-warm, linear-gradient(135deg,#f97316,#ec4899))", color: "#fff" }}>G{d.day}</span>
                  <span style={{ fontSize: 16, fontWeight: 700 }}>{d.title}</span>
                </div>
                {d.summary && <div style={{ fontSize: 13, opacity: 0.6, marginBottom: 10 }}>{d.summary}</div>}
                {acts.filter((a) => a.day === d.day).map((a, i) => (
                  <div key={`${d.day}-${i}`} style={{ animation: "labIn .3s ease", display: "flex", gap: 12, padding: "12px 14px", borderRadius: 12, background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.08)", marginBottom: 8 }}>
                    <div style={{ fontSize: 20, lineHeight: "24px" }}>{CAT_EMOJI[a.category] || "📍"}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                        <span style={{ fontSize: 14, fontWeight: 700 }}>{a.title}</span>
                        {a.estimatedCost && <span style={{ fontSize: 12, opacity: 0.6, whiteSpace: "nowrap" }}>{a.estimatedCost}</span>}
                      </div>
                      {a.time && <div style={{ fontSize: 11, opacity: 0.5, marginTop: 2 }}>{a.time}</div>}
                      <div style={{ fontSize: 13, opacity: 0.75, marginTop: 4 }}>{a.description}</div>
                    </div>
                  </div>
                ))}
              </div>
            ))}
            {status === "streaming" && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, opacity: 0.6, padding: "8px 0" }}>
                <span style={{ width: 8, height: 8, borderRadius: 999, background: "currentColor", animation: "labPulse 1s ease-in-out infinite" }} />
                sto scrivendo l'itinerario…
              </div>
            )}
          </>
        )}

        {/* ── TAB MAPPA ── */}
        {tab === "mappa" && (
          <div style={{ position: "relative", height: "70vh", borderRadius: 16, overflow: "hidden", border: "1px solid rgba(255,255,255,0.1)" }}>
            {enriched
              ? <TripMap itinerary={mapItinerary} />
              : <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, opacity: 0.6, textAlign: "center", padding: 20 }}>
                  {enriching ? "📍 Geocodifico i luoghi per i pin…" : status === "done" ? "Mappa non disponibile (manca la chiave Maps?)" : "La mappa si popola a fine generazione."}
                </div>}
          </div>
        )}

        {/* ── TAB METEO ── */}
        {tab === "meteo" && (
          <div>
            {!weather ? <div style={{ fontSize: 13, opacity: 0.6 }}>{status === "done" ? "Meteo non disponibile." : "Il meteo si carica a fine generazione."}</div>
              : <>
                  <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>{weather.location}{weather.country ? `, ${weather.country}` : ""}</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {weather.days.map((d) => (
                      <div key={d.date} style={{ padding: "10px 14px", borderRadius: 12, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", minWidth: 92 }}>
                        <div style={{ fontSize: 11, opacity: 0.6 }}>{d.date}</div>
                        <div style={{ fontSize: 18, fontWeight: 800, margin: "2px 0" }}>{Math.round(d.avgTempC)}°</div>
                        <div style={{ fontSize: 11, opacity: 0.7 }}>{d.condition}</div>
                        <div style={{ fontSize: 11, opacity: 0.5, marginTop: 2 }}>🌧 {d.chanceOfRain}%</div>
                      </div>
                    ))}
                  </div>
                </>}
          </div>
        )}

        {/* ── TAB BAGAGLIO ── */}
        {tab === "bagaglio" && (
          packing.length > 0
            ? <PackingList list={assembled.packingList} destination={assembled.destination} />
            : <div style={{ fontSize: 13, opacity: 0.6 }}>{status === "done" ? "Nessuna lista bagaglio generata." : "Il bagaglio compare a fine generazione."}</div>
        )}
      </div>
      <style>{`
        @keyframes labIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
        @keyframes labPulse { 0%,100% { opacity: .3; } 50% { opacity: 1; } }
      `}</style>
    </div>
  );
}
