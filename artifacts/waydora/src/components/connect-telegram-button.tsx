import { useState } from "react";
import { Send, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

// URL del servizio bot (Railway). Override con VITE_TELEGRAM_BOT_URL.
const BOT_API = (import.meta.env.VITE_TELEGRAM_BOT_URL as string) || "";

type Props = { className?: string; style?: React.CSSProperties };

export function ConnectTelegramButton({ className, style }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConnect() {
    setError(null);
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError("Devi accedere prima di collegare Telegram.");
        return;
      }
      if (!BOT_API) {
        setError("Servizio Telegram non configurato.");
        return;
      }
      const res = await fetch(`${BOT_API}/api/telegram/bind-token`, {
        method: "POST",
        headers: { authorization: `Bearer ${session.access_token}` },
      });
      if (res.status === 402) {
        setError("Disponibile col piano Waydora Pro.");
        return;
      }
      if (!res.ok) {
        setError("Impossibile generare il link. Riprova.");
        return;
      }
      const { url } = (await res.json()) as { url: string };
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      setError("Errore di rete.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={className} style={style}>
      <button
        type="button"
        onClick={handleConnect}
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
      {error && (
        <div style={{ marginTop: 8, fontSize: 13, color: "#ff6b6b" }}>{error}</div>
      )}
    </div>
  );
}
