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
import { motion, AnimatePresence } from "framer-motion";

const AMAZON_TAG = "waydora-21";
const API_BASE   = import.meta.env.VITE_API_URL ?? "https://waydora-api-production.up.railway.app";
const RATE_LIMIT_GUEST = 10;
const RATE_LIMIT_USER  = 50;

const glassDark = {
  background: "rgba(10,10,18,0.92)",
  backdropFilter: "blur(24px)",
  WebkitBackdropFilter: "blur(24px)",
  border: "1px solid rgba(255,255,255,0.08)",
} as React.CSSProperties;

// FileText per Itinerario, non Map
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

function WaydoraLogo() {
  return (
    <Link href="/">
      <button style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center" }}>
        <img src="/LOGO1.png" alt="Waydora"
          style={{ height: "36px", objectFit: "contain", filter: "brightness(0) invert(1)" }}
          onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
      </button>
    </Link>
  );
}

type TripMessage = { id: string; share_slug: string; author: string; text: string; type: "message" | "ai_request" | "ai_update"; created_at: string; };

// ── Chat di gruppo ────────────────────────────────────────────────────────
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

  useEffect(() => {
    const stored = localStorage.getItem(rateKey);
    if (stored) {
      const { count, resetAt } = JSON.parse(stored);
      if (Date.now() > resetAt) { localStorage.removeItem(rateKey); setAiCallsLeft(rateLimit); }
      else setAiCallsLeft(rateLimit - count);
    } else setAiCallsLeft(rateLimit);
  }, [rateKey, rateLimit]);

  useEffect(() => {
    supabase.from("trip_messages").select("*").eq("share_slug", slug).order("created_at", { ascending: true }).limit(100)
      .then(({ data }) => { if (data) setMessages(data as TripMessage[]); });
  }, [slug]);

  useEffect(() => {
    const channel = supabase.channel(`trip_chat_${slug}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "trip_messages", filter: `share_slug=eq.${slug}` },
        (payload) => { const msg = payload.new as TripMessage; setMessages(prev => prev.find(m => m.id === msg.id) ? prev : [...prev, msg]); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [slug]);

  useEffect(() => {
    const channel = supabase.channel(`trip_itin_${slug}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "saved_trips", filter: `share_slug=eq.${slug}` },
        (payload) => {
          if (payload.new?.itinerary) {
            onItineraryUpdate(payload.new.itinerary);
            toast({ title: "✨ Itinerario aggiornato!" });
          }
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [slug, onItineraryUpdate, toast]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const incrementAiCalls = () => {
    const stored = localStorage.getItem(rateKey);
    let count = 1; const resetAt = Date.now() + 60 * 60 * 1000;
    if (stored) { const d = JSON.parse(stored); if (Date.now() < d.resetAt) count = d.count + 1; }
    localStorage.setItem(rateKey, JSON.stringify({ count, resetAt }));
    setAiCallsLeft(rateLimit - count);
    return count <= rateLimit;
  };

  const sendMessage = async (text: string, type: TripMessage["type"] = "message") => {
    const author = (user?.name ?? name.trim()) || "Anonimo";
    if (!user) localStorage.setItem("waydora_guest_name", author);
    await supabase.from("trip_messages").insert({ share_slug: slug, author, text, type });
  };

  const sendAiRequest = useCallback(async () => {
    if (!input.trim() || aiPending) return;
    if (!incrementAiCalls()) {
      toast({ title: "Limite raggiunto", description: user ? "Limite AI raggiunto." : "Accedi per più modifiche AI.", variant: "destructive" });
      return;
    }
    const prompt = input.trim(); setInput(""); setAiPending(true);
    await sendMessage(`✨ Richiesta AI: ${prompt}`, "ai_request");
    try {
      const response = await fetch(`${API_BASE}/api/chat`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [{ role: "user", content: prompt }], existingItinerary: itinerary }),
      });
      if (response.status === 429) { const d = await response.json(); toast({ title: "Troppe richieste", description: d.error, variant: "destructive" }); setAiPending(false); return; }
      const data = await response.json();
      if (data.itinerary) {
        await supabase.from("saved_trips").update({ itinerary: data.itinerary, updated_at: new Date().toISOString() }).eq("share_slug", slug);
        await sendMessage(`✅ Itinerario aggiornato: ${data.reply}`, "ai_update");
      } else {
        await sendMessage(`🤖 Waydora: ${data.reply}`, "ai_update");
      }
    } catch { toast({ title: "Errore", description: "Riprova.", variant: "destructive" }); }
    setAiPending(false);
  }, [input, aiPending, itinerary, slug, user, toast]);

  const msgStyle = (type: TripMessage["type"]): React.CSSProperties => {
    if (type === "ai_request") return { background: "rgba(168,85,247,0.12)", border: "1px solid rgba(168,85,247,0.25)", borderRadius: "12px", padding: "10px 12px" };
    if (type === "ai_update")  return { background: "rgba(52,211,153,0.1)",  border: "1px solid rgba(52,211,153,0.25)",  borderRadius: "12px", padding: "10px 12px" };
    return { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "12px", padding: "10px 12px" };
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ padding: "10px 16px", borderBottom: "1px solid rgba(255,255,255,0.07)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <MessageSquare style={{ width: "15px", height: "15px", color: "#a78bfa" }} />
          <span style={{ fontSize: "14px", fontWeight: 700, color: "#fff" }}>Chat di gruppo</span>
          <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.35)", background: "rgba(255,255,255,0.06)", padding: "2px 8px", borderRadius: "9999px" }}>{messages.length}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <div style={{ display: "flex", gap: "3px", background: "rgba(255,255,255,0.06)", borderRadius: "10px", padding: "3px" }}>
            <button onClick={() => setIsAiMode(false)} style={{ padding: "5px 12px", borderRadius: "7px", border: "none", fontSize: "12px", fontWeight: 600, cursor: "pointer", background: !isAiMode ? "rgba(255,255,255,0.12)" : "transparent", color: !isAiMode ? "#fff" : "rgba(255,255,255,0.4)" }}>💬 Commenta</button>
            <button onClick={() => setIsAiMode(true)}  style={{ padding: "5px 12px", borderRadius: "7px", border: "none", fontSize: "12px", fontWeight: 600, cursor: "pointer", background: isAiMode ? "rgba(168,85,247,0.25)" : "transparent", color: isAiMode ? "#a78bfa" : "rgba(255,255,255,0.4)" }}>✨ Modifica AI</button>
          </div>
          {onClose && <button onClick={onClose} style={{ background: "rgba(255,255,255,0.07)", border: "none", borderRadius: "8px", width: "28px", height: "28px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "rgba(255,255,255,0.5)" }}><X style={{ width: "14px", height: "14px" }} /></button>}
        </div>
      </div>

      {!user && (
        <div style={{ padding: "8px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
          <input value={name} onChange={e => { setName(e.target.value); localStorage.setItem("waydora_guest_name", e.target.value); }}
            placeholder="Il tuo nome (opzionale)"
            style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", padding: "6px 12px", color: "#fff", fontSize: "12px", outline: "none" }} />
        </div>
      )}

      {isAiMode && (
        <div style={{ padding: "8px 16px", background: "rgba(168,85,247,0.08)", borderBottom: "1px solid rgba(168,85,247,0.15)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: "12px", color: "#c4b5fd" }}>✨ Le tue richieste cambieranno l'itinerario per tutti</span>
          {aiCallsLeft !== null && <span style={{ fontSize: "11px", color: aiCallsLeft <= 3 ? "#f87171" : "rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.06)", padding: "2px 8px", borderRadius: "9999px", flexShrink: 0 }}>{aiCallsLeft} rimaste</span>}
        </div>
      )}

      <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px", display: "flex", flexDirection: "column", gap: "8px" }}>
        {messages.length === 0
          ? <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "10px", color: "rgba(255,255,255,0.3)", textAlign: "center", padding: "40px 20px" }}>
              <MessageSquare style={{ width: "32px", height: "32px", opacity: 0.3 }} />
              <p style={{ fontSize: "13px" }}>Nessun messaggio ancora.</p>
              <p style={{ fontSize: "12px" }}>Commenta o proponi una modifica AI!</p>
            </div>
          : messages.map(msg => (
            <div key={msg.id} style={msgStyle(msg.type)}>
              <div style={{ fontSize: "13px", color: msg.type === "ai_update" ? "rgba(52,211,153,0.9)" : "rgba(255,255,255,0.85)", marginBottom: "4px", lineHeight: 1.5 }}>{msg.text}</div>
              <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)" }}>{msg.author} · {new Date(msg.created_at).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}</div>
            </div>
          ))
        }
        <div ref={bottomRef} />
      </div>

      <div style={{ padding: "10px 14px", borderTop: "1px solid rgba(255,255,255,0.07)", flexShrink: 0, ...glassDark }}>
        <div style={{ display: "flex", gap: "8px", alignItems: "flex-end" }}>
          <textarea value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (isAiMode) sendAiRequest(); else { sendMessage(input.trim()); setInput(""); } } }}
            placeholder={isAiMode ? "Es: aggiungi una giornata, rendi il budget più economico..." : "Scrivi un commento..."}
            rows={1} disabled={aiPending}
            style={{ flex: 1, background: "rgba(255,255,255,0.07)", border: `1px solid ${isAiMode ? "rgba(168,85,247,0.3)" : "rgba(255,255,255,0.12)"}`, borderRadius: "14px", padding: "9px 14px", color: "#fff", fontSize: "13px", outline: "none", resize: "none", maxHeight: "100px", fontFamily: "inherit" }} />
          <button onClick={isAiMode ? sendAiRequest : () => { sendMessage(input.trim()); setInput(""); }} disabled={!input.trim() || aiPending}
            style={{ width: "40px", height: "40px", borderRadius: "50%", border: "none", flexShrink: 0, cursor: input.trim() && !aiPending ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s", background: input.trim() && !aiPending ? (isAiMode ? "linear-gradient(135deg,#a855f7,#6366f1)" : "linear-gradient(135deg,#f97316,#a855f7)") : "rgba(255,255,255,0.07)", color: "#fff" }}>
            {aiPending ? <Loader2 style={{ width: "15px", height: "15px", animation: "wd-spin 0.8s linear infinite" }} /> : <Send style={{ width: "15px", height: "15px" }} />}
          </button>
        </div>
      </div>
      <style>{`@keyframes wd-spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ── MapPanel — mappa estesa, pulsante Google Maps sovrapposto in alto ─────
function MapPanel({ itinerary }: { itinerary: any }) {
  const [mapLoaded, setMapLoaded] = useState(false);
  useEffect(() => { const t = setTimeout(() => setMapLoaded(true), 100); return () => clearTimeout(t); }, []);

  const openMaps = () => {
    const points = (itinerary.days?.flatMap((d: any) => d.activities) ?? [])
      .filter((a: any) => a.coordinates?.lat && a.coordinates?.lng)
      .map((a: any) => `${a.coordinates.lat},${a.coordinates.lng}`).slice(0, 10);
    if (!points.length) { window.open(`https://www.google.com/maps/search/${encodeURIComponent(itinerary.destination)}`, "_blank"); return; }
    window.open(`https://www.google.com/maps/dir/${points.map((p: string) => encodeURIComponent(p)).join("/")}`, "_blank");
  };

  return (
    <div style={{ height: "100%", position: "relative" }}>
      {/* Pulsante sovrapposto in alto a destra — non dentro un header separato */}
      <div style={{ position: "absolute", top: "12px", right: "12px", zIndex: 10 }}>
        <button onClick={openMaps}
          style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 600, padding: "7px 14px", borderRadius: "9999px", background: "rgba(66,133,244,0.92)", color: "#fff", border: "none", cursor: "pointer", boxShadow: "0 2px 12px rgba(66,133,244,0.4)" }}>
          <Navigation style={{ width: "12px", height: "12px" }} />Google Maps<ExternalLink style={{ width: "11px", height: "11px" }} />
        </button>
      </div>
      {mapLoaded
        ? <TripMap itinerary={itinerary} />
        : <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", gap: "10px", color: "rgba(255,255,255,0.4)" }}><Loader2 style={{ width: "22px", height: "22px", animation: "wd-spin 0.8s linear infinite" }} /><span style={{ fontSize: "13px" }}>Caricamento mappa...</span><style>{`@keyframes wd-spin{to{transform:rotate(360deg)}}`}</style></div>
      }
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
      url.searchParams.set("action", "TEMPLATE"); url.searchParams.set("text", `${itinerary.destination} - ${day.title}`);
      url.searchParams.set("dates", `${ds}/${nds}`); url.searchParams.set("details", `${day.summary ?? ""}\n\nCreato con Waydora 🗺️`);
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
  const [error,   setError]   = useState(false);
  useEffect(() => {
    import("@/lib/weather").then(({ fetchWeather }) => {
      fetchWeather(destination, Math.min(durationDays + 1, 14))
        .then(d => { if (d) setWeather(d); else setError(true); })
        .catch(() => setError(true)).finally(() => setLoading(false));
    });
  }, [destination, durationDays]);
  if (loading) return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", gap: "10px" }}><Loader2 style={{ width: "22px", height: "22px", color: "rgba(255,255,255,0.4)", animation: "wd-spin 0.8s linear infinite" }} /><span style={{ fontSize: "13px", color: "rgba(255,255,255,0.4)" }}>Caricamento meteo...</span><style>{`@keyframes wd-spin{to{transform:rotate(360deg)}}`}</style></div>;
  if (error || !weather) return <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: "10px" }}><div style={{ fontSize: "2.5rem" }}>⛅</div><p style={{ fontSize: "13px", color: "rgba(255,255,255,0.4)" }}>Dati non disponibili</p></div>;
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

function IdeasPanel({ slug }: { slug: string }) {
  const [ideas, setIdeas] = useState<Array<{ id: string; text: string; author: string; ts: string }>>([]);
  const [input, setInput] = useState("");
  const [name,  setName]  = useState(() => localStorage.getItem("waydora_guest_name") ?? "");
  useEffect(() => { const s = localStorage.getItem(`trip_ideas_${slug}`); if (s) { try { setIdeas(JSON.parse(s)); } catch {} } }, [slug]);
  const persist = (u: typeof ideas) => localStorage.setItem(`trip_ideas_${slug}`, JSON.stringify(u));
  const add = () => { if (!input.trim()) return; const author = name.trim() || "Anonimo"; localStorage.setItem("waydora_guest_name", author); const updated = [...ideas, { id: Date.now().toString(), text: input.trim(), author, ts: new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }) }]; setIdeas(updated); persist(updated); setInput(""); };
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", padding: "16px", gap: "12px" }}>
      <div style={{ fontSize: "15px", fontWeight: 700, color: "#fff" }}>💡 Idee</div>
      <input value={name} onChange={e => { setName(e.target.value); localStorage.setItem("waydora_guest_name", e.target.value); }} placeholder="Il tuo nome" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", padding: "7px 12px", color: "#fff", fontSize: "12px", outline: "none" }} />
      <div style={{ display: "flex", gap: "8px" }}>
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter") add(); }} placeholder="Aggiungi un'idea..." style={{ flex: 1, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "10px", padding: "8px 12px", color: "#fff", fontSize: "13px", outline: "none" }} />
        <button onClick={add} style={{ width: "36px", height: "36px", borderRadius: "10px", background: "linear-gradient(135deg,#f97316,#a855f7)", border: "none", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}><Plus style={{ width: "15px", height: "15px" }} /></button>
      </div>
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "7px" }}>
        {ideas.length === 0 ? <div style={{ textAlign: "center", padding: "40px", color: "rgba(255,255,255,0.3)" }}><div style={{ fontSize: "2rem", marginBottom: "8px" }}>💡</div><p style={{ fontSize: "13px" }}>Nessuna idea ancora</p></div>
          : ideas.map(idea => <div key={idea.id} style={{ display: "flex", alignItems: "center", gap: "8px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "10px", padding: "10px 12px" }}><div style={{ flex: 1 }}><div style={{ fontSize: "13px", color: "rgba(255,255,255,0.85)" }}>{idea.text}</div><div style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", marginTop: "3px" }}>— {idea.author} · {idea.ts}</div></div><button onClick={() => { const u = ideas.filter(i => i.id !== idea.id); setIdeas(u); persist(u); }} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.3)", padding: 0 }}><X style={{ width: "13px", height: "13px" }} /></button></div>)}
      </div>
    </div>
  );
}

function BaggagePanel({ packingList, destination }: { packingList: any[]; destination: string }) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  if (!packingList?.length) return <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: "12px", color: "rgba(255,255,255,0.3)", padding: "32px", textAlign: "center" }}><CheckSquare style={{ width: "32px", height: "32px", opacity: 0.3 }} /><p style={{ fontSize: "13px" }}>Nessun bagaglio</p></div>;
  return (
    <div style={{ padding: "20px", overflowY: "auto", height: "100%" }}>
      <h3 style={{ fontSize: "14px", fontWeight: 700, color: "#fff", marginBottom: "18px" }}>Lista Bagaglio</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
        {packingList.map((cat: any, ci: number) => (
          <div key={cat.category}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
              <h4 style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.2em", color: "rgba(255,255,255,0.5)" }}>{cat.category}</h4>
              <a href={`https://www.amazon.it/s?k=${encodeURIComponent(cat.category)}+viaggio&tag=${AMAZON_TAG}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: "10px", color: "#ff9900", textDecoration: "none", opacity: 0.6 }}>Acquista →</a>
            </div>
            <ul style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {cat.items.map((item: string, ii: number) => {
                const key = `${ci}-${ii}`; const isChecked = checked[key];
                return <li key={ii} onClick={() => setChecked(p => ({ ...p, [key]: !p[key] }))} style={{ display: "flex", alignItems: "flex-start", gap: "8px", fontSize: "13px", cursor: "pointer" }}><button style={{ marginTop: "1px", flexShrink: 0, background: "none", border: "none", padding: 0 }}>{isChecked ? <CheckSquare style={{ width: "14px", height: "14px", color: "rgba(255,255,255,0.5)" }} /> : <Square style={{ width: "14px", height: "14px", color: "rgba(255,255,255,0.2)" }} />}</button><div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px" }}><span style={{ color: isChecked ? "rgba(255,255,255,0.28)" : "rgba(255,255,255,0.75)", textDecoration: isChecked ? "line-through" : "none" }}>{item}</span><a href={`https://www.amazon.it/s?k=${encodeURIComponent(item)}+viaggio&tag=${AMAZON_TAG}`} target="_blank" rel="noopener noreferrer" style={{ flexShrink: 0, opacity: 0.4, color: "#ff9900", textDecoration: "none" }}><ShoppingBag style={{ width: "13px", height: "13px" }} /></a></div></li>;
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function MediaPanel({ slug }: { slug: string }) {
  const [files, setFiles] = useState<Array<{ name: string; preview: string }>>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => { setFiles(prev => [...prev, ...Array.from(e.target.files ?? []).map(f => ({ name: f.name, preview: URL.createObjectURL(f) }))]); e.target.value = ""; };
  return (
    <div style={{ padding: "20px", height: "100%", display: "flex", flexDirection: "column", gap: "14px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: "15px", fontWeight: 700, color: "#fff" }}>📸 Foto e media</div>
        <input ref={fileRef} type="file" accept="image/*,video/*" multiple style={{ display: "none" }} onChange={handleUpload} />
        <button onClick={() => fileRef.current?.click()} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 600, padding: "6px 12px", borderRadius: "9999px", background: "rgba(255,255,255,0.09)", color: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.15)", cursor: "pointer" }}><Plus style={{ width: "13px", height: "13px" }} />Carica</button>
      </div>
      {files.length === 0 ? <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "10px", color: "rgba(255,255,255,0.3)", textAlign: "center" }}><Camera style={{ width: "36px", height: "36px", opacity: 0.3 }} /><p style={{ fontSize: "13px" }}>Nessun media ancora</p></div>
        : <div style={{ flex: 1, overflowY: "auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>{files.map((f, i) => <div key={i} style={{ position: "relative", borderRadius: "10px", overflow: "hidden", aspectRatio: "1" }}><img src={f.preview} alt={f.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /><button onClick={() => setFiles(prev => prev.filter((_, idx) => idx !== i))} style={{ position: "absolute", top: "4px", right: "4px", width: "20px", height: "20px", borderRadius: "50%", background: "rgba(0,0,0,0.7)", border: "none", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0 }}><X style={{ width: "11px", height: "11px" }} /></button></div>)}</div>}
    </div>
  );
}

// ── Toolbar verticale desktop ─────────────────────────────────────────────
function ToolbarDesktop({ active, onChange }: { active: string; onChange: (id: string) => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", width: "56px", borderRight: "1px solid rgba(255,255,255,0.07)", gap: "4px", padding: "12px 6px", flexShrink: 0, ...glassDark }}>
      {TOOLS.map(t => {
        const Icon = t.icon; const isActive = active === t.id;
        return (
          <button key={t.id} onClick={() => onChange(t.id)} title={t.label}
            style={{ width: "44px", height: "44px", borderRadius: "12px", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 0.15s", background: isActive ? "rgba(255,255,255,0.12)" : "transparent", color: isActive ? "#fff" : "rgba(255,255,255,0.38)" }}
            onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "rgba(255,255,255,0.07)"; }}
            onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}>
            <Icon style={{ width: "18px", height: "18px" }} />
          </button>
        );
      })}
    </div>
  );
}

// ── FAB chat — gradiente logo arancio→viola, posizionato sopra zoom ───────
function ChatFAB({ messageCount, onClick }: { messageCount: number; onClick: () => void }) {
  return (
    <button onClick={onClick}
      style={{
        position: "fixed",
        bottom: "150px", // sopra i controlli zoom Google Maps (~70-120px dal basso nella toolbar)
        right: "16px",
        zIndex: 35,
        width: "52px", height: "52px", borderRadius: "50%",
        background: "linear-gradient(135deg, #f97316, #a855f7)",
        border: "2px solid rgba(255,255,255,0.2)",
        cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: "0 4px 20px rgba(249,115,22,0.4), 0 2px 8px rgba(168,85,247,0.3)",
        transition: "transform 0.15s",
      }}>
      <MessageSquare style={{ width: "22px", height: "22px", color: "#fff" }} />
      {messageCount > 0 && (
        <div style={{ position: "absolute", top: "-3px", right: "-3px", width: "18px", height: "18px", borderRadius: "50%", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: 700, color: "#f97316" }}>
          {messageCount > 9 ? "9+" : messageCount}
        </div>
      )}
    </button>
  );
}

// ── Drawer chat mobile ────────────────────────────────────────────────────
function ChatDrawer({ slug, itinerary, onItineraryUpdate, open, onClose }: {
  slug: string; itinerary: any; onItineraryUpdate: (i: any) => void; open: boolean; onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}
            style={{ position: "fixed", inset: 0, zIndex: 40, background: "rgba(0,0,0,0.5)" }} />
          <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 50, height: "75vh", borderRadius: "20px 20px 0 0", overflow: "hidden", ...glassDark }}>
            <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 0" }}>
              <div style={{ width: "40px", height: "4px", borderRadius: "2px", background: "rgba(255,255,255,0.2)" }} />
            </div>
            <TripChat slug={slug} itinerary={itinerary} onItineraryUpdate={onItineraryUpdate} onClose={onClose} />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
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

  // Swipe — solo nella toolbar disabilitiamo il gesture di swipe-back
  const toolbarRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const isHorizontalScroll = useRef(false);

  useEffect(() => {
    if (!slug) return;
    supabase.from("saved_trips").select("*").eq("share_slug", slug).single()
      .then(({ data, error: err }) => {
        if (err || !data?.itinerary) setError(true);
        else setItinerary(data.itinerary);
        setLoading(false);
      });
  }, [slug]);

  useEffect(() => {
    if (!slug) return;
    supabase.from("trip_messages").select("id", { count: "exact", head: true }).eq("share_slug", slug)
      .then(({ count }) => { if (count) setMsgCount(count); });
    const channel = supabase.channel(`trip_count_${slug}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "trip_messages", filter: `share_slug=eq.${slug}` }, () => setMsgCount(prev => prev + 1))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [slug]);

  useEffect(() => { if (itinerary?.destination) document.title = `${itinerary.destination} — Waydora`; }, [itinerary]);

  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/trip/${slug}` : "";
  const handleCopy = async () => { await navigator.clipboard.writeText(shareUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); toast({ title: "Link copiato!" }); };

  const renderTool = (tool: string) => {
    if (!itinerary) return null;
    if (tool === "itinerary") return <div style={{ padding: "16px", paddingBottom: "24px" }}><ItineraryResults itinerary={itinerary} /></div>;
    if (tool === "map")       return <div style={{ height: "100%" }}><MapPanel itinerary={itinerary} /></div>;
    if (tool === "calendar")  return <CalendarPanel itinerary={itinerary} />;
    if (tool === "weather")   return <WeatherPanel destination={itinerary.destination} durationDays={itinerary.durationDays ?? 3} />;
    if (tool === "ideas")     return <IdeasPanel slug={slug} />;
    if (tool === "bagaglio")  return <BaggagePanel packingList={itinerary.packingList ?? []} destination={itinerary.destination} />;
    if (tool === "media")     return <MediaPanel slug={slug} />;
    if (tool === "expenses")  return <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: "12px", textAlign: "center", padding: "32px" }}><div style={{ fontSize: "2.8rem" }}>💰</div><div style={{ fontSize: "15px", fontWeight: 700, color: "#fff" }}>Gestione spese</div><div style={{ fontSize: "12px", fontWeight: 600, padding: "6px 16px", borderRadius: "9999px", background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.12)" }}>Disponibile prossimamente</div></div>;
    return null;
  };

  if (loading) return <Layout><div className="flex-1 flex items-center justify-center" style={{ background: "#0a0a12" }}><Loader2 style={{ width: "36px", height: "36px", color: "#a78bfa", animation: "spin 0.8s linear infinite" }} /><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div></Layout>;

  if (error || !itinerary) return (
    <Layout>
      <div className="flex-1 flex flex-col items-center justify-center gap-6 text-center p-8" style={{ background: "#0a0a12" }}>
        <div style={{ fontSize: "4rem" }}>🗺️</div>
        <h2 style={{ fontSize: "22px", fontWeight: 900, color: "#fff" }}>Viaggio non trovato</h2>
        <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.45)", maxWidth: "380px" }}>Il link potrebbe essere scaduto o il viaggio è stato eliminato.</p>
        <Link href="/"><button style={{ padding: "11px 28px", borderRadius: "9999px", background: "linear-gradient(135deg,#f97316,#a855f7)", border: "none", color: "#fff", fontSize: "14px", fontWeight: 700, cursor: "pointer" }}>← Torna alla home</button></Link>
      </div>
    </Layout>
  );

  // Header condiviso
  const pageHeader = (isMobile: boolean) => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: isMobile ? "12px 14px" : "10px 20px", borderBottom: "1px solid rgba(255,255,255,0.07)", flexShrink: 0, ...glassDark, minHeight: isMobile ? "58px" : "54px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <WaydoraLogo />
        <div style={{ width: "1px", height: "20px", background: "rgba(255,255,255,0.1)" }} />
        <Link href="/?chat=1">
          <button style={{ display: "flex", alignItems: "center", gap: "6px", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "9px", padding: "6px 10px", color: "rgba(255,255,255,0.7)", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>
            <MessageSquare style={{ width: "13px", height: "13px" }} />{isMobile ? "Pianif." : "Pianificatore"}
          </button>
        </Link>
      </div>
      {!isMobile && <div style={{ display: "flex", alignItems: "center", gap: "8px" }}><span style={{ fontSize: "1.1rem" }}>{itinerary.heroEmoji ?? "🗺️"}</span><span style={{ fontSize: "14px", fontWeight: 700, color: "#fff" }}>{itinerary.title}</span></div>}
      <button onClick={handleCopy} style={{ display: "flex", alignItems: "center", gap: "6px", padding: "6px 14px", borderRadius: "9999px", background: copied ? "rgba(52,211,153,0.15)" : "rgba(255,255,255,0.09)", border: copied ? "1px solid rgba(52,211,153,0.3)" : "1px solid rgba(255,255,255,0.18)", color: copied ? "#34d399" : "#fff", fontSize: "12px", fontWeight: 600, cursor: "pointer", transition: "all 0.2s" }}>
        {copied ? <Check style={{ width: "13px", height: "13px" }} /> : <Copy style={{ width: "13px", height: "13px" }} />}
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

      {/* ── DESKTOP ── */}
      <div className="flex-1 min-h-0 hidden lg:flex flex-col">
        {pageHeader(false)}
        <div style={{ flex: 1, minHeight: 0, display: "flex" }}>
          <ToolbarDesktop active={activeTool} onChange={setActiveTool} />
          <div style={{ flex: 1, minHeight: 0, overflow: activeTool === "map" ? "hidden" : "auto" }}>
            {renderTool(activeTool)}
          </div>
          <div style={{ width: "420px", flexShrink: 0, borderLeft: "1px solid rgba(255,255,255,0.07)", display: "flex", flexDirection: "column", minHeight: 0 }}>
            <TripChat slug={slug} itinerary={itinerary} onItineraryUpdate={setItinerary} />
          </div>
        </div>
      </div>

      {/* ── MOBILE ── */}
      <div className="flex-1 min-h-0 lg:hidden flex flex-col">
        {pageHeader(true)}

        {/* Contenuto — paddingBottom per toolbar fissa */}
        <div style={{ flex: 1, minHeight: 0, overflow: activeTool === "map" ? "hidden" : "auto", paddingBottom: activeTool === "map" ? "0" : "72px" }}>
          {renderTool(activeTool)}
        </div>

        {/* Toolbar bassa fissa
            onTouchStart/Move/End: blocca il propagation verso il parent
            così lo swipe sulla toolbar non triggera la gesture di swipe-back del browser/home.tsx */}
        <div
          ref={toolbarRef}
          onTouchStart={e => {
            touchStartX.current = e.touches[0].clientX;
            touchStartY.current = e.touches[0].clientY;
            isHorizontalScroll.current = false;
          }}
          onTouchMove={e => {
            const dx = Math.abs(e.touches[0].clientX - touchStartX.current);
            const dy = Math.abs(e.touches[0].clientY - touchStartY.current);
            // Se il gesto è prevalentemente orizzontale, ferma la propagazione
            if (dx > dy && dx > 8) {
              isHorizontalScroll.current = true;
              e.stopPropagation();
            }
          }}
          onTouchEnd={e => {
            if (isHorizontalScroll.current) {
              e.stopPropagation();
            }
          }}
          style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 30, display: "flex", overflowX: "auto", scrollbarWidth: "none", padding: "8px 8px 14px", ...glassDark, borderTop: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 -4px 24px rgba(0,0,0,0.4)" }}>
          {TOOLS.map(t => {
            const Icon = t.icon; const isActive = activeTool === t.id;
            return (
              <button key={t.id} onClick={() => setActiveTool(t.id)}
                style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", padding: "6px 12px", borderRadius: "10px", border: "none", flexShrink: 0, cursor: "pointer", transition: "all 0.15s", background: isActive ? "rgba(255,255,255,0.12)" : "transparent", color: isActive ? "#fff" : "rgba(255,255,255,0.45)", minWidth: "52px" }}>
                <Icon style={{ width: "18px", height: "18px" }} />
                <span style={{ fontSize: "9px", fontWeight: 600 }}>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* FAB chat — gradiente arancio→viola sopra i controlli zoom */}
        <ChatFAB messageCount={msgCount} onClick={() => setChatOpen(true)} />

        {/* Drawer chat */}
        <ChatDrawer slug={slug} itinerary={itinerary} onItineraryUpdate={setItinerary} open={chatOpen} onClose={() => setChatOpen(false)} />
      </div>
    </Layout>
  );
}