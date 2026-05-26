import { useState } from "react";
import { Send, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

// URL del servizio bot (Railway). Override con VITE_TELEGRAM_BOT_URL.
const BOT_API = (import.meta.env.VITE_TELEGRAM_BOT_URL as string) || "";

type Variant = "default" | "sidebar" | "chat-chip";
type Props = { variant?: Variant; expanded?: boolean; className?: string; style?: React.CSSProperties };

async function openTelegram(): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { ok: false, error: "Devi accedere prima." };
  if (!BOT_API) {
    console.warn("[telegram] VITE_TELEGRAM_BOT_URL non configurata in Vercel/env");
    return { ok: false, error: "Bot non ancora attivo (config mancante). Riprova piu' tardi." };
  }
  let res: Response;
  try {
    res = await fetch(`${BOT_API}/api/telegram/bind-token`, {
      method: "POST",
      headers: { authorization: `Bearer ${session.access_token}` },
    });
  } catch (e) {
    console.error("[telegram] fetch err", e);
    return { ok: false, error: "Servizio non raggiungibile." };
  }
  if (res.status === 402) return { ok: false, error: "Disponibile col piano Waydora Pro." };
  if (res.status === 401) return { ok: false, error: "Sessione scaduta, rieffettua il login." };
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("[telegram] bind-token error", res.status, body);
    return { ok: false, error: `Errore ${res.status}. Riprova.` };
  }
  const { url } = (await res.json()) as { url: string };
  window.open(url, "_blank", "noopener,noreferrer");
  return { ok: true };
}

export function ConnectTelegramButton({ variant = "default", expanded = true, className, style }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handle() {
    setError(null);
    setLoading(true);
    const r = await openTelegram();
    if (!r.ok) setError(r.error);
    setLoading(false);
  }

  if (variant === "sidebar") {
    return (
      <div className={className} style={style}>
        <button
          type="button"
          onClick={handle}
          disabled={loading}
          title={!expanded ? "Continua su Telegram" : error ?? undefined}
          style={{
            width: "100%", display: "flex", alignItems: "center", gap: 10,
            padding: expanded ? "8px 10px" : "8px", borderRadius: 10,
            background: "rgba(34,158,217,0.12)", border: "1px solid rgba(34,158,217,0.35)",
            color: "#5ec0e9", fontSize: 12, fontWeight: 600,
            cursor: loading ? "wait" : "pointer", justifyContent: expanded ? "flex-start" : "center",
          }}
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          {expanded && <span>Continua su Telegram</span>}
        </button>
        {expanded && error && (
          <div style={{ marginTop: 6, fontSize: 11, color: "#ff8585", lineHeight: 1.3 }}>{error}</div>
        )}
      </div>
    );
  }

  if (variant === "chat-chip") {
    return (
      <div className={className} style={style}>
        <button
          type="button"
          onClick={handle}
          disabled={loading}
          style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "8px 14px", borderRadius: 9999,
            background: "linear-gradient(135deg,#229ED9,#1a7fb0)", color: "#fff",
            border: "none", fontWeight: 600, fontSize: 13,
            cursor: loading ? "wait" : "pointer", opacity: loading ? 0.7 : 1,
            boxShadow: "0 4px 12px rgba(34,158,217,0.35)",
          }}
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          Continua su Telegram
        </button>
        {error && <div style={{ marginTop: 6, fontSize: 12, color: "#ff6b6b" }}>{error}</div>}
      </div>
    );
  }

  return (
    <div className={className} style={style}>
      <button
        type="button"
        onClick={handle}
        disabled={loading}
        style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          padding: "10px 16px", borderRadius: 12,
          background: "#229ED9", color: "#fff", border: "none",
          fontWeight: 600, cursor: loading ? "wait" : "pointer",
          opacity: loading ? 0.7 : 1,
        }}
      >
        {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        Collega Telegram
      </button>
      {error && <div style={{ marginTop: 8, fontSize: 13, color: "#ff6b6b" }}>{error}</div>}
    </div>
  );
}
