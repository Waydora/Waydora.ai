import { useState } from "react";
import { Send, Loader2, ExternalLink, Copy, CheckCircle2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

const BOT_API = (import.meta.env.VITE_TELEGRAM_BOT_URL as string) || "";

type Variant = "default" | "sidebar" | "chat-chip";
type Props = { variant?: Variant; expanded?: boolean; className?: string; style?: React.CSSProperties };

type FetchResult = { ok: true; url: string } | { ok: false; error: string };

async function fetchBindUrl(): Promise<FetchResult> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { ok: false, error: "Devi accedere prima." };
  if (!BOT_API) {
    console.warn("[telegram] VITE_TELEGRAM_BOT_URL non configurata");
    return { ok: false, error: "Bot non ancora attivo (config mancante)." };
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
  return { ok: true, url };
}

export function ConnectTelegramButton({ variant = "default", expanded = true, className, style }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkUrl, setLinkUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // PATTERN POPUP-SAFE: apri tab vuota SUBITO (sincrono, nel gesture context),
  // poi aggiorna location.href quando arriva il token dal server.
  // Senza questo, Safari iOS e Chrome mobile bloccano window.open dopo await fetch.
  async function handle() {
    setError(null);
    setCopied(false);
    setLoading(true);
    const opened = window.open("about:blank", "_blank"); // sincrono al click
    const result = await fetchBindUrl();
    setLoading(false);

    if (!result.ok) {
      if (opened) opened.close();
      setError(result.error);
      return;
    }
    if (opened && !opened.closed) {
      opened.location.href = result.url;
    } else {
      // popup bloccato (alcuni in-app browser): mostra link cliccabile
      setLinkUrl(result.url);
    }
  }

  async function copyLink() {
    if (!linkUrl) return;
    try {
      await navigator.clipboard.writeText(linkUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  // Estrae il token dalla URL t.me/...?start=<token> per il fallback manuale.
  const bindCmd = linkUrl ? `/bind ${new URL(linkUrl).searchParams.get("start") ?? ""}` : "";

  async function copyBindCmd() {
    if (!bindCmd) return;
    try {
      await navigator.clipboard.writeText(bindCmd);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }
  void copyLink;

  // ── Fallback UI quando il popup viene bloccato ─────────────────────────
  const fallback = linkUrl && (
    <div style={{ marginTop: 8, padding: 12, background: "rgba(34,158,217,0.08)", border: "1px solid rgba(34,158,217,0.3)", borderRadius: 10, display: "flex", flexDirection: "column", gap: 10 }}>
      <a href={linkUrl} target="_blank" rel="noopener noreferrer"
        style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px 12px", background: "#229ED9", color: "#fff", borderRadius: 8, textDecoration: "none", fontSize: 13, fontWeight: 600 }}>
        <ExternalLink size={14} /> Apri in Telegram
      </a>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", lineHeight: 1.4 }}>
        Se il bot non ti collega in automatico, incolla questo comando nella chat:
      </div>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <code style={{ flex: 1, fontSize: 11, padding: "6px 8px", background: "rgba(0,0,0,0.35)", color: "#5ec0e9", borderRadius: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {bindCmd}
        </code>
        <button type="button" onClick={copyBindCmd}
          style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "6px 10px", background: "transparent", color: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 6, fontSize: 11, cursor: "pointer" }}>
          {copied ? <CheckCircle2 size={12} /> : <Copy size={12} />}
          {copied ? "Ok" : "Copia"}
        </button>
      </div>
    </div>
  );

  if (variant === "sidebar") {
    return (
      <div className={className} style={style}>
        <button
          type="button"
          onClick={handle}
          disabled={loading}
          title={!expanded ? "Continua su Telegram" : undefined}
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
        {error && <div style={{ marginTop: 6, fontSize: 11, color: "#ff6b6b" }}>{error}</div>}
        {fallback}
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
        {fallback}
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
      {fallback}
    </div>
  );
}
