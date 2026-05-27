import { useEffect, useRef, useState } from "react";
import { Send, Loader2, CheckCircle2, ExternalLink } from "lucide-react";
import { supabase } from "@/lib/supabase";

const BOT_API = (import.meta.env.VITE_TELEGRAM_BOT_URL as string) || "";
const BOT_USERNAME = (import.meta.env.VITE_TELEGRAM_BOT_USERNAME as string) || "";

type Variant = "default" | "sidebar" | "chat-chip";
type Props = { variant?: Variant; expanded?: boolean; className?: string; style?: React.CSSProperties };

// Pannello di stato che reagisce a ?telegram=connected|expired|invalid|error nell'URL
function useTelegramRedirectStatus(): "connected" | "expired" | "invalid" | "error" | null {
  const [status, setStatus] = useState<any>(null);
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const s = sp.get("telegram");
    if (s) {
      setStatus(s as any);
      // Pulisci la query string per evitare reload-stato
      sp.delete("telegram");
      const q = sp.toString();
      const url = window.location.pathname + (q ? `?${q}` : "");
      window.history.replaceState({}, "", url);
    }
  }, []);
  return status;
}

export function ConnectTelegramButton({ variant = "default", expanded = true, className, style }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stateToken, setStateToken] = useState<string | null>(null);
  const status = useTelegramRedirectStatus();
  const done = status === "connected";

  // Genera un state token per il widget (10 min validi)
  async function fetchStateToken() {
    setError(null);
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setError("Devi accedere prima."); return; }
      if (!BOT_API) { setError("Bot non configurato."); return; }
      const res = await fetch(`${BOT_API}/api/telegram/bind-token`, {
        method: "POST",
        headers: { authorization: `Bearer ${session.access_token}` },
      });
      if (res.status === 402) { setError("Disponibile col piano Waydora Pro."); return; }
      if (!res.ok) { setError(`Errore ${res.status}.`); return; }
      const { url } = await res.json() as { url: string };
      // url e' del tipo https://t.me/<bot>?start=<token>
      const tok = new URL(url).searchParams.get("start");
      if (!tok) { setError("Token non ricevuto."); return; }
      setStateToken(tok);
    } catch (e) {
      console.error("[telegram] state token err", e);
      setError("Servizio non raggiungibile.");
    } finally {
      setLoading(false);
    }
  }

  // Quando abbiamo lo state token, renderizza l'iframe widget Telegram
  useEffect(() => {
    if (!stateToken || !containerRef.current || !BOT_USERNAME) return;
    const callbackUrl = `${BOT_API}/api/telegram/bind-callback?state=${encodeURIComponent(stateToken)}`;
    const script = document.createElement("script");
    script.async = true;
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.setAttribute("data-telegram-login", BOT_USERNAME);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-radius", "8");
    script.setAttribute("data-userpic", "false");
    script.setAttribute("data-request-access", "write");
    script.setAttribute("data-auth-url", callbackUrl);
    containerRef.current.replaceChildren();
    containerRef.current.appendChild(script);
  }, [stateToken]);

  // ── stato "collegato": mostra link per aprire Telegram ────────────────
  if (done) {
    // tg:// scheme: apre l'app nativa direttamente. Se non installata,
    // il browser non navighera' e l'utente puo' usare il fallback web.
    function openTelegramApp(e: React.MouseEvent) {
      e.preventDefault();
      if (!BOT_USERNAME) return;
      const appUrl = `tg://resolve?domain=${BOT_USERNAME}`;
      const webUrl = `https://t.me/${BOT_USERNAME}`;
      // Tentativo 1: app nativa
      window.location.href = appUrl;
      // Fallback dopo 1.2s se l'app non e' stata aperta (la pagina e' ancora visibile)
      setTimeout(() => {
        if (!document.hidden) {
          window.open(webUrl, "_blank", "noopener,noreferrer");
        }
      }, 1200);
    }
    return (
      <div className={className} style={style}>
        <a
          href={BOT_USERNAME ? `https://t.me/${BOT_USERNAME}` : "#"}
          onClick={openTelegramApp}
          style={{
            display: "inline-flex", alignItems: "center", gap: 8, width: "100%",
            padding: "8px 12px", borderRadius: 10,
            background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.4)",
            color: "#5eda8e", fontSize: 12, fontWeight: 600, textDecoration: "none",
            justifyContent: "center", cursor: "pointer",
          }}
        >
          <CheckCircle2 size={14} /> Apri Telegram
        </a>
      </div>
    );
  }

  // ── stato "errore dal redirect" ───────────────────────────────────────
  const redirectError =
    status === "expired" ? "Codice scaduto, riprova." :
    status === "invalid" ? "Firma Telegram non valida." :
    status === "error"   ? "Errore collegamento, riprova." : null;

  // ── stato base: bottone che richiede state token, poi widget ─────────
  const labelBase = "Continua su Telegram";
  const showSpinner = loading;

  return (
    <div className={className} style={style}>
      {!stateToken && (
        <button
          type="button"
          onClick={fetchStateToken}
          disabled={loading}
          title={!expanded ? labelBase : undefined}
          style={{
            width: "100%", display: "flex", alignItems: "center", gap: 10,
            padding: expanded ? "8px 10px" : "8px", borderRadius: 10,
            background: "rgba(34,158,217,0.12)", border: "1px solid rgba(34,158,217,0.35)",
            color: "#5ec0e9", fontSize: 12, fontWeight: 600,
            cursor: loading ? "wait" : "pointer",
            justifyContent: expanded ? "flex-start" : "center",
          }}
        >
          {showSpinner ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          {expanded && <span>{labelBase}</span>}
        </button>
      )}

      {/* Container per il widget Telegram (iframe) — appare dopo lo state token */}
      {stateToken && (
        <div style={{
          display: "flex", flexDirection: "column", gap: 6, alignItems: "stretch",
          padding: "8px 10px", borderRadius: 10,
          background: "rgba(34,158,217,0.08)", border: "1px solid rgba(34,158,217,0.2)",
        }}>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)" }}>
            Conferma l'accesso con Telegram:
          </div>
          <div ref={containerRef} style={{ display: "flex", justifyContent: "center" }} />
          <a
            href={BOT_USERNAME ? `tg://resolve?domain=${BOT_USERNAME}` : "#"}
            style={{
              fontSize: 10, color: "rgba(255,255,255,0.4)", textAlign: "center",
              textDecoration: "none", display: "inline-flex", alignItems: "center",
              justifyContent: "center", gap: 4, marginTop: 2,
            }}
          >
            <ExternalLink size={10} /> apri t.me/{BOT_USERNAME}
          </a>
        </div>
      )}

      {(error || redirectError) && (
        <div style={{ marginTop: 6, fontSize: 11, color: "#ff6b6b" }}>
          {error || redirectError}
        </div>
      )}
    </div>
  );
}
