import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, Link } from "wouter";
import {
  Loader2, MessageSquare, Copy, Navigation, ExternalLink,
  CheckSquare, Square, Lightbulb, Camera, DollarSign,
  Plus, X, ShoppingBag, Check, Send, Download, Cloud,
  Calendar, FileText,
} from "lucide-react";
import { Layout } from "@/components/layout";
import { ItineraryResults } from "@/components/itinerary-results";
import { TripMap } from "@/components/trip-map";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { fetchWeather, type WeatherData } from "@/lib/weather";
import { useAuth } from "@/hooks/auth";
import { shouldUseRailway, AFFILIATES } from "@/lib/affiliates";

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
function TripChat({ slug, itinerary, onItineraryUpdate, onClose }: {
  slug: string; itinerary: any; onItineraryUpdate: (i: any) => void; onClose?: () => void;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [messages,    setMessages]    = useState<TripMessage[]>([]);
  const [input,       setInput]       = useState("");
  const [name,        setName]        = useState(() => user?.name ?? localStorage.getItem("waydora_guest_name") ?? "");
  const [isAiMode,    setIsAiMode]    = useState(false);
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

  // Realtime aggiornamenti itinerario — canale separato con ID univoco
  useEffect(() => {
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
    await sendMsg(`✨ ${prompt}`, "ai_request");
    try {
      // Modifica pesante (aggiungi giorno, rigenera, cambia destinazione) → Railway+Sonnet
      // Modifica leggera/chat → Vercel+Haiku
      const useRailway = shouldUseRailway(prompt, !!itinerary);
      const url = useRailway ? `${API_BASE}/api/chat` : `${CHAT_BASE}/api/chat`;
      const res = await fetch(url, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: prompt }],
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
  }, [input, aiPending, itinerary, slug, user, toast]);

  const msgBg = (t: TripMessage["type"]): React.CSSProperties => {
    if (t === "ai_request") return { background: "rgba(168,85,247,0.15)", border: "1px solid rgba(168,85,247,0.3)", borderRadius: "12px", padding: "10px 12px" };
    if (t === "ai_update")  return { background: "rgba(52,211,153,0.12)", border: "1px solid rgba(52,211,153,0.3)", borderRadius: "12px", padding: "10px 12px" };
    return { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: "12px", padding: "10px 12px" };
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: "#0d0a18" }}>
      {/* Header */}
      <div style={{ padding: "10px 16px", borderBottom: "1px solid rgba(255,255,255,0.08)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between", backgroundColor: "#0d0a18" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <MessageSquare style={{ width: "15px", height: "15px", color: "#a78bfa" }} />
          <span style={{ fontSize: "14px", fontWeight: 700, color: "#fff" }}>Chat di gruppo</span>
          <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.07)", padding: "2px 8px", borderRadius: "9999px" }}>{messages.length}</span>
        </div>
        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
          <div style={{ display: "flex", gap: "2px", background: "rgba(255,255,255,0.07)", borderRadius: "10px", padding: "3px" }}>
            <button onClick={() => setIsAiMode(false)} style={{ padding: "5px 10px", borderRadius: "7px", border: "none", fontSize: "12px", fontWeight: 600, cursor: "pointer", background: !isAiMode ? "rgba(255,255,255,0.14)" : "transparent", color: !isAiMode ? "#fff" : "rgba(255,255,255,0.4)" }}>💬</button>
            <button onClick={() => setIsAiMode(true)}  style={{ padding: "5px 10px", borderRadius: "7px", border: "none", fontSize: "12px", fontWeight: 600, cursor: "pointer", background: isAiMode ? "rgba(168,85,247,0.3)" : "transparent", color: isAiMode ? "#c4b5fd" : "rgba(255,255,255,0.4)" }}>✨ AI</button>
          </div>
          {onClose && <button onClick={onClose} style={{ background: "rgba(255,255,255,0.08)", border: "none", borderRadius: "8px", width: "30px", height: "30px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "rgba(255,255,255,0.6)" }}><X style={{ width: "14px", height: "14px" }} /></button>}
        </div>
      </div>

      {!user && (
        <div style={{ padding: "8px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0, backgroundColor: "#0d0a18" }}>
          <input value={name} onChange={e => { setName(e.target.value); localStorage.setItem("waydora_guest_name", e.target.value); }}
            placeholder="Il tuo nome (opzionale)"
            style={{ width: "100%", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", padding: "7px 12px", color: "#fff", fontSize: "13px", outline: "none" }} />
        </div>
      )}

      {isAiMode && (
        <div style={{ padding: "7px 16px", background: "rgba(168,85,247,0.1)", borderBottom: "1px solid rgba(168,85,247,0.2)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: "11px", color: "#c4b5fd" }}>✨ Modifica l'itinerario per tutti</span>
          {aiCallsLeft !== null && <span style={{ fontSize: "11px", color: aiCallsLeft <= 3 ? "#f87171" : "rgba(255,255,255,0.4)" }}>{aiCallsLeft} rimaste</span>}
        </div>
      )}

      {/* Messaggi */}
      <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px", display: "flex", flexDirection: "column", gap: "8px", backgroundColor: "#0d0a18" }}>
        {messages.length === 0
          ? <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "10px", color: "rgba(255,255,255,0.3)", textAlign: "center", padding: "60px 20px" }}>
              <MessageSquare style={{ width: "36px", height: "36px", opacity: 0.25 }} />
              <p style={{ fontSize: "14px", fontWeight: 600, color: "rgba(255,255,255,0.4)" }}>Nessun messaggio</p>
              <p style={{ fontSize: "12px" }}>Commenta o proponi una modifica AI!</p>
            </div>
          : messages.map(msg => (
            <div key={msg.id} style={msgBg(msg.type)}>
              <div style={{ fontSize: "13px", color: msg.type === "ai_update" ? "#6ee7b7" : "rgba(255,255,255,0.88)", marginBottom: "4px", lineHeight: 1.55 }}>{msg.text}</div>
              <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)" }}>{msg.author} · {new Date(msg.created_at).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}</div>
            </div>
          ))
        }
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: "10px 14px 14px", borderTop: "1px solid rgba(255,255,255,0.08)", flexShrink: 0, backgroundColor: "#0d0a18" }}>
        <div style={{ display: "flex", gap: "8px", alignItems: "flex-end" }}>
          <textarea value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (isAiMode) sendAi();
                else if (input.trim()) { sendMsg(input.trim()); setInput(""); }
              }
            }}
            placeholder={isAiMode ? "Es: aggiungi una giornata..." : "Scrivi un commento..."}
            rows={1} disabled={aiPending}
            style={{ flex: 1, background: "rgba(255,255,255,0.08)", border: `1px solid ${isAiMode ? "rgba(168,85,247,0.35)" : "rgba(255,255,255,0.13)"}`, borderRadius: "14px", padding: "9px 14px", color: "#fff", fontSize: "13px", outline: "none", resize: "none", maxHeight: "120px", fontFamily: "inherit" }} />
          <button
            onClick={() => { if (isAiMode) sendAi(); else if (input.trim()) { sendMsg(input.trim()); setInput(""); } }}
            disabled={!input.trim() || aiPending}
            style={{ width: "40px", height: "40px", borderRadius: "50%", border: "none", flexShrink: 0, cursor: input.trim() && !aiPending ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", background: input.trim() && !aiPending ? (isAiMode ? "linear-gradient(135deg,#a855f7,#6366f1)" : "linear-gradient(135deg,#f97316,#a855f7)") : "rgba(255,255,255,0.08)", color: "#fff", transition: "all 0.15s" }}>
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
    setInput("");
  };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", padding: "16px", gap: "12px", background: "#0a0a12" }}>
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
        <button onClick={add} style={{ width: "36px", height: "36px", borderRadius: "10px", background: "linear-gradient(135deg,#f97316,#a855f7)", border: "none", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
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
              <div style={{ width: "24px", height: "24px", borderRadius: "50%", background: "linear-gradient(135deg,#f97316,#a855f7)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 900, color: "#fff", flexShrink: 0 }}>{i + 1}</div>
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

function MediaPanel() {
  const [files, setFiles] = useState<Array<{ name: string; preview: string }>>([]);
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div style={{ padding: "20px", height: "100%", display: "flex", flexDirection: "column", gap: "14px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div><div style={{ fontSize: "15px", fontWeight: 700, color: "#fff" }}>📸 Foto e media</div><div style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)", marginTop: "2px" }}>Solo visibili su questo dispositivo</div></div>
        <input ref={ref} type="file" accept="image/*,video/*" multiple style={{ display: "none" }} onChange={e => { setFiles(p => [...p, ...Array.from(e.target.files ?? []).map(f => ({ name: f.name, preview: URL.createObjectURL(f) }))]); e.target.value = ""; }} />
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
  if (tool === "media")     return <MediaPanel />;
  if (tool === "expenses")  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: "12px", textAlign: "center", padding: "32px" }}>
      <div style={{ fontSize: "2.8rem" }}>💰</div>
      <div style={{ fontSize: "15px", fontWeight: 700, color: "#fff" }}>Gestione spese</div>
      <div style={{ fontSize: "12px", padding: "6px 16px", borderRadius: "9999px", background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.12)" }}>Prossimamente</div>
    </div>
  );
  return null;
}

// ── Main ──────────────────────────────────────────────────────────────────
export default function Trip() {
  const params = useParams();
  const slug = params.slug ?? "";
  const { toast } = useToast();

  const [itinerary,  setItinerary]  = useState<any>(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(false);
  const [activeTool, setActiveTool] = useState("itinerary");
  const [copied,     setCopied]     = useState(false);
  const [chatOpen,   setChatOpen]   = useState(false);
  const [msgCount,   setMsgCount]   = useState(0);

  // Carica dati viaggio
  useEffect(() => {
    if (!slug) { setError(true); setLoading(false); return; }
    supabase.from("saved_trips").select("*").eq("share_slug", slug).single()
      .then(({ data, error: err }) => {
        if (err || !data?.itinerary) setError(true);
        else setItinerary(data.itinerary);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [slug]);

  // Conteggio messaggi — canale univoco
  useEffect(() => {
    if (!slug) return;
    supabase.from("trip_messages").select("id", { count: "exact", head: true })
      .eq("share_slug", slug).in("type", ["message","ai_request","ai_update"])
      .then(({ count }) => { if (count) setMsgCount(count); });

    const id = chanId("cnt");
    const ch = supabase.channel(id)
      .on("postgres_changes", {
        event: "INSERT", schema: "public",
        table: "trip_messages", filter: `share_slug=eq.${slug}`,
      }, p => {
        if (["message","ai_request","ai_update"].includes((p.new as TripMessage).type))
          setMsgCount(v => v + 1);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [slug]);

  useEffect(() => {
    if (itinerary?.destination) document.title = `${itinerary.destination} — Waydora`;
  }, [itinerary]);

  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/trip/${slug}` : "";
  const copy = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
    toast({ title: "Link copiato!" });
  };

  if (loading) return (
    <Layout>
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: "#0a0a12", gap: "12px" }}>
        <Loader2 style={{ width: "32px", height: "32px", color: "#a78bfa", animation: "wds 0.8s linear infinite" }} />
        <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "14px" }}>Caricamento viaggio...</span>
        <style>{`@keyframes wds{to{transform:rotate(360deg)}}`}</style>
      </div>
    </Layout>
  );

  if (error || !itinerary) return (
    <Layout>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "20px", textAlign: "center", padding: "32px", background: "#0a0a12" }}>
        <div style={{ fontSize: "4rem" }}>🗺️</div>
        <h2 style={{ fontSize: "22px", fontWeight: 900, color: "#fff" }}>Viaggio non trovato</h2>
        <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.45)", maxWidth: "380px" }}>Il link potrebbe essere scaduto o il viaggio è stato eliminato.</p>
        <Link href="/"><button style={{ padding: "11px 28px", borderRadius: "9999px", background: "linear-gradient(135deg,#f97316,#a855f7)", border: "none", color: "#fff", fontSize: "14px", fontWeight: 700, cursor: "pointer" }}>← Torna alla home</button></Link>
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
      </div>
      {!mobile && (
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span>{itinerary.heroEmoji ?? "🗺️"}</span>
          <span style={{ fontSize: "14px", fontWeight: 700, color: "#fff" }}>{itinerary.title}</span>
        </div>
      )}
      <button onClick={copy} style={{ display: "flex", alignItems: "center", gap: "5px", padding: "6px 12px", borderRadius: "9999px", background: copied ? "rgba(52,211,153,0.15)" : "rgba(255,255,255,0.09)", border: copied ? "1px solid rgba(52,211,153,0.3)" : "1px solid rgba(255,255,255,0.18)", color: copied ? "#34d399" : "#fff", fontSize: "11px", fontWeight: 600, cursor: "pointer", transition: "all 0.2s" }}>
        {copied ? <Check style={{ width: "12px", height: "12px" }} /> : <Copy style={{ width: "12px", height: "12px" }} />}
        {copied ? "Copiato!" : "Copia"}
      </button>
    </div>
  );

  return (
    <Layout>
      <div style={{ position: "fixed", inset: 0, zIndex: -1, background: "#0a0a12" }}>
        <div style={{ position: "absolute", top: "-10%", right: "-5%", width: "50vw", height: "50vw", borderRadius: "50%", background: "radial-gradient(circle,rgba(249,115,22,0.12) 0%,transparent 65%)", filter: "blur(70px)" }} />
        <div style={{ position: "absolute", bottom: "5%", left: "-5%", width: "45vw", height: "45vw", borderRadius: "50%", background: "radial-gradient(circle,rgba(168,85,247,0.12) 0%,transparent 65%)", filter: "blur(70px)" }} />
      </div>

      {/* DESKTOP */}
      <div className="flex-1 min-h-0 hidden lg:flex flex-col">
        {hdr(false)}
        <div style={{ flex: 1, minHeight: 0, display: "flex" }}>
          <ToolbarDesktop active={activeTool} onChange={setActiveTool} />
          <div style={{ flex: 1, minHeight: 0, overflow: activeTool === "map" ? "hidden" : "auto" }}>
            {renderTool(activeTool, itinerary, slug, false)}
          </div>
          <div style={{ width: "420px", flexShrink: 0, borderLeft: "1px solid rgba(255,255,255,0.07)", display: "flex", flexDirection: "column", minHeight: 0 }}>
            <TripChat slug={slug} itinerary={itinerary} onItineraryUpdate={setItinerary} />
          </div>
        </div>
      </div>

      {/* MOBILE */}
      <div className="flex-1 min-h-0 lg:hidden flex flex-col">
        {hdr(true)}
        <div style={{ flex: 1, minHeight: 0, overflow: activeTool === "map" ? "hidden" : "auto", paddingBottom: activeTool === "map" ? "0" : `${TOOLBAR_H}px` }}>
          {renderTool(activeTool, itinerary, slug, true)}
        </div>

        {/* Toolbar fissa */}
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 30, height: `${TOOLBAR_H}px`, display: "flex", alignItems: "center", overflowX: "auto", scrollbarWidth: "none", padding: "0 4px 8px", background: "rgba(10,10,18,0.96)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderTop: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 -4px 24px rgba(0,0,0,0.5)" }}>
          {TOOLS.map(t => {
            const Icon = t.icon; const on = activeTool === t.id;
            return (
              <button key={t.id} onClick={() => setActiveTool(t.id)}
                style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", padding: "6px 10px", borderRadius: "10px", border: "none", flexShrink: 0, cursor: "pointer", transition: "all 0.15s", background: on ? "rgba(255,255,255,0.12)" : "transparent", color: on ? "#fff" : "rgba(255,255,255,0.45)", minWidth: "50px" }}>
                <Icon style={{ width: "18px", height: "18px" }} />
                <span style={{ fontSize: "9px", fontWeight: 600 }}>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* FAB chat */}
        <button onClick={() => setChatOpen(true)}
          style={{ position: "fixed", bottom: `${TOOLBAR_H + 16}px`, right: "16px", zIndex: 35, width: "52px", height: "52px", borderRadius: "50%", background: "linear-gradient(135deg,#f97316,#a855f7)", border: "2px solid rgba(255,255,255,0.2)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 20px rgba(249,115,22,0.4)" }}>
          <MessageSquare style={{ width: "22px", height: "22px", color: "#fff" }} />
          {msgCount > 0 && (
            <div style={{ position: "absolute", top: "-3px", right: "-3px", width: "18px", height: "18px", borderRadius: "50%", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: 700, color: "#f97316" }}>
              {msgCount > 9 ? "9+" : msgCount}
            </div>
          )}
        </button>

        {/* Drawer CSS-only */}
        <Drawer open={chatOpen} onClose={() => setChatOpen(false)}>
          <TripChat slug={slug} itinerary={itinerary} onItineraryUpdate={setItinerary} onClose={() => setChatOpen(false)} />
        </Drawer>
      </div>
    </Layout>
  );
}