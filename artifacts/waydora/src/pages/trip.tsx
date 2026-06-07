import { useEffect, useState, useRef, useCallback, Fragment, type ReactNode } from "react";
import { useParams, Link, useLocation } from "wouter";
import {
  Loader2, MessageSquare, Copy, Navigation, ExternalLink,
  CheckSquare, Square, Lightbulb, Camera, DollarSign,
  Plus, X, ShoppingBag, Check, Send, Download, Cloud,
  Calendar, FileText, Pencil, ChevronDown, ChevronUp,
} from "lucide-react";
import { Layout } from "@/components/layout";
import { ItineraryResults } from "@/components/itinerary-results";
import { TripMap } from "@/components/trip-map";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { fetchWeather, type WeatherData } from "@/lib/weather";
import { useAuth } from "@/hooks/auth";
import { shouldUseRailway, AFFILIATES } from "@/lib/affiliates";
import { track, hashSlug, destinationCountry } from "@/lib/analytics";

const URL_RX = /(https?:\/\/[^\s)]+[^\s).,;:!?])/g;
function renderWithLinks(text: string): ReactNode {
  return text.split(URL_RX).map((p, i) => /^https?:\/\//.test(p)
    ? <a key={i} href={p} target="_blank" rel="noopener noreferrer sponsored" style={{ color: "#fb923c", textDecoration: "underline", wordBreak: "break-all" }}>{p}</a>
    : <Fragment key={i}>{p}</Fragment>);
}

const AMAZON_TAG = "waydora-21";
const API_BASE   = import.meta.env.VITE_API_URL ?? "https://waydoraai-production.up.railway.app";
const CHAT_BASE  = import.meta.env.VITE_CHAT_URL ?? "";
const RATE_LIMIT_GUEST = 10;
const RATE_LIMIT_USER  = 50;
const TOOLBAR_H = 72;

type TripMessage = {
  id: string; share_slug: string; author: string;
  text: string; type: "message" | "ai_request" | "ai_update" | "idea";
  created_at: string;
};

const TOOLS = [
  { id: "itinerary", label: "Itinerario", icon: FileText },
  { id: "map",       label: "Mappa",      icon: Navigation },
  { id: "calendar",  label: "Calendario", icon: Calendar },
  { id: "weather",   label: "Meteo",      icon: Cloud },
  { id: "ideas",     label: "Idee",       icon: Lightbulb },
  { id: "bagaglio",  label: "Bagaglio",   icon: CheckSquare },
  { id: "media",     label: "Media",      icon: Camera },
  { id: "expenses",  label: "Spese",      icon: DollarSign },
];

// Genera ID canale univoco — evita conflitti quando React StrictMode
// monta/smonta due volte lo stesso componente
function chanId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

// ── CSS-only Drawer ───────────────────────────────────────────────────────
function Drawer({ open, onClose, children }: {
  open: boolean; onClose: () => void; children: React.ReactNode;
}) {
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <>
      <div onClick={onClose} style={{
        position: "fixed", inset: 0, zIndex: 40,
        background: "rgba(0,0,0,0.7)",
        opacity: open ? 1 : 0,
        pointerEvents: open ? "auto" : "none",
        transition: "opacity 0.28s ease",
      }} />
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 50,
        height: "82vh",
        backgroundColor: "#0d0a18",
        borderTop: "1px solid rgba(255,255,255,0.15)",
        borderRadius: "20px 20px 0 0",
        display: "flex", flexDirection: "column",
        overflow: "hidden",
        transform: open ? "translateY(0%)" : "translateY(100%)",
        transition: "transform 0.32s cubic-bezier(0.32,0.72,0,1)",
        willChange: "transform",
      }}>
        <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 4px", flexShrink: 0, backgroundColor: "#0d0a18" }}>
          <div style={{ width: "40px", height: "4px", borderRadius: "2px", background: "rgba(255,255,255,0.3)" }} />
        </div>
        <div style={{ flex: 1, minHeight: 0, backgroundColor: "#0d0a18" }}>
          {children}
        </div>
      </div>
    </>
  );
}

function WaydoraLogo() {
  return (
    <Link href="/">
      <button style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center" }}>
        <img src="/LOGO1.png" alt="Waydora"
          style={{ height: "34px", objectFit: "contain", filter: "brightness(0) invert(1)" }}
          onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
      </button>
    </Link>
  );
}

// ── TripChat ──────────────────────────────────────────────────────────────
// mode="ai"        → chat di modifica itinerario (✨), input in basso, limite 50
// mode="companions"→ messaggi tra i compagni di viaggio (💬), separati dall'AI
function TripChat({ slug, itinerary, onItineraryUpdate, onClose, onCollapse, mode = "ai", glass = false }: {
  slug: string; itinerary: any; onItineraryUpdate: (i: any) => void; onClose?: () => void;
  onCollapse?: () => void; mode?: "ai" | "companions"; glass?: boolean;
}) {
  const isAi = mode === "ai";
  // Variante glassmorfismo (usata su desktop): superficie traslucida + blur così si
  // intravede lo sfondo gradiente della pagina. Su mobile (Drawer) resta il fondo
  // pieno scuro. Le sezioni interne diventano trasparenti per non coprire il blur.
  const surfaceBg = glass ? "transparent" : "#0d0a18";
  const rootStyle: React.CSSProperties = glass
    ? { background: "var(--wd-glass)", backdropFilter: "blur(24px) saturate(160%)", WebkitBackdropFilter: "blur(24px) saturate(160%)" }
    : { backgroundColor: "#0d0a18" };
  const { user } = useAuth();
  const { toast } = useToast();
  const [messages,    setMessages]    = useState<TripMessage[]>([]);
  const [input,       setInput]       = useState("");
  const [name,        setName]        = useState(() => user?.name ?? localStorage.getItem("waydora_guest_name") ?? "");
  const [aiPending,   setAiPending]   = useState(false);
  const [aiCallsLeft, setAiCallsLeft] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const rateKey   = `trip_ai_calls_${slug}`;
  const rateLimit = user ? RATE_LIMIT_USER : RATE_LIMIT_GUEST;

  // Rate limit
  useEffect(() => {
    const s = localStorage.getItem(rateKey);
    if (s) {
      try {
        const { count, resetAt } = JSON.parse(s);
        if (Date.now() > resetAt) { localStorage.removeItem(rateKey); setAiCallsLeft(rateLimit); }
        else setAiCallsLeft(rateLimit - count);
      } catch { setAiCallsLeft(rateLimit); }
    } else { setAiCallsLeft(rateLimit); }
  }, [rateKey, rateLimit]);

  // Carica messaggi iniziali
  useEffect(() => {
    supabase.from("trip_messages").select("*")
      .eq("share_slug", slug)
      .in("type", ["message","ai_request","ai_update"])
      .order("created_at", { ascending: true }).limit(100)
      .then(({ data }) => { if (data) setMessages(data as TripMessage[]); });
  }, [slug]);

  // Realtime messaggi chat — UN SOLO canale con ID univoco
  useEffect(() => {
    const id = chanId("chat");
    const ch = supabase.channel(id)
      .on("postgres_changes", {
        event: "INSERT", schema: "public",
        table: "trip_messages", filter: `share_slug=eq.${slug}`,
      }, payload => {
        const m = payload.new as TripMessage;
        if (["message","ai_request","ai_update"].includes(m.type))
          setMessages(prev => prev.find(x => x.id === m.id) ? prev : [...prev, m]);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [slug]);

  // Realtime aggiornamenti itinerario — canale separato con ID univoco.
  // Solo in modalità AI: evita doppia sottoscrizione/toast quando su desktop
  // sono montati insieme il pannello AI e quello dei compagni.
  useEffect(() => {
    if (!isAi) return;
    const id = chanId("itin");
    const ch = supabase.channel(id)
      .on("postgres_changes", {
        event: "UPDATE", schema: "public",
        table: "saved_trips", filter: `share_slug=eq.${slug}`,
      }, p => {
        if (p.new?.itinerary) {
          onItineraryUpdate(p.new.itinerary);
          toast({ title: "✨ Itinerario aggiornato!" });
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [slug, onItineraryUpdate, toast]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const incAi = () => {
    const s = localStorage.getItem(rateKey);
    let count = 1; const resetAt = Date.now() + 3600000;
    if (s) { try { const d = JSON.parse(s); if (Date.now() < d.resetAt) count = d.count + 1; } catch {} }
    localStorage.setItem(rateKey, JSON.stringify({ count, resetAt }));
    setAiCallsLeft(rateLimit - count);
    return count <= rateLimit;
  };

  const sendMsg = async (text: string, type: TripMessage["type"] = "message") => {
    const author = (user?.name ?? name.trim()) || "Anonimo";
    if (!user) localStorage.setItem("waydora_guest_name", author);
    await supabase.from("trip_messages").insert({ share_slug: slug, author, text, type });
  };

  const sendAi = useCallback(async () => {
    if (!input.trim() || aiPending) return;
    if (!incAi()) { toast({ title: "Limite raggiunto", variant: "destructive" }); return; }
    const prompt = input.trim(); setInput(""); setAiPending(true);
    // Costruisci lo STORICO della conversazione prima di inserire la nuova richiesta.
    // Senza questo, l'Ai riceveva solo il messaggio singolo e perdeva il contesto
    // (es. "e c'è un sito?" dopo "orari navette?", o chiedeva "in quale città?"
    // pur avendo l'itinerario). Mappiamo ai_request→user / ai_update→assistant e
    // togliamo i prefissi emoji. Ultimi 8 turni per non gonfiare i token.
    const history = messages
      .filter(m => m.type === "ai_request" || m.type === "ai_update")
      .slice(-8)
      .map(m => ({
        role: (m.type === "ai_request" ? "user" : "assistant") as "user" | "assistant",
        content: m.text.replace(/^[✨✅🤖]\s*/, ""),
      }));
    await sendMsg(`✨ ${prompt}`, "ai_request");
    try {
      // Modifica pesante (aggiungi giorno, rigenera, cambia destinazione) → Railway+Sonnet
      // Modifica leggera/chat → Vercel+Haiku
      const useRailway = shouldUseRailway(prompt, !!itinerary);
      const url = useRailway ? `${API_BASE}/api/chat` : `${CHAT_BASE}/api/chat`;
      const res = await fetch(url, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...history, { role: "user", content: prompt }],
          existingItinerary: itinerary,
          userTier: user ? "free" : "guest",
        }),
      });
      let data: any;
      try { data = await res.json(); } catch { throw new Error("Risposta non valida dal server"); }

      if (res.status === 429) {
        toast({ title: data?.error ?? "Troppe richieste. Riprova più tardi.", variant: "destructive" });
        setAiPending(false); return;
      }
      if (!res.ok || data?.error) {
        toast({ title: data?.error ?? `Errore ${res.status}. Riprova.`, variant: "destructive" });
        setAiPending(false); return;
      }
      if (!data?.reply) {
        toast({ title: "Risposta incompleta. Riprova.", variant: "destructive" });
        setAiPending(false); return;
      }

      if (data.itinerary) {
        const { error: dbErr } = await supabase
          .from("saved_trips")
          .update({ itinerary: data.itinerary, updated_at: new Date().toISOString() })
          .eq("share_slug", slug);
        if (dbErr) {
          toast({ title: "Errore nel salvare l'aggiornamento: " + dbErr.message, variant: "destructive" });
          setAiPending(false); return;
        }
        await sendMsg(`✅ ${data.reply}`, "ai_update");
      } else {
        await sendMsg(`🤖 ${data.reply}`, "ai_update");
      }
    } catch (e: any) {
      toast({ title: e?.message ?? "Connessione persa. Riprova.", variant: "destructive" });
    }
    setAiPending(false);
  }, [input, aiPending, itinerary, slug, user, toast, messages]);

  const msgBg = (t: TripMessage["type"]): React.CSSProperties => {
    // Richiesta di modifica dell'utente → stile "bolla utente" caldo (come la chat principale)
    if (t === "ai_request") return { background: "rgba(251,146,60,0.14)", border: "1px solid rgba(251,146,60,0.26)", borderRadius: "12px", padding: "10px 12px", marginLeft: "auto", maxWidth: "85%" };
    // Risposta/conferma AI → neutro-verde tenue
    if (t === "ai_update")  return { background: "rgba(52,211,153,0.09)", border: "1px solid rgba(52,211,153,0.22)", borderRadius: "12px", padding: "10px 12px", maxWidth: "92%" };
    return { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: "12px", padding: "10px 12px" };
  };

  const displayMessages = messages.filter(m =>
    isAi ? (m.type === "ai_request" || m.type === "ai_update") : m.type === "message"
  );
  const submit = () => {
    if (isAi) { sendAi(); }
    else if (input.trim()) { sendMsg(input.trim()); setInput(""); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", ...rootStyle }}>
      {/* Header */}
      <div style={{ padding: "10px 16px", borderBottom: "1px solid rgba(255,255,255,0.08)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between", backgroundColor: surfaceBg }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "15px" }}>{isAi ? "✨" : "💬"}</span>
          <span style={{ fontSize: "14px", fontWeight: 700, color: "#fff" }}>{isAi ? "Modifica con l'AI" : "Messaggi compagni"}</span>
          {isAi
            ? (aiCallsLeft !== null && <span style={{ fontSize: "10px", fontWeight: 700, color: aiCallsLeft <= 3 ? "#f87171" : "rgba(255,255,255,0.45)", background: "rgba(255,255,255,0.07)", padding: "2px 8px", borderRadius: "9999px" }}>{aiCallsLeft} modifiche</span>)
            : <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.07)", padding: "2px 8px", borderRadius: "9999px" }}>{displayMessages.length}</span>}
        </div>
        {(onCollapse || onClose) && (
          <button onClick={onCollapse ?? onClose} title={onCollapse ? "Riduci" : "Chiudi"} style={{ background: "rgba(255,255,255,0.08)", border: "none", borderRadius: "8px", width: "30px", height: "30px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "rgba(255,255,255,0.6)" }}>
            {onCollapse ? <ChevronDown style={{ width: "16px", height: "16px" }} /> : <X style={{ width: "14px", height: "14px" }} />}
          </button>
        )}
      </div>

      {!user && (
        <div style={{ padding: "8px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0, backgroundColor: surfaceBg }}>
          <input value={name} onChange={e => { setName(e.target.value); localStorage.setItem("waydora_guest_name", e.target.value); }}
            placeholder="Il tuo nome (opzionale)"
            style={{ width: "100%", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", padding: "7px 12px", color: "#fff", fontSize: "13px", outline: "none" }} />
        </div>
      )}

      {isAi && (
        <div style={{ padding: "7px 16px", background: "rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.07)", flexShrink: 0 }}>
          <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)" }}>✨ Le modifiche aggiornano l'itinerario per tutti i compagni · ⚠️ non si possono annullare</span>
        </div>
      )}

      {/* Messaggi */}
      <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px", display: "flex", flexDirection: "column", gap: "8px", backgroundColor: surfaceBg }}>
        {displayMessages.length === 0
          ? <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "10px", color: "rgba(255,255,255,0.3)", textAlign: "center", padding: "60px 20px" }}>
              <span style={{ fontSize: "32px", opacity: 0.4 }}>{isAi ? "✨" : "💬"}</span>
              <p style={{ fontSize: "14px", fontWeight: 600, color: "rgba(255,255,255,0.4)" }}>{isAi ? "Nessuna modifica ancora" : "Nessun messaggio"}</p>
              <p style={{ fontSize: "12px" }}>{isAi ? "Es: \"aggiungi un giorno a Oia\" o \"più budget\"" : "Scrivi ai tuoi compagni di viaggio"}</p>
            </div>
          : displayMessages.map(msg => (
            <div key={msg.id} style={msgBg(msg.type)}>
              <div style={{ fontSize: "13px", color: msg.type === "ai_update" ? "#6ee7b7" : "rgba(255,255,255,0.88)", marginBottom: "4px", lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{renderWithLinks(msg.text)}</div>
              <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)" }}>{msg.author} · {new Date(msg.created_at).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}</div>
            </div>
          ))
        }
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: "10px 14px 14px", borderTop: "1px solid rgba(255,255,255,0.08)", flexShrink: 0, backgroundColor: surfaceBg }}>
        <div style={{ display: "flex", gap: "8px", alignItems: "flex-end" }}>
          <textarea value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder={isAi ? "Es: aggiungi una giornata a Oia..." : "Scrivi un commento..."}
            rows={1} disabled={aiPending}
            style={{ flex: 1, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.13)", borderRadius: "14px", padding: "9px 14px", color: "#fff", fontSize: "13px", outline: "none", resize: "none", maxHeight: "120px", fontFamily: "inherit" }} />
          <button
            onClick={submit}
            disabled={!input.trim() || aiPending}
            style={{ width: "40px", height: "40px", borderRadius: "50%", border: "none", flexShrink: 0, cursor: input.trim() && !aiPending ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", background: input.trim() && !aiPending ? "var(--wd-grad-warm)" : "rgba(255,255,255,0.08)", color: "#fff", transition: "all 0.15s" }}>
            {aiPending ? <Loader2 style={{ width: "15px", height: "15px", animation: "wds 0.8s linear infinite" }} /> : <Send style={{ width: "15px", height: "15px" }} />}
          </button>
        </div>
      </div>
      <style>{`@keyframes wds{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ── IdeasPanel — Supabase realtime con canale univoco ─────────────────────
function IdeasPanel({ slug }: { slug: string }) {
  const { user } = useAuth();
  const [ideas, setIdeas] = useState<TripMessage[]>([]);
  const [input, setInput] = useState("");
  const [name,  setName]  = useState(() => user?.name ?? localStorage.getItem("waydora_guest_name") ?? "");

  useEffect(() => {
    supabase.from("trip_messages").select("*")
      .eq("share_slug", slug).eq("type", "idea")
      .order("created_at", { ascending: true })
      .then(({ data }) => { if (data) setIdeas(data as TripMessage[]); });
  }, [slug]);

  // Canale con ID univoco per evitare conflitti
  useEffect(() => {
    const id = chanId("ideas");
    const ch = supabase.channel(id)
      .on("postgres_changes", {
        event: "INSERT", schema: "public",
        table: "trip_messages", filter: `share_slug=eq.${slug}`,
      }, p => {
        const m = p.new as TripMessage;
        if (m.type === "idea") setIdeas(prev => prev.find(x => x.id === m.id) ? prev : [...prev, m]);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [slug]);

  const add = async () => {
    if (!input.trim()) return;
    const author = (user?.name ?? name.trim()) || "Anonimo";
    if (!user) localStorage.setItem("waydora_guest_name", author);
    await supabase.from("trip_messages").insert({ share_slug: slug, author, text: input.trim(), type: "idea" });
    // Analytics: idea_added (spec §3 · Referral/Engagement, input WAGT).
    track("idea_added", { share_slug_hash: hashSlug(slug), is_authenticated: !!user });
    setInput("");
  };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", padding: "16px", gap: "12px", background: "var(--wd-bg)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <Lightbulb style={{ width: "16px", height: "16px", color: "#fbbf24" }} />
        <span style={{ fontSize: "15px", fontWeight: 700, color: "#fff" }}>Idee condivise</span>
        <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.06)", padding: "2px 8px", borderRadius: "9999px" }}>live per tutti</span>
      </div>
      {!user && (
        <input value={name} onChange={e => { setName(e.target.value); localStorage.setItem("waydora_guest_name", e.target.value); }}
          placeholder="Il tuo nome (opzionale)"
          style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", padding: "7px 12px", color: "#fff", fontSize: "12px", outline: "none" }} />
      )}
      <div style={{ display: "flex", gap: "8px" }}>
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter") add(); }}
          placeholder="Aggiungi un'idea..."
          style={{ flex: 1, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "10px", padding: "8px 12px", color: "#fff", fontSize: "13px", outline: "none" }} />
        <button onClick={add} style={{ width: "36px", height: "36px", borderRadius: "10px", background: "var(--wd-grad-warm)", border: "none", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
          <Plus style={{ width: "15px", height: "15px" }} />
        </button>
      </div>
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "7px" }}>
        {ideas.length === 0
          ? <div style={{ textAlign: "center", padding: "50px 20px", color: "rgba(255,255,255,0.3)" }}>
              <div style={{ fontSize: "2.5rem", marginBottom: "10px" }}>💡</div>
              <p style={{ fontSize: "13px", fontWeight: 600 }}>Nessuna idea ancora</p>
              <p style={{ fontSize: "12px", marginTop: "4px" }}>Visibili a tutti gli utenti del link</p>
            </div>
          : ideas.map(idea => (
            <div key={idea.id} style={{ display: "flex", gap: "8px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "10px", padding: "10px 12px" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.85)" }}>{idea.text}</div>
                <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", marginTop: "3px" }}>— {idea.author} · {new Date(idea.created_at).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}</div>
              </div>
              <button onClick={async () => { setIdeas(p => p.filter(i => i.id !== idea.id)); await supabase.from("trip_messages").delete().eq("id", idea.id); }}
                style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.3)", padding: 0, flexShrink: 0 }}>
                <X style={{ width: "13px", height: "13px" }} />
              </button>
            </div>
          ))
        }
      </div>
    </div>
  );
}

// ── MapPanel ──────────────────────────────────────────────────────────────
function MapPanel({ itinerary, toolbarH = 0 }: { itinerary: any; toolbarH?: number }) {
  const [ready, setReady] = useState(false);
  useEffect(() => { const t = setTimeout(() => setReady(true), 80); return () => clearTimeout(t); }, []);
  const openMaps = () => {
    const pts = (itinerary.days?.flatMap((d: any) => d.activities) ?? [])
      .filter((a: any) => a.coordinates?.lat && a.coordinates?.lng)
      .map((a: any) => `${a.coordinates.lat},${a.coordinates.lng}`).slice(0, 10);
    if (!pts.length) { window.open(`https://www.google.com/maps/search/${encodeURIComponent(itinerary.destination)}`, "_blank"); return; }
    window.open(`https://www.google.com/maps/dir/${pts.map((p: string) => encodeURIComponent(p)).join("/")}`, "_blank");
  };
  return (
    <div style={{ position: "relative", height: "100%", width: "100%" }}>
      <div style={{ position: "absolute", top: "12px", right: "12px", zIndex: 10 }}>
        <button onClick={openMaps} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 600, padding: "7px 14px", borderRadius: "9999px", background: "rgba(66,133,244,0.9)", color: "#fff", border: "none", cursor: "pointer", boxShadow: "0 2px 12px rgba(66,133,244,0.35)" }}>
          <Navigation style={{ width: "12px", height: "12px" }} />Google Maps<ExternalLink style={{ width: "11px", height: "11px" }} />
        </button>
      </div>
      <div style={{ position: "absolute", inset: 0, paddingBottom: toolbarH > 0 ? `${toolbarH}px` : "0" }}>
        {ready ? <TripMap itinerary={itinerary} /> : (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", gap: "10px", color: "rgba(255,255,255,0.4)" }}>
            <Loader2 style={{ width: "22px", height: "22px", animation: "wds 0.8s linear infinite" }} />
            <span style={{ fontSize: "13px" }}>Caricamento...</span>
            <style>{`@keyframes wds{to{transform:rotate(360deg)}}`}</style>
          </div>
        )}
      </div>
    </div>
  );
}

function CalendarPanel({ itinerary }: { itinerary: any }) {
  const exp = () => {
    const today = new Date();
    itinerary.days?.forEach((day: any, i: number) => {
      const d = new Date(today); d.setDate(today.getDate() + i);
      const ds = d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
      const nd = new Date(d); nd.setDate(d.getDate() + 1);
      const nds = nd.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
      const url = new URL("https://calendar.google.com/calendar/render");
      url.searchParams.set("action", "TEMPLATE");
      url.searchParams.set("text", `${itinerary.destination} - ${day.title}`);
      url.searchParams.set("dates", `${ds}/${nds}`);
      url.searchParams.set("details", `${day.summary ?? ""}\n\nCreato con Waydora 🗺️`);
      url.searchParams.set("location", itinerary.destination);
      setTimeout(() => window.open(url.toString(), "_blank"), i * 500);
    });
  };
  return (
    <div style={{ padding: "20px", height: "100%", overflowY: "auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px", flexWrap: "wrap", gap: "10px" }}>
        <div style={{ fontSize: "15px", fontWeight: 700, color: "#fff" }}>📅 Calendario viaggio</div>
        <button onClick={exp} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 600, padding: "7px 14px", borderRadius: "9999px", background: "rgba(66,133,244,0.15)", color: "#4285f4", border: "1px solid rgba(66,133,244,0.3)", cursor: "pointer" }}>
          <Download style={{ width: "12px", height: "12px" }} />Importa in Google Calendar
        </button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {itinerary.days?.map((day: any, i: number) => (
          <div key={day.day} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", padding: "12px 14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
              <div style={{ width: "24px", height: "24px", borderRadius: "50%", background: "var(--wd-grad-warm)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 900, color: "#fff", flexShrink: 0 }}>{i + 1}</div>
              <div style={{ fontSize: "13px", fontWeight: 700, color: "#fff" }}>{day.title}</div>
            </div>
            {day.activities?.map((a: any, ai: number) => (
              <div key={ai} style={{ display: "flex", gap: "8px", fontSize: "12px", marginBottom: "3px" }}>
                <span style={{ color: "rgba(255,255,255,0.4)", minWidth: "80px", flexShrink: 0 }}>{a.time}</span>
                <span style={{ color: "rgba(255,255,255,0.7)" }}>{a.title}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function WeatherPanel({ destination, durationDays }: { destination: string; durationDays: number }) {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    import("@/lib/weather").then(({ fetchWeather }) => {
      fetchWeather(destination, Math.min(durationDays + 1, 14))
        .then(d => { if (d) setWeather(d); })
        .finally(() => setLoading(false));
    });
  }, [destination, durationDays]);
  if (loading) return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", gap: "10px" }}><Loader2 style={{ width: "22px", height: "22px", color: "rgba(255,255,255,0.4)", animation: "wds 0.8s linear infinite" }} /><span style={{ fontSize: "13px", color: "rgba(255,255,255,0.4)" }}>Meteo...</span><style>{`@keyframes wds{to{transform:rotate(360deg)}}`}</style></div>;
  if (!weather) return <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: "10px" }}><div style={{ fontSize: "2.5rem" }}>⛅</div><p style={{ fontSize: "13px", color: "rgba(255,255,255,0.4)" }}>Dati non disponibili</p></div>;
  return (
    <div style={{ padding: "20px", height: "100%", overflowY: "auto" }}>
      <div style={{ marginBottom: "16px" }}><div style={{ fontSize: "15px", fontWeight: 700, color: "#fff" }}>🌤 Meteo a {weather.location}</div><div style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)" }}>{weather.country}</div></div>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {weather.days.map((day, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: "12px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", padding: "10px 14px" }}>
            <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.45)", minWidth: "72px" }}>{new Date(day.date).toLocaleDateString("it-IT", { weekday: "short", day: "numeric", month: "short" })}</div>
            <img src={day.icon} alt={day.condition} style={{ width: "32px", height: "32px" }} />
            <div style={{ flex: 1 }}><div style={{ fontSize: "13px", fontWeight: 600, color: "#fff" }}>{day.condition}</div><div style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)" }}>💨 {day.maxWindKph} km/h · 🌧 {day.chanceOfRain}%</div></div>
            <div style={{ fontSize: "16px", fontWeight: 800, color: "#fff" }}>{day.avgTempC}°C</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function YesimCard() {
  return (
    <a href={AFFILIATES.YESIM_URL} target="_blank" rel="noopener noreferrer sponsored"
       style={{ display: "block", textDecoration: "none", marginBottom: "16px" }}>
      <div style={{
        background: "linear-gradient(135deg,#10b981 0%,#06b6d4 100%)",
        borderRadius: "12px", padding: "12px 14px",
        display: "flex", alignItems: "center", gap: "10px",
      }}>
        <span style={{ fontSize: "1.6rem", flexShrink: 0 }}>📶</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "12px", fontWeight: 800, color: "#fff", marginBottom: "1px" }}>eSIM Yesim — internet senza roaming</div>
          <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.85)" }}>Attivazione in 2 minuti, paga solo quello che usi</div>
        </div>
        <ExternalLink style={{ width: "14px", height: "14px", color: "#fff", flexShrink: 0 }} />
      </div>
    </a>
  );
}

function BaggagePanel({ packingList, destination }: { packingList: any[]; destination: string }) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  if (!packingList?.length) return <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: "12px", color: "rgba(255,255,255,0.3)", padding: "32px", textAlign: "center" }}><CheckSquare style={{ width: "32px", height: "32px", opacity: 0.3 }} /><p>Nessun bagaglio</p></div>;
  return (
    <div style={{ padding: "20px", overflowY: "auto", height: "100%" }}>
      <h3 style={{ fontSize: "14px", fontWeight: 700, color: "#fff", marginBottom: "12px" }}>Lista Bagaglio</h3>
      <YesimCard />
      {packingList.map((cat: any, ci: number) => (
        <div key={cat.category} style={{ marginBottom: "18px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
            <h4 style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.2em", color: "rgba(255,255,255,0.5)" }}>{cat.category}</h4>
            <a href={`https://www.amazon.it/s?k=${encodeURIComponent(cat.category)}+viaggio&tag=${AMAZON_TAG}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: "10px", color: "#ff9900", textDecoration: "none" }}>Acquista →</a>
          </div>
          {cat.items.map((item: string, ii: number) => {
            const key = `${ci}-${ii}`; const ck = checked[key];
            return (
              <div key={ii} onClick={() => setChecked(p => ({ ...p, [key]: !p[key] }))} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", cursor: "pointer", marginBottom: "7px" }}>
                <button style={{ flexShrink: 0, background: "none", border: "none", padding: 0 }}>{ck ? <CheckSquare style={{ width: "14px", height: "14px", color: "rgba(255,255,255,0.5)" }} /> : <Square style={{ width: "14px", height: "14px", color: "rgba(255,255,255,0.2)" }} />}</button>
                <span style={{ flex: 1, color: ck ? "rgba(255,255,255,0.28)" : "rgba(255,255,255,0.75)", textDecoration: ck ? "line-through" : "none" }}>{item}</span>
                <a href={`https://www.amazon.it/s?k=${encodeURIComponent(item)}+viaggio&tag=${AMAZON_TAG}`} target="_blank" rel="noopener noreferrer" style={{ opacity: 0.4, color: "#ff9900", textDecoration: "none" }}><ShoppingBag style={{ width: "13px", height: "13px" }} /></a>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function MediaPanel({ slug }: { slug: string }) {
  const [files, setFiles] = useState<Array<{ name: string; preview: string }>>([]);
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div style={{ padding: "20px", height: "100%", display: "flex", flexDirection: "column", gap: "14px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div><div style={{ fontSize: "15px", fontWeight: 700, color: "#fff" }}>📸 Foto e media</div><div style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)", marginTop: "2px" }}>Solo visibili su questo dispositivo</div></div>
        <input ref={ref} type="file" accept="image/*,video/*" multiple style={{ display: "none" }} onChange={e => {
          const added = Array.from(e.target.files ?? []).map(f => ({ name: f.name, preview: URL.createObjectURL(f) }));
          setFiles(p => [...p, ...added]);
          // Analytics: media_added (spec §3 · Retention/Referral, UGC → WAGT).
          if (added.length) track("media_added", { share_slug_hash: hashSlug(slug), count: added.length });
          e.target.value = "";
        }} />
        <button onClick={() => ref.current?.click()} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 600, padding: "6px 12px", borderRadius: "9999px", background: "rgba(255,255,255,0.09)", color: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.15)", cursor: "pointer" }}><Plus style={{ width: "13px", height: "13px" }} />Carica</button>
      </div>
      {files.length === 0
        ? <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "10px", color: "rgba(255,255,255,0.3)", textAlign: "center" }}><Camera style={{ width: "36px", height: "36px", opacity: 0.3 }} /><p style={{ fontSize: "13px" }}>Nessun media ancora</p></div>
        : <div style={{ flex: 1, overflowY: "auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>{files.map((f, i) => <div key={i} style={{ position: "relative", borderRadius: "10px", overflow: "hidden", aspectRatio: "1" }}><img src={f.preview} alt={f.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /><button onClick={() => setFiles(p => p.filter((_, idx) => idx !== i))} style={{ position: "absolute", top: "4px", right: "4px", width: "20px", height: "20px", borderRadius: "50%", background: "rgba(0,0,0,0.7)", border: "none", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0 }}><X style={{ width: "11px", height: "11px" }} /></button></div>)}</div>
      }
    </div>
  );
}

function ToolbarDesktop({ active, onChange }: { active: string; onChange: (id: string) => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", width: "56px", borderRight: "1px solid rgba(255,255,255,0.07)", gap: "4px", padding: "12px 6px", flexShrink: 0, background: "rgba(10,10,18,0.95)" }}>
      {TOOLS.map(t => {
        const Icon = t.icon; const on = active === t.id;
        return (
          <button key={t.id} onClick={() => onChange(t.id)} title={t.label}
            style={{ width: "44px", height: "44px", borderRadius: "12px", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 0.15s", background: on ? "rgba(255,255,255,0.12)" : "transparent", color: on ? "#fff" : "rgba(255,255,255,0.38)" }}
            onMouseEnter={e => { if (!on) e.currentTarget.style.background = "rgba(255,255,255,0.07)"; }}
            onMouseLeave={e => { if (!on) e.currentTarget.style.background = "transparent"; }}>
            <Icon style={{ width: "18px", height: "18px" }} />
          </button>
        );
      })}
    </div>
  );
}

function renderTool(tool: string, itinerary: any, slug: string, isMobile = false) {
  if (tool === "itinerary") return <div style={{ padding: isMobile ? "16px" : "28px 32px", maxWidth: isMobile ? "none" : "680px", margin: "0 auto", paddingBottom: isMobile ? `${TOOLBAR_H + 16}px` : "48px" }}><ItineraryResults itinerary={itinerary} /></div>;
  if (tool === "map")       return <MapPanel itinerary={itinerary} toolbarH={isMobile ? TOOLBAR_H : 0} />;
  if (tool === "calendar")  return <CalendarPanel itinerary={itinerary} />;
  if (tool === "weather")   return <WeatherPanel destination={itinerary.destination} durationDays={itinerary.durationDays ?? 3} />;
  if (tool === "ideas")     return <IdeasPanel slug={slug} />;
  if (tool === "bagaglio")  return <BaggagePanel packingList={itinerary.packingList ?? []} destination={itinerary.destination} />;
  if (tool === "media")     return <MediaPanel slug={slug} />;
  if (tool === "expenses")  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: "12px", textAlign: "center", padding: "32px" }}>
      <div style={{ fontSize: "2.8rem" }}>💰</div>
      <div style={{ fontSize: "15px", fontWeight: 700, color: "#fff" }}>Gestione spese</div>
      <div style={{ fontSize: "12px", padding: "6px 16px", borderRadius: "9999px", background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.12)" }}>Prossimamente</div>
    </div>
  );
  return null;
}

// ── Template helpers ──────────────────────────────────────────────────────

function generateForkSlug(): string {
  return Math.random().toString(36).substring(2, 10);
}

// Banner fisso mobile e blocco desktop per i template di sola lettura
function TemplateBanner({ onFork, forking }: { onFork: () => void; forking: boolean }) {
  return (
    <>
      {/* Mobile: banner sopra la toolbar (z-index 29 per stare sotto il drawer ma sopra i contenuti) */}
      <div className="lg:hidden" style={{
        position: "fixed", bottom: `${TOOLBAR_H}px`, left: 0, right: 0, zIndex: 29,
        background: "linear-gradient(135deg,rgba(249,115,22,0.95) 0%,rgba(168,85,247,0.95) 100%)",
        padding: "10px 16px",
        display: "flex", alignItems: "center", gap: "10px",
        boxShadow: "0 -2px 16px rgba(249,115,22,0.4)",
      }}>
        <Pencil style={{ width: "16px", height: "16px", color: "#fff", flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "12px", fontWeight: 800, color: "#fff", lineHeight: 1.2 }}>Viaggio di esempio</div>
          <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.82)", lineHeight: 1.2 }}>Personalizza e condividi la tua copia</div>
        </div>
        <button
          onClick={onFork}
          disabled={forking}
          style={{
            display: "flex", alignItems: "center", gap: "6px",
            padding: "7px 14px", borderRadius: "9999px",
            background: forking ? "rgba(255,255,255,0.2)" : "#fff",
            color: forking ? "rgba(255,255,255,0.7)" : "#f97316",
            border: "none", fontSize: "12px", fontWeight: 800,
            cursor: forking ? "not-allowed" : "pointer",
            flexShrink: 0, whiteSpace: "nowrap",
            transition: "all 0.18s",
          }}
        >
          {forking
            ? <Loader2 style={{ width: "12px", height: "12px", animation: "wds 0.8s linear infinite" }} />
            : <Pencil style={{ width: "12px", height: "12px" }} />
          }
          {forking ? "Creando..." : "Personalizza"}
        </button>
      </div>

      {/* Desktop: nessun banner fisso — la CTA è inline nell'header (vedi hdr) */}
    </>
  );
}

// Pannello sostitutivo per chat/idee nei template
function TemplateLockedPanel({ onFork, forking }: { onFork: () => void; forking: boolean }) {
  return (
    <div style={{
      height: "100%", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: "32px 24px", gap: "16px", textAlign: "center",
      background: "#0d0a18",
    }}>
      <div style={{ fontSize: "3rem" }}>✈️</div>
      <div style={{ fontSize: "15px", fontWeight: 800, color: "#fff" }}>
        Questo è un viaggio di esempio
      </div>
      <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.5)", maxWidth: "280px", lineHeight: 1.55 }}>
        La chat e le idee sono disabilitate per i template condivisi. Crea la tua copia personale per modificarlo e discuterne con i tuoi compagni di viaggio.
      </div>
      <button
        onClick={onFork}
        disabled={forking}
        style={{
          display: "flex", alignItems: "center", gap: "8px",
          padding: "12px 24px", borderRadius: "9999px",
          background: forking ? "rgba(255,255,255,0.08)" : "var(--wd-grad-warm)",
          color: forking ? "rgba(255,255,255,0.5)" : "#fff",
          border: "none", fontSize: "14px", fontWeight: 800,
          cursor: forking ? "not-allowed" : "pointer",
          transition: "all 0.18s",
          boxShadow: forking ? "none" : "0 4px 20px rgba(249,115,22,0.4)",
        }}
      >
        {forking
          ? <Loader2 style={{ width: "16px", height: "16px", animation: "wds 0.8s linear infinite" }} />
          : <Pencil style={{ width: "16px", height: "16px" }} />
        }
        {forking ? "Creazione copia..." : "Personalizza questo viaggio"}
      </button>
      <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)" }}>
        Crea la tua copia da modificare e condividere
      </div>
    </div>
  );
}

// Riquadro introduttivo per i template: spiega a un visitatore nuovo (es. da
// TikTok) cosa puo' fare una volta arrivato sul viaggio pre-costruito.
function TemplateIntro({ destination, onFork, forking }: { destination: string; onFork: () => void; forking: boolean }) {
  const city = (destination || "").split(",")[0];
  const rows: Array<[string, string]> = [
    ["📖", "Sfoglialo giorno per giorno qui sotto"],
    ["🎟️", "Prenota alloggi, tour e trasporti dai link di ogni tappa"],
    ["✏️", "Rendilo tuo: modificalo, salvalo e condividilo coi compagni"],
  ];
  return (
    <div style={{ maxWidth: "680px", margin: "0 auto", padding: "16px 16px 0" }}>
      <div style={{ background: "linear-gradient(135deg,rgba(249,115,22,0.14),rgba(168,85,247,0.14))", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "16px", padding: "16px" }}>
        <div style={{ fontSize: "14px", fontWeight: 800, color: "#fff", marginBottom: "10px", lineHeight: 1.35 }}>
          👋 Questo è un itinerario pronto{city ? ` per ${city}` : ""}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "7px", marginBottom: "14px" }}>
          {rows.map(([emoji, text]) => (
            <div key={text} style={{ display: "flex", gap: "8px", fontSize: "12.5px", color: "rgba(255,255,255,0.74)", lineHeight: 1.5 }}>
              <span style={{ flexShrink: 0 }}>{emoji}</span><span>{text}</span>
            </div>
          ))}
        </div>
        <button onClick={onFork} disabled={forking}
          style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", padding: "11px", borderRadius: "12px", background: forking ? "rgba(255,255,255,0.1)" : "var(--wd-grad-warm)", color: forking ? "rgba(255,255,255,0.5)" : "#fff", border: "none", fontSize: "13.5px", fontWeight: 800, cursor: forking ? "not-allowed" : "pointer", boxShadow: forking ? "none" : "0 4px 18px rgba(249,115,22,0.35)" }}>
          {forking
            ? <Loader2 style={{ width: "15px", height: "15px", animation: "wds 0.8s linear infinite" }} />
            : <Pencil style={{ width: "15px", height: "15px" }} />}
          {forking ? "Creazione copia..." : "Personalizza questo viaggio"}
        </button>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────
export default function Trip() {
  const params = useParams();
  const slug = params.slug ?? "";
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const viewTrackedRef = useRef(false);

  const [itinerary,   setItinerary]   = useState<any>(null);
  const [isTemplate,  setIsTemplate]  = useState(false);
  const [tripTitle,   setTripTitle]   = useState<string>("");
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(false);
  const [activeTool,  setActiveTool]  = useState("itinerary");
  const [copied,      setCopied]      = useState(false);
  const [aiOpen,        setAiOpen]        = useState(false);
  const [companionsOpen, setCompanionsOpen] = useState(false);
  const [aiCollapsed,   setAiCollapsed]   = useState(true); // desktop: dock AI ridotto di default
  const [msgCount,    setMsgCount]    = useState(0);
  const [forking,     setForking]     = useState(false);

  // Carica dati viaggio
  useEffect(() => {
    if (!slug) { setError(true); setLoading(false); return; }
    supabase.from("saved_trips").select("*").eq("share_slug", slug).single()
      .then(({ data, error: err }) => {
        if (err || !data?.itinerary) setError(true);
        else {
          setItinerary(data.itinerary);
          setIsTemplate(!!data.is_template);
          setTripTitle(data.title ?? data.itinerary?.title ?? "");
          // Analytics (spec §3 · Referral): itinerary_viewed sempre; se chi apre
          // NON è l'owner del viaggio → shared_link_opened (invite acceptance).
          if (!viewTrackedRef.current) {
            viewTrackedRef.current = true;
            const isOwner = !!user && data.user_id === user.id;
            const slugHash = hashSlug(slug);
            track("itinerary_viewed", { trip_id: data.id, share_slug_hash: slugHash, is_owner: isOwner, is_template: !!data.is_template });
            if (!isOwner) {
              track("shared_link_opened", {
                trip_id: data.id,
                share_slug_hash: slugHash,
                is_authenticated: !!user,
                is_owner: false,
              });
            }
          }
        }
        setLoading(false);
      });
  }, [slug, user]);

  // Conteggio messaggi — canale univoco (saltato per i template: non hanno messaggi propri).
  // Il badge sta sul pulsante "messaggi compagni", quindi conta SOLO i messaggi dei
  // compagni (type "message"): le richieste/risposte AI (ai_request/ai_update) vivono
  // nella chat AI separata e non devono gonfiare questo contatore.
  useEffect(() => {
    if (!slug || isTemplate) return;
    supabase.from("trip_messages").select("id", { count: "exact", head: true })
      .eq("share_slug", slug).eq("type", "message")
      .then(({ count }) => { if (count) setMsgCount(count); });

    const id = chanId("cnt");
    const ch = supabase.channel(id)
      .on("postgres_changes", {
        event: "INSERT", schema: "public",
        table: "trip_messages", filter: `share_slug=eq.${slug}`,
      }, p => {
        if ((p.new as TripMessage).type === "message")
          setMsgCount(v => v + 1);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [slug, isTemplate]);

  useEffect(() => {
    if (itinerary?.destination) document.title = `${itinerary.destination} — Waydora`;
  }, [itinerary]);

  // ── Fork del template: crea una copia privata su saved_trips ─────────────
  const forkTemplate = useCallback(async () => {
    if (!itinerary || forking) return;
    setForking(true);
    try {
      const newSlug = generateForkSlug();
      const payload: Record<string, unknown> = {
        itinerary,
        share_slug: newSlug,
        title: tripTitle || itinerary.title || "Il mio viaggio",
        trip_id: null,
        notes: "",
        is_public: true,
        is_template: false,
        created_at: new Date().toISOString(),
      };
      // Assegna user_id solo se loggato
      if (user?.id) payload.user_id = user.id;

      const { data, error: insertErr } = await supabase
        .from("saved_trips")
        .insert(payload)
        .select()
        .single();

      if (insertErr || !data) {
        toast({ title: "Errore nella copia del viaggio. Riprova.", variant: "destructive" });
        setForking(false);
        return;
      }

      // Tracking PostHog (no PII)
      track("template_forked", {
        template_slug_hash: hashSlug(slug),
        is_authenticated: !!user,
        destination_country: destinationCountry(itinerary.destination),
      });

      setLocation(`/trip/${newSlug}`);
    } catch {
      toast({ title: "Errore di rete. Riprova.", variant: "destructive" });
      setForking(false);
    }
  }, [itinerary, forking, slug, tripTitle, user, toast, setLocation]);

  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/trip/${slug}` : "";
  const copy = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
    // Analytics: trip_shared (spec §3 · Referral, numeratore k-factor).
    track("trip_shared", { share_slug_hash: hashSlug(slug), method: "copy" });
    toast({ title: "Link copiato!" });
  };

  if (loading) return (
    <Layout>
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--wd-bg)", gap: "12px" }}>
        <Loader2 style={{ width: "32px", height: "32px", color: "#a78bfa", animation: "wds 0.8s linear infinite" }} />
        <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "14px" }}>Caricamento viaggio...</span>
        <style>{`@keyframes wds{to{transform:rotate(360deg)}}`}</style>
      </div>
    </Layout>
  );

  if (error || !itinerary) return (
    <Layout>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "20px", textAlign: "center", padding: "32px", background: "var(--wd-bg)" }}>
        <div style={{ fontSize: "4rem" }}>🗺️</div>
        <h2 style={{ fontSize: "22px", fontWeight: 900, color: "#fff" }}>Viaggio non trovato</h2>
        <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.45)", maxWidth: "380px" }}>Il link potrebbe essere scaduto o il viaggio è stato eliminato.</p>
        <Link href="/"><button style={{ padding: "11px 28px", borderRadius: "9999px", background: "var(--wd-grad-warm)", border: "none", color: "#fff", fontSize: "14px", fontWeight: 700, cursor: "pointer" }}>← Torna alla home</button></Link>
      </div>
    </Layout>
  );

  const hdr = (mobile: boolean) => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: mobile ? "10px 14px" : "10px 20px", borderBottom: "1px solid rgba(255,255,255,0.07)", flexShrink: 0, background: "rgba(10,10,18,0.95)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", minHeight: mobile ? "56px" : "54px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <WaydoraLogo />
        <div style={{ width: "1px", height: "20px", background: "rgba(255,255,255,0.1)" }} />
        <Link href="/?chat=1">
          <button style={{ display: "flex", alignItems: "center", gap: "5px", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "9px", padding: "5px 10px", color: "rgba(255,255,255,0.7)", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>
            <MessageSquare style={{ width: "12px", height: "12px" }} />{mobile ? "Pianif." : "Pianificatore"}
          </button>
        </Link>
        {/* Badge template visibile su entrambi i layout */}
        {isTemplate && (
          <span style={{ fontSize: "10px", fontWeight: 700, padding: "2px 8px", borderRadius: "9999px", background: "rgba(249,115,22,0.18)", color: "#fb923c", border: "1px solid rgba(249,115,22,0.3)" }}>
            ESEMPIO
          </span>
        )}
      </div>
      {!mobile && (
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span>{itinerary.heroEmoji ?? "🗺️"}</span>
          <span style={{ fontSize: "14px", fontWeight: 700, color: "#fff" }}>{itinerary.title}</span>
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        {/* CTA Personalizza — visibile su desktop (lg+) nell'header */}
        {isTemplate && !mobile && (
          <button
            onClick={forkTemplate}
            disabled={forking}
            style={{
              display: "flex", alignItems: "center", gap: "6px",
              padding: "7px 16px", borderRadius: "9999px",
              background: forking ? "rgba(249,115,22,0.2)" : "linear-gradient(135deg,#f97316,#a855f7)",
              color: forking ? "rgba(255,255,255,0.5)" : "#fff",
              border: "none", fontSize: "12px", fontWeight: 800,
              cursor: forking ? "not-allowed" : "pointer",
              transition: "all 0.18s",
              boxShadow: forking ? "none" : "0 2px 14px rgba(249,115,22,0.35)",
            }}
          >
            {forking
              ? <Loader2 style={{ width: "12px", height: "12px", animation: "wds 0.8s linear infinite" }} />
              : <Pencil style={{ width: "12px", height: "12px" }} />
            }
            {forking ? "Creando..." : "Personalizza questo viaggio"}
          </button>
        )}
        <button onClick={copy} style={{ display: "flex", alignItems: "center", gap: "5px", padding: "6px 12px", borderRadius: "9999px", background: copied ? "rgba(52,211,153,0.15)" : "rgba(255,255,255,0.09)", border: copied ? "1px solid rgba(52,211,153,0.3)" : "1px solid rgba(255,255,255,0.18)", color: copied ? "#34d399" : "#fff", fontSize: "11px", fontWeight: 600, cursor: "pointer", transition: "all 0.2s" }}>
          {copied ? <Check style={{ width: "12px", height: "12px" }} /> : <Copy style={{ width: "12px", height: "12px" }} />}
          {copied ? "Copiato!" : "Copia"}
        </button>
      </div>
    </div>
  );

  return (
    <Layout>
      <div style={{ position: "fixed", inset: 0, zIndex: -1, background: "var(--wd-bg)" }}>
        <div style={{ position: "absolute", top: "-10%", right: "-5%", width: "50vw", height: "50vw", borderRadius: "50%", background: "radial-gradient(circle,rgba(249,115,22,0.12) 0%,transparent 65%)", filter: "blur(70px)" }} />
        <div style={{ position: "absolute", bottom: "5%", left: "-5%", width: "45vw", height: "45vw", borderRadius: "50%", background: "radial-gradient(circle,rgba(168,85,247,0.12) 0%,transparent 65%)", filter: "blur(70px)" }} />
      </div>

      {/* DESKTOP */}
      <div className="flex-1 min-h-0 hidden lg:flex flex-col">
        {hdr(false)}
        <div style={{ flex: 1, minHeight: 0, display: "flex" }}>
          <ToolbarDesktop active={activeTool} onChange={setActiveTool} />
          {/* Colonna centrale: contenuto + chat modifiche AI in basso */}
          <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
            <div style={{ flex: 1, minHeight: 0, overflow: activeTool === "map" ? "hidden" : "auto" }}>
              {/* Intro per nuovi visitatori — solo template, sulla scheda Itinerario */}
              {isTemplate && (activeTool === "itinerary" || activeTool === "ideas") && (
                <TemplateIntro destination={itinerary.destination} onFork={forkTemplate} forking={forking} />
              )}
              {/* Nei template, le tool "ideas" vengono bloccate — reindirizza all'itinerary */}
              {renderTool(
                isTemplate && activeTool === "ideas" ? "itinerary" : activeTool,
                itinerary, slug, false
              )}
            </div>
            {/* Chat modifiche AI in basso — solo viaggio definitivo e solo nella scheda Itinerario.
                Collassabile: di default ridotta a una barra per non rubare spazio. */}
            {!isTemplate && activeTool === "itinerary" && (
              aiCollapsed ? (
                <button onClick={() => setAiCollapsed(false)}
                  style={{ flexShrink: 0, width: "100%", display: "flex", alignItems: "center", gap: "8px", padding: "12px 16px", background: "var(--wd-glass)", backdropFilter: "blur(24px) saturate(160%)", WebkitBackdropFilter: "blur(24px) saturate(160%)", border: "none", borderTop: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.72)", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
                  <span style={{ fontSize: "15px" }}>✨</span>
                  <span style={{ flex: 1, textAlign: "left" }}>Modifica con l'AI</span>
                  <ChevronUp style={{ width: "16px", height: "16px" }} />
                </button>
              ) : (
                <div style={{ height: "300px", flexShrink: 0, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                  <TripChat mode="ai" glass slug={slug} itinerary={itinerary} onItineraryUpdate={setItinerary} onCollapse={() => setAiCollapsed(true)} />
                </div>
              )
            )}
          </div>
          {/* Pannello laterale destro: messaggi dei compagni (o blocco template) */}
          <div style={{ width: "360px", flexShrink: 0, borderLeft: "1px solid rgba(255,255,255,0.07)", display: "flex", flexDirection: "column", minHeight: 0 }}>
            {isTemplate
              ? <TemplateLockedPanel onFork={forkTemplate} forking={forking} />
              : <TripChat mode="companions" glass slug={slug} itinerary={itinerary} onItineraryUpdate={setItinerary} />
            }
          </div>
        </div>
      </div>

      {/* MOBILE */}
      <div className="flex-1 min-h-0 lg:hidden flex flex-col">
        {hdr(true)}
        {/* Padding extra bottom quando il template banner è visibile (40px banner + TOOLBAR_H) */}
        <div style={{
          flex: 1, minHeight: 0,
          overflow: activeTool === "map" ? "hidden" : "auto",
          paddingBottom: activeTool === "map" ? "0" : `${TOOLBAR_H + (isTemplate ? 48 : (activeTool === "itinerary" ? 56 : 0))}px`,
        }}>
          {/* Intro per nuovi visitatori — solo template, sulla scheda Itinerario */}
          {isTemplate && (activeTool === "itinerary" || activeTool === "ideas") && (
            <TemplateIntro destination={itinerary.destination} onFork={forkTemplate} forking={forking} />
          )}
          {/* Nei template, blocca "ideas" — mostra itinerary al posto */}
          {renderTool(
            isTemplate && activeTool === "ideas" ? "itinerary" : activeTool,
            itinerary, slug, true
          )}
        </div>

        {/* Toolbar fissa */}
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 30, height: `${TOOLBAR_H}px`, display: "flex", alignItems: "center", overflowX: "auto", scrollbarWidth: "none", padding: "0 4px 8px", background: "rgba(10,10,18,0.96)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderTop: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 -4px 24px rgba(0,0,0,0.5)" }}>
          {TOOLS.map(t => {
            const Icon = t.icon; const on = activeTool === t.id;
            // In template mode evidenzia "ideas" come disabilitato
            const blocked = isTemplate && t.id === "ideas";
            return (
              <button key={t.id} onClick={() => { if (!blocked) setActiveTool(t.id); }}
                style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", padding: "6px 10px", borderRadius: "10px", border: "none", flexShrink: 0, cursor: blocked ? "default" : "pointer", transition: "all 0.15s", background: on ? "rgba(255,255,255,0.12)" : "transparent", color: blocked ? "rgba(255,255,255,0.18)" : on ? "#fff" : "rgba(255,255,255,0.45)", minWidth: "50px", opacity: blocked ? 0.4 : 1 }}>
                <Icon style={{ width: "18px", height: "18px" }} />
                <span style={{ fontSize: "9px", fontWeight: 600 }}>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Template banner sopra la toolbar — visibile solo in template mode */}
        {isTemplate && <TemplateBanner onFork={forkTemplate} forking={forking} />}

        {/* Barra modifiche AI in basso (stile chat-app) + accesso compagni —
            solo viaggio definitivo, solo scheda Itinerario. Sopra la toolbar fissa. */}
        {!isTemplate && activeTool === "itinerary" && (
          <div style={{ position: "fixed", bottom: `${TOOLBAR_H}px`, left: 0, right: 0, zIndex: 31, display: "flex", alignItems: "center", gap: "8px", padding: "8px 12px", background: "rgba(13,10,24,0.97)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderTop: "1px solid rgba(255,255,255,0.1)" }}>
            <button onClick={() => setAiOpen(true)}
              style={{ flex: 1, display: "flex", alignItems: "center", gap: "8px", padding: "9px 14px", borderRadius: "14px", background: "rgba(168,85,247,0.14)", border: "1px solid rgba(168,85,247,0.35)", color: "rgba(255,255,255,0.6)", fontSize: "13px", fontWeight: 600, cursor: "pointer", textAlign: "left" }}>
              <span style={{ fontSize: "15px" }}>✨</span>
              <span style={{ flex: 1 }}>Modifica con l'AI…</span>
            </button>
            <button onClick={() => setCompanionsOpen(true)}
              style={{ position: "relative", width: "44px", height: "44px", borderRadius: "13px", flexShrink: 0, background: "var(--wd-grad-warm)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 12px rgba(249,115,22,0.4)" }}>
              <MessageSquare style={{ width: "20px", height: "20px", color: "#fff" }} />
              {msgCount > 0 && (
                <div style={{ position: "absolute", top: "-4px", right: "-4px", width: "18px", height: "18px", borderRadius: "50%", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: 700, color: "#f97316" }}>
                  {msgCount > 9 ? "9+" : msgCount}
                </div>
              )}
            </button>
          </div>
        )}

        {/* Drawer modifiche AI (bottom sheet) — solo viaggio definitivo */}
        {!isTemplate && (
          <Drawer open={aiOpen} onClose={() => setAiOpen(false)}>
            <TripChat mode="ai" slug={slug} itinerary={itinerary} onItineraryUpdate={setItinerary} onClose={() => setAiOpen(false)} />
          </Drawer>
        )}

        {/* Drawer messaggi compagni — solo viaggio definitivo */}
        {!isTemplate && (
          <Drawer open={companionsOpen} onClose={() => setCompanionsOpen(false)}>
            <TripChat mode="companions" slug={slug} itinerary={itinerary} onItineraryUpdate={setItinerary} onClose={() => setCompanionsOpen(false)} />
          </Drawer>
        )}
      </div>
    </Layout>
  );
}