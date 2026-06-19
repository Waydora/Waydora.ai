// ── [LAB] Esperimento: itinerario in STREAMING (stile Mindtrip) ──────────────
// Pagina isolata (route nascosta /lab) per testare la generazione NDJSON: il
// modello emette una riga JSON per oggetto e qui le renderizziamo man mano che
// arrivano → l'itinerario "si scrive" a schermo. NON tocca il flusso di produzione.
import { useCallback, useRef, useState } from "react";

const API_BASE = (import.meta.env.VITE_API_URL ?? "https://waydoraai-production.up.railway.app") + "/api";

type Meta = { title?: string; destination?: string; departure?: string; durationDays?: number; vibe?: string; heroEmoji?: string };
type DayHead = { day: number; title: string; summary: string; city: string };
type Act = { day: number; time: string; title: string; description: string; category: string; estimatedCost?: string };
type Status = "idle" | "streaming" | "done" | "error";

const CAT_EMOJI: Record<string, string> = {
  sightseeing: "📸", food: "🍝", experience: "✨", transport: "🚆", stay: "🏨",
  nightlife: "🍸", shopping: "🛍️", culture: "🎭", nature: "🌿",
};

export default function Lab() {
  const [input, setInput] = useState("");
  const [meta, setMeta] = useState<Meta | null>(null);
  const [dayHeads, setDayHeads] = useState<DayHead[]>([]);
  const [acts, setActs] = useState<Act[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [timing, setTiming] = useState<{ first?: number; total?: number }>({});
  const [errMsg, setErrMsg] = useState("");
  const startedAt = useRef(0);

  const run = useCallback(async (prompt: string) => {
    const text = prompt.trim();
    if (!text || status === "streaming") return;
    setMeta(null); setDayHeads([]); setActs([]); setTiming({}); setErrMsg("");
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
      const markFirst = () => { if (!gotFirst) { gotFirst = true; setTiming(t => ({ ...t, first: Date.now() - startedAt.current })); } };

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
          if (obj.done) { setStatus("done"); setTiming(t => ({ ...t, total: Date.now() - startedAt.current })); return; }
          const l = obj.line;
          if (!l || typeof l.t !== "string") continue;
          if (l.t === "meta") { markFirst(); setMeta(l); }
          else if (l.t === "day") { markFirst(); setDayHeads(d => [...d, l]); }
          else if (l.t === "act") { markFirst(); setActs(a => [...a, l]); }
        }
      }
      setStatus(s => (s === "streaming" ? "done" : s));
    } catch (e: any) {
      setStatus("error");
      setErrMsg(e?.message || "Errore di rete");
    }
  }, [status]);

  const days = [...dayHeads].sort((a, b) => a.day - b.day);

  return (
    <div style={{ minHeight: "100vh", background: "var(--wd-bg, #0a0a12)", color: "var(--wd-text, #fff)", padding: "32px 16px" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <span style={{ fontSize: 22 }}>🧪</span>
          <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>Lab · Itinerario in streaming</h1>
        </div>
        <p style={{ fontSize: 13, opacity: 0.6, margin: "0 0 18px" }}>
          Esperimento: l'itinerario si scrive man mano che il modello ragiona (NDJSON). Non è la produzione.
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
          <div style={{ fontSize: 12, opacity: 0.65, marginBottom: 18, display: "flex", gap: 16 }}>
            <span>⏱ prima card: {timing.first != null ? `${(timing.first / 1000).toFixed(1)}s` : "…"}</span>
            <span>✅ completato: {timing.total != null ? `${(timing.total / 1000).toFixed(1)}s` : (status === "streaming" ? "in corso…" : "—")}</span>
            <span>{acts.length} attività</span>
          </div>
        )}

        {errMsg && <div style={{ color: "#f87171", fontSize: 13, marginBottom: 16 }}>⚠️ {errMsg}</div>}

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
            {acts.filter(a => a.day === d.day).map((a, i) => (
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
      </div>
      <style>{`
        @keyframes labIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
        @keyframes labPulse { 0%,100% { opacity: .3; } 50% { opacity: 1; } }
      `}</style>
    </div>
  );
}
