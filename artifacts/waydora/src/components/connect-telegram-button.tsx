import { useEffect, useState, useCallback } from "react";
import { Send, Loader2, CheckCircle2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

const BOT_API = (import.meta.env.VITE_TELEGRAM_BOT_URL as string) || "";
const BOT_USERNAME = (import.meta.env.VITE_TELEGRAM_BOT_USERNAME as string) || "";
const BOT_ID = (import.meta.env.VITE_TELEGRAM_BOT_ID as string) || "";

type Variant = "default" | "sidebar" | "chat-chip";
type Props = { variant?: Variant; expanded?: boolean; className?: string; style?: React.CSSProperties };

// Telegram inietta global Telegram.Login.auth(...)
declare global {
  interface Window {
    Telegram?: {
      Login?: {
        auth: (
          options: { bot_id: string; request_access?: "write" | "read"; lang?: string },
          callback: (data: TelegramAuthData | false) => void,
        ) => void;
      };
    };
  }
}

type TelegramAuthData = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
};

// Carica lo script telegram-widget.js una sola volta.
let scriptPromise: Promise<void> | null = null;
function loadTelegramScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.Telegram?.Login) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://telegram.org/js/telegram-widget.js?22";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("telegram script load failed"));
    document.head.appendChild(s);
  });
  return scriptPromise;
}

export function ConnectTelegramButton({ variant = "default", expanded = true, className, style }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Pre-carica lo script al mount per popup istantaneo al click
  useEffect(() => {
    loadTelegramScript().catch(() => {});
  }, []);

  const handle = useCallback(async () => {
    setError(null);
    setDone(false);
    if (!BOT_ID || !BOT_API) {
      setError("Bot non configurato.");
      return;
    }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setError("Devi accedere prima.");
      return;
    }

    setLoading(true);
    try {
      await loadTelegramScript();
    } catch {
      setLoading(false);
      setError("Impossibile caricare Telegram. Riprova.");
      return;
    }
    if (!window.Telegram?.Login) {
      setLoading(false);
      setError("Telegram widget non disponibile.");
      return;
    }

    window.Telegram.Login.auth(
      { bot_id: BOT_ID, request_access: "write" },
      async (tgData) => {
        if (!tgData) {
          setLoading(false);
          setError("Autorizzazione annullata.");
          return;
        }
        try {
          const res = await fetch(`${BOT_API}/api/telegram/bind-from-widget`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify(tgData),
          });
          if (res.status === 402) {
            setError("Disponibile col piano Waydora Pro.");
          } else if (!res.ok) {
            const body = await res.text().catch(() => "");
            console.error("[telegram] bind-from-widget", res.status, body);
            setError(`Errore ${res.status}.`);
          } else {
            setDone(true);
            if (BOT_USERNAME) {
              window.open(`https://t.me/${BOT_USERNAME}`, "_blank", "noopener,noreferrer");
            }
          }
        } catch (e) {
          console.error("[telegram] network", e);
          setError("Servizio non raggiungibile.");
        } finally {
          setLoading(false);
        }
      },
    );
  }, []);

  const label = done ? "Collegato a Telegram" : "Continua su Telegram";
  const Icon = done ? CheckCircle2 : loading ? Loader2 : Send;
  const iconClass = loading && !done ? "animate-spin" : "";

  if (variant === "sidebar") {
    return (
      <div className={className} style={style}>
        <button
          type="button"
          onClick={handle}
          disabled={loading || done}
          title={!expanded ? label : undefined}
          style={{
            width: "100%", display: "flex", alignItems: "center", gap: 10,
            padding: expanded ? "8px 10px" : "8px", borderRadius: 10,
            background: done ? "rgba(34,197,94,0.15)" : "rgba(34,158,217,0.12)",
            border: `1px solid ${done ? "rgba(34,197,94,0.4)" : "rgba(34,158,217,0.35)"}`,
            color: done ? "#5eda8e" : "#5ec0e9", fontSize: 12, fontWeight: 600,
            cursor: loading || done ? "default" : "pointer",
            justifyContent: expanded ? "flex-start" : "center",
          }}
        >
          <Icon size={14} className={iconClass} />
          {expanded && <span>{label}</span>}
        </button>
        {error && <div style={{ marginTop: 6, fontSize: 11, color: "#ff6b6b" }}>{error}</div>}
      </div>
    );
  }

  if (variant === "chat-chip") {
    return (
      <div className={className} style={style}>
        <button
          type="button"
          onClick={handle}
          disabled={loading || done}
          style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "8px 14px", borderRadius: 9999,
            background: done
              ? "linear-gradient(135deg,#22c55e,#16a34a)"
              : "linear-gradient(135deg,#229ED9,#1a7fb0)",
            color: "#fff", border: "none", fontWeight: 600, fontSize: 13,
            cursor: loading || done ? "default" : "pointer",
            boxShadow: "0 4px 12px rgba(34,158,217,0.35)",
          }}
        >
          <Icon size={14} className={iconClass} />
          {label}
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
        disabled={loading || done}
        style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          padding: "10px 16px", borderRadius: 12,
          background: done ? "#22c55e" : "#229ED9", color: "#fff", border: "none",
          fontWeight: 600, cursor: loading || done ? "default" : "pointer",
        }}
      >
        <Icon size={16} className={iconClass} />
        {label}
      </button>
      {error && <div style={{ marginTop: 8, fontSize: 13, color: "#ff6b6b" }}>{error}</div>}
    </div>
  );
}
