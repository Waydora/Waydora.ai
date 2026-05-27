import { useEffect, useRef, useState, useCallback, Fragment, type ReactNode } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  useListSuggestions, useChat, useSaveItinerary,
  type ChatMessage, type ItineraryData,
} from "@/hooks/api";
import { useAuth } from "@/hooks/auth";
import { AuthModal } from "@/components/auth-modal";
import { ConnectTelegramButton } from "@/components/connect-telegram-button";
import { fetchWeather, type WeatherData } from "@/lib/weather";
import { InspirePage } from "@/components/inspire-page";
import { CreateTripPage } from "@/components/create-trip-page";
import { SavedTripsPage } from "@/components/saved-trips-page";
import { useChatSessions, useUserTrips, useSavedTrips, useLocalSessions } from "@/hooks/trips";
import { shouldUseRailway } from "@/lib/affiliates";
import {
  Send, Loader2, Save, PlusCircle, Map, ChevronLeft, ChevronRight,
  Compass, BookMarked, Calendar, DollarSign, Cloud, Camera,
  Lightbulb, CheckSquare, LogOut, LogIn, User,
  Mic, MicOff, ImagePlus, X, Link, ExternalLink,
  Navigation, Download, Plus, MessageSquare, Edit3, ArrowLeft,
  Sparkles, Bell,
} from "lucide-react";
import { Layout, Logo } from "@/components/layout";
import { ItineraryResults, PackingList } from "@/components/itinerary-results";
import { TripMap } from "@/components/trip-map";
import {
  TripCounter, Partners, Reviews, Faq, SiteFooter, HeroLanding, StickyLandingHeader,
  SuggestedTrips, AnimatedRoadmap, WorldGallery, AppShowcase,
} from "@/components/landing-sections";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";

type ChatTurn = { id: number; userMessage: string; assistantReply: string; itinerary?: ItineraryData; mediaPreview?: string; };
type MediaContent = { mediaType: string; data: string; preview: string; name: string; };
type ActiveView = "chat" | "inspire" | "create" | "saved";
type MobileScreen = "chat" | "map" | "inspire" | "create" | "saved";

// Chat: contenitori che usano CSS vars così cambiano col tema globale.
// I dettagli delle bolle/itinerary card restano scuri per ora (Phase B).
const glassDark = { background: "var(--wd-glass)", backdropFilter: "blur(24px) saturate(160%)", WebkitBackdropFilter: "blur(24px) saturate(160%)", border: "1px solid var(--wd-border-10)" } as React.CSSProperties;
const itineraryCard = { background: "var(--wd-bg2)", border: "1px solid var(--wd-border-10)", borderRadius: "16px", padding: "16px", marginTop: "8px" } as React.CSSProperties;
const activeTabStyle   = { background: "var(--wd-surface-12)", color: "var(--wd-text)",       border: "1px solid var(--wd-border-13)" } as React.CSSProperties;
const inactiveTabStyle = { background: "transparent",          color: "var(--wd-text-45)",    border: "1px solid transparent"        } as React.CSSProperties;

const QUICK_SUGGESTIONS = [
  { label: "➕ Aggiungi giorno",  prompt: "Aggiungi un altro giorno all'itinerario" },
  { label: "🍽️ Ristoranti",      prompt: "Suggeriscimi altri ristoranti locali da non perdere" },
  { label: "🏨 Hotel",           prompt: "Cerco dove dormire in questa destinazione, puoi aiutarmi?" },
  { label: "✈️ Voli",            prompt: "Vorrei trovare i voli per questa destinazione" },
  { label: "🚗 Trasporti",       prompt: "Come mi sposto tra le varie tappe? Mezzi pubblici o noleggio auto?" },
  { label: "📸 Spot Instagram",  prompt: "Dammi i migliori spot per foto Instagram in questa destinazione" },
  { label: "💰 Più economico",   prompt: "Rendi l'itinerario più economico mantenendo le esperienze migliori" },
];

const MAP_TOOLS = [
  { id: "map",      label: "Mappa",      icon: Map },
  { id: "calendar", label: "Calendario", icon: Calendar },
  { id: "weather",  label: "Meteo",      icon: Cloud },
  { id: "bagaglio", label: "Bagaglio",   icon: CheckSquare },
  { id: "expenses", label: "Spese",      icon: DollarSign },
  { id: "ideas",    label: "Idee",       icon: Lightbulb },
  { id: "media",    label: "Media",      icon: Camera },
];

function generateTitle(turns: ChatTurn[], itinerary?: ItineraryData): string {
  if (itinerary?.destination) return `${itinerary.destination.split(",")[0]} · ${itinerary.durationDays ?? "?"} giorni`;
  const first = turns[0]?.userMessage ?? "";
  return first.length > 32 ? first.substring(0, 32) + "..." : first || "Nuova chat";
}

function MapToolbar({ active, onChange }: { active: string; onChange: (id: string) => void }) {
  return (
    <div className="flex items-center gap-1 px-3 py-2 overflow-x-auto [&::-webkit-scrollbar]:hidden shrink-0"
      style={{ borderBottom: "1px solid rgba(255,255,255,0.07)", ...glassDark }}>
      {MAP_TOOLS.map((t) => {
        const Icon = t.icon; const isActive = active === t.id;
        return <button key={t.id} onClick={() => onChange(t.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all" style={isActive ? activeTabStyle : inactiveTabStyle}><Icon className="w-3.5 h-3.5" />{t.label}</button>;
      })}
    </div>
  );
}

function MapTool({ itinerary }: { itinerary?: ItineraryData }) {
  const open = () => {
    if (!itinerary) return;
    const points = (itinerary.days?.flatMap((d: any) => d.activities) ?? []).filter((a: any) => a.coordinates?.lat && a.coordinates?.lng).map((a: any) => `${a.coordinates.lat},${a.coordinates.lng}`).slice(0, 10);
    if (!points.length) { window.open(`https://www.google.com/maps/search/${encodeURIComponent(itinerary.destination)}`, "_blank"); return; }
    if (points.length === 1) { window.open(`https://www.google.com/maps/search/${points[0]}`, "_blank"); return; }
    window.open(`https://www.google.com/maps/dir/${points.map(p => encodeURIComponent(p)).join("/")}`, "_blank");
  };
  if (!itinerary) return <div className="h-full flex flex-col items-center justify-center gap-3" style={{ color: "rgba(255,255,255,0.3)" }}><Map style={{ width: "36px", height: "36px", opacity: 0.3 }} /><span className="text-sm">La mappa apparirà qui</span></div>;
  return (
    <div className="h-full relative">
      <div className="absolute inset-0"><TripMap itinerary={itinerary} /></div>
      {/* Pulsante overlay in primo piano — la mappa diventa più grande perché non c'è più la barra */}
      <button onClick={open} aria-label="Apri in Google Maps"
        style={{
          position: "absolute", top: "12px", right: "12px", zIndex: 10,
          display: "inline-flex", alignItems: "center", gap: "6px",
          fontSize: "12.5px", fontWeight: 700, padding: "9px 14px",
          borderRadius: "9999px",
          background: "rgba(255,255,255,0.95)",
          color: "#1a1f3a",
          border: "1px solid rgba(255,255,255,0.6)",
          boxShadow: "0 6px 22px rgba(0,0,0,0.30), 0 2px 6px rgba(0,0,0,0.18)",
          cursor: "pointer",
          backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
        }}>
        <Navigation style={{ width: "13px", height: "13px", color: "#4285f4" }} />Google Maps
        <ExternalLink style={{ width: "11px", height: "11px", color: "#4285f4" }} />
      </button>
    </div>
  );
}

function CalendarTool({ itinerary }: { itinerary?: ItineraryData }) {
  const exp = () => {
    if (!itinerary) return;
    const today = new Date();
    itinerary.days?.forEach((day: any, i: number) => {
      const d = new Date(today); d.setDate(today.getDate() + i);
      const ds = d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
      const nd = new Date(d); nd.setDate(d.getDate() + 1);
      const nds = nd.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
      const acts = day.activities?.map((a: any) => `• ${a.time} - ${a.title}`).join("\n") ?? "";
      const url = new URL("https://calendar.google.com/calendar/render");
      url.searchParams.set("action", "TEMPLATE"); url.searchParams.set("text", `${itinerary.destination} - Giorno ${day.day}: ${day.title}`);
      url.searchParams.set("dates", `${ds}/${nds}`); url.searchParams.set("details", `${day.summary}\n\n${acts}\n\nCreato con Waydora 🗺️`);
      url.searchParams.set("location", itinerary.destination);
      setTimeout(() => window.open(url.toString(), "_blank"), i * 500);
    });
  };
  if (!itinerary) return <PlaceholderTool emoji="📅" title="Calendario viaggio" desc="Genera un itinerario per sincronizzarlo" />;
  return (
    <div className="p-4 h-full overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <div style={{ fontSize: "15px", fontWeight: 700, color: "#fff" }}>📅 Calendario</div>
        <button onClick={exp} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 600, padding: "6px 12px", borderRadius: "9999px", background: "rgba(66,133,244,0.15)", color: "#4285f4", border: "1px solid rgba(66,133,244,0.3)", cursor: "pointer" }}>
          <Download style={{ width: "12px", height: "12px" }} />Importa in Google Calendar
        </button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {itinerary.days?.map((day: any, i: number) => (
          <div key={day.day} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", padding: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
              <div style={{ width: "22px", height: "22px", borderRadius: "50%", background: "var(--wd-grad-warm)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 900, color: "#fff" }}>{i + 1}</div>
              <div style={{ fontSize: "13px", fontWeight: 700, color: "#fff" }}>{day.title}</div>
            </div>
            {day.activities?.map((a: any, ai: number) => (
              <div key={ai} style={{ display: "flex", gap: "8px", fontSize: "12px" }}>
                <span style={{ color: "rgba(255,255,255,0.4)", minWidth: "80px" }}>{a.time}</span>
                <span style={{ color: "rgba(255,255,255,0.7)" }}>{a.title}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function WeatherTool({ itinerary }: { itinerary?: ItineraryData }) {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!itinerary?.destination) return;
    setLoading(true); setError(null);
    fetchWeather(itinerary.destination, Math.min(itinerary.durationDays + 1, 14))
      .then(d => { setWeather(d); if (!d) setError("Impossibile caricare il meteo"); })
      .catch(() => setError("Errore meteo")).finally(() => setLoading(false));
  }, [itinerary?.destination, itinerary?.durationDays]);
  if (!itinerary) return <PlaceholderTool emoji="🌤" title="Meteo in tempo reale" desc="Genera un itinerario per vedere le previsioni" />;
  if (loading) return <div className="flex items-center justify-center h-full gap-3"><Loader2 style={{ width: "22px", height: "22px", color: "rgba(255,255,255,0.4)", animation: "wd-spin 0.8s linear infinite" }} /><span style={{ fontSize: "13px", color: "rgba(255,255,255,0.4)" }}>Caricamento...</span><style>{`@keyframes wd-spin{to{transform:rotate(360deg)}}`}</style></div>;
  if (!weather) return <div className="flex flex-col items-center justify-center h-full gap-3"><div style={{ fontSize: "2.5rem" }}>⛅</div><p style={{ fontSize: "13px", color: "rgba(255,255,255,0.4)" }}>{error ?? "Dati non disponibili"}</p></div>;
  return (
    <div className="p-4 h-full overflow-y-auto">
      <div style={{ marginBottom: "16px" }}><div style={{ fontSize: "15px", fontWeight: 700, color: "#fff" }}>🌤 Meteo a {weather.location}</div><div style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)" }}>{weather.country}</div></div>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {weather.days.map((day, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: "12px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", padding: "10px 14px" }}>
            <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.45)", minWidth: "70px" }}>{new Date(day.date).toLocaleDateString("it-IT", { weekday: "short", day: "numeric", month: "short" })}</div>
            <img src={day.icon} alt={day.condition} style={{ width: "30px", height: "30px" }} />
            <div style={{ flex: 1 }}><div style={{ fontSize: "13px", fontWeight: 600, color: "#fff" }}>{day.condition}</div><div style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)" }}>💨 {day.maxWindKph} km/h · 🌧 {day.chanceOfRain}%</div></div>
            <div style={{ fontSize: "16px", fontWeight: 800, color: "#fff" }}>{day.avgTempC}°C</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function IdeasTool({ ideas, onAdd, onRemove }: { ideas: string[]; onAdd: (i: string) => void; onRemove: (idx: number) => void }) {
  const [v, setV] = useState("");
  const add = () => { if (!v.trim()) return; onAdd(v.trim()); setV(""); };
  return (
    <div className="p-4 h-full flex flex-col">
      <div style={{ fontSize: "15px", fontWeight: 700, color: "#fff", marginBottom: "14px" }}>💡 Le tue idee</div>
      <div style={{ display: "flex", gap: "8px", marginBottom: "14px" }}>
        <input value={v} onChange={e => setV(e.target.value)} onKeyDown={e => { if (e.key === "Enter") add(); }} placeholder="Aggiungi un'idea..." style={{ flex: 1, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "10px", padding: "8px 12px", color: "#fff", fontSize: "13px", outline: "none" }} />
        <button onClick={add} style={{ width: "36px", height: "36px", borderRadius: "10px", background: "var(--wd-grad-warm)", border: "none", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}><Plus style={{ width: "16px", height: "16px" }} /></button>
      </div>
      <div style={{ flex: 1, overflowY: "auto" }}>
        {ideas.length === 0 ? <div style={{ textAlign: "center", padding: "40px 20px", color: "rgba(255,255,255,0.3)" }}><div style={{ fontSize: "2.5rem", marginBottom: "8px" }}>💡</div><p style={{ fontSize: "13px" }}>Nessuna idea ancora</p></div>
          : <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>{ideas.map((idea, i) => <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "10px", padding: "10px 12px" }}><span style={{ fontSize: "13px", color: "rgba(255,255,255,0.8)", flex: 1 }}>{idea}</span><button onClick={() => onRemove(i)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.3)", padding: 0 }}><X style={{ width: "14px", height: "14px" }} /></button></div>)}</div>}
      </div>
    </div>
  );
}

function MediaTool({ files, onUpload, onRemove }: { files: Array<{ name: string; preview: string }>; onUpload: (f: Array<{ name: string; preview: string }>) => void; onRemove: (idx: number) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="p-4 h-full flex flex-col">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
        <div style={{ fontSize: "15px", fontWeight: 700, color: "#fff" }}>📸 Foto e media</div>
        <input ref={ref} type="file" accept="image/*,video/*" multiple style={{ display: "none" }} onChange={e => { onUpload(Array.from(e.target.files ?? []).map(f => ({ name: f.name, preview: URL.createObjectURL(f) }))); e.target.value = ""; }} />
        <button onClick={() => ref.current?.click()} style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "12px", fontWeight: 600, padding: "6px 12px", borderRadius: "9999px", background: "rgba(255,255,255,0.09)", color: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.15)", cursor: "pointer" }}><Plus style={{ width: "13px", height: "13px" }} />Carica</button>
      </div>
      {files.length === 0 ? <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px", color: "rgba(255,255,255,0.3)", textAlign: "center" }}><Camera style={{ width: "36px", height: "36px", opacity: 0.3 }} /><p style={{ fontSize: "13px" }}>Nessun media caricato</p></div>
        : <div style={{ flex: 1, overflowY: "auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>{files.map((f, i) => <div key={i} style={{ position: "relative", borderRadius: "10px", overflow: "hidden", aspectRatio: "1" }}><img src={f.preview} alt={f.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /><button onClick={() => onRemove(i)} style={{ position: "absolute", top: "4px", right: "4px", width: "20px", height: "20px", borderRadius: "50%", background: "rgba(0,0,0,0.7)", border: "none", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0 }}><X style={{ width: "11px", height: "11px" }} /></button></div>)}</div>}
    </div>
  );
}

function PlaceholderTool({ emoji, title, desc }: { emoji: string; title: string; desc: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6">
      <div style={{ fontSize: "2.8rem" }}>{emoji}</div>
      <div style={{ fontSize: "15px", fontWeight: 700, color: "#fff" }}>{title}</div>
      <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.4)", maxWidth: "240px" }}>{desc}</div>
      <div className="text-xs font-semibold px-3 py-1 rounded-full" style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.15)" }}>Disponibile prossimamente</div>
    </div>
  );
}

function ToolContent({ tool, itinerary, ideas, onAddIdea, onRemoveIdea, mediaFiles, onUploadMedia, onRemoveMedia }: {
  tool: string; itinerary?: ItineraryData;
  ideas: string[]; onAddIdea: (i: string) => void; onRemoveIdea: (idx: number) => void;
  mediaFiles: Array<{ name: string; preview: string }>; onUploadMedia: (f: Array<{ name: string; preview: string }>) => void; onRemoveMedia: (idx: number) => void;
}) {
  if (tool === "map")      return <MapTool itinerary={itinerary} />;
  if (tool === "calendar") return <CalendarTool itinerary={itinerary} />;
  if (tool === "weather")  return <WeatherTool itinerary={itinerary} />;
  if (tool === "bagaglio") return <PackingList list={itinerary?.packingList ?? []} destination={itinerary?.destination} />;
  if (tool === "ideas")    return <IdeasTool ideas={ideas} onAdd={onAddIdea} onRemove={onRemoveIdea} />;
  if (tool === "media")    return <MediaTool files={mediaFiles} onUpload={onUploadMedia} onRemove={onRemoveMedia} />;
  if (tool === "expenses") return <PlaceholderTool emoji="💰" title="Gestione spese" desc="Tieni traccia del budget e dividi con il gruppo" />;
  return null;
}

function Sidebar({ open, onClose, onNewTrip, sessions, onLoadSession, onDeleteSession, activeView, onChangeView, onLoginClick, isMobile = false }: {
  open: boolean; onClose: () => void; onNewTrip: () => void;
  sessions: Array<{ id: string | number; title: string; turns: any[]; itinerary?: any; apiMessages?: any[] }>;
  onLoadSession: (s: any) => void;
  onDeleteSession: (id: string | number) => void;
  activeView: ActiveView; onChangeView: (v: ActiveView) => void;
  onLoginClick: () => void; isMobile?: boolean;
}) {
  const { user, logout } = useAuth();
  const sidebarWidth = isMobile ? "310px" : "260px";
  const fontSize = isMobile ? "15px" : "14px";
  const iconSize = isMobile ? "18px" : "16px";
  const itemPadding = isMobile ? "13px 16px" : "10px 12px";

  const content = (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", ...glassDark, borderRight: isMobile ? "none" : "1px solid rgba(255,255,255,0.07)" }}>
      <div style={{ padding: isMobile ? "20px 16px" : "16px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <Logo variant="header" />
        <button onClick={onClose} style={{ color: "rgba(255,255,255,0.35)", background: "none", border: "none", cursor: "pointer" }}>
          <X style={{ width: isMobile ? "22px" : "18px", height: isMobile ? "22px" : "18px" }} />
        </button>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: isMobile ? "14px" : "12px" }}>
        <button onClick={() => { onNewTrip(); if (isMobile) onClose(); }}
          style={{ width: "100%", display: "flex", alignItems: "center", gap: "12px", padding: itemPadding, borderRadius: "14px", border: "none", cursor: "pointer", fontSize, fontWeight: 600, transition: "all 0.15s", ...(activeView === "chat" ? activeTabStyle : inactiveTabStyle) }}>
          <PlusCircle style={{ width: iconSize, height: iconSize, flexShrink: 0 }} />Nuova chat
        </button>
      </div>
      {sessions.length > 0 && (
        <div style={{ padding: isMobile ? "0 14px 10px" : "0 12px 8px" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", color: "rgba(255,255,255,0.28)", padding: "4px 4px 8px" }}>Recenti</div>
          <ScrollArea style={{ maxHeight: isMobile ? "200px" : "180px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
              {sessions.map((s) => (
                <div key={s.id} className="group" style={{ display: "flex", alignItems: "stretch", borderRadius: "12px", overflow: "hidden", transition: "background 0.12s" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                  <button onClick={() => { onLoadSession(s); onChangeView("chat"); if (isMobile) onClose(); }}
                    style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: "10px", padding: isMobile ? "10px 12px" : "8px 12px", border: "none", background: "transparent", cursor: "pointer", textAlign: "left" }}>
                    <MessageSquare style={{ width: "14px", height: "14px", color: "rgba(255,255,255,0.3)", flexShrink: 0 }} />
                    <span style={{ fontSize: isMobile ? "13px" : "12px", fontWeight: 600, color: "rgba(255,255,255,0.75)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title}</span>
                  </button>
                  <button aria-label="Elimina chat"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Eliminare "${s.title}"?`)) onDeleteSession(s.id);
                    }}
                    style={{ flexShrink: 0, padding: "0 10px", background: "transparent", border: "none", color: "rgba(255,255,255,0.3)", cursor: "pointer", display: "flex", alignItems: "center", opacity: isMobile ? 1 : 0.4, transition: "opacity 0.12s, color 0.12s" }}
                    onMouseEnter={e => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.color = "#f87171"; }}
                    onMouseLeave={e => { e.currentTarget.style.opacity = isMobile ? "1" : "0.4"; e.currentTarget.style.color = "rgba(255,255,255,0.3)"; }}>
                    <X style={{ width: "13px", height: "13px" }} />
                  </button>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}
      <div style={{ height: "1px", background: "rgba(255,255,255,0.06)", margin: `4px ${isMobile ? "14px" : "12px"}` }} />
      <div style={{ padding: isMobile ? "10px 14px" : "8px 12px", display: "flex", flexDirection: "column", gap: "4px" }}>
        {([
          { id: "inspire", label: "Lasciati ispirare", icon: Compass },
          { id: "create",  label: "Crea un viaggio",   icon: Edit3 },
          { id: "saved",   label: "Viaggi salvati",    icon: BookMarked },
        ] as const).map(item => {
          const Icon = item.icon;
          return (
            <button key={item.id} onClick={() => { onChangeView(item.id); if (isMobile) onClose(); }}
              style={{ width: "100%", display: "flex", alignItems: "center", gap: "12px", padding: itemPadding, borderRadius: "14px", border: "none", cursor: "pointer", fontSize, fontWeight: 600, transition: "all 0.15s", ...(activeView === item.id ? activeTabStyle : inactiveTabStyle) }}>
              <Icon style={{ width: iconSize, height: iconSize, flexShrink: 0 }} />{item.label}
            </button>
          );
        })}
      </div>
      {user && (
        <div style={{ padding: isMobile ? "8px 16px 12px" : "8px 12px 10px", marginTop: "auto" }}>
          <ConnectTelegramButton variant="sidebar" expanded={true} />
        </div>
      )}
      </div>
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", padding: isMobile ? "16px" : "12px", flexShrink: 0 }}>
        {user ? (
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {user.avatar ? <img src={user.avatar} alt={user.name} style={{ width: isMobile ? "40px" : "34px", height: isMobile ? "40px" : "34px", borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
              : <div style={{ width: isMobile ? "40px" : "34px", height: isMobile ? "40px" : "34px", borderRadius: "50%", flexShrink: 0, background: "var(--wd-grad-warm)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: isMobile ? "15px" : "13px" }}>{user.name?.[0]?.toUpperCase() ?? "W"}</div>}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: isMobile ? "14px" : "13px", fontWeight: 600, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.name}</div>
              <div style={{ fontSize: isMobile ? "12px" : "11px", color: "rgba(255,255,255,0.35)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.email}</div>
            </div>
            <button onClick={logout} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", padding: isMobile ? "8px" : "6px", cursor: "pointer", color: "rgba(255,255,255,0.45)", flexShrink: 0, display: "flex" }}>
              <LogOut style={{ width: isMobile ? "16px" : "14px", height: isMobile ? "16px" : "14px" }} />
            </button>
          </div>
        ) : (
          <button onClick={onLoginClick} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", padding: isMobile ? "13px" : "10px", borderRadius: "14px", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.7)", fontSize, fontWeight: 600, cursor: "pointer" }}>
            <LogIn style={{ width: iconSize, height: iconSize }} />Accedi o Registrati
          </button>
        )}
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <AnimatePresence>
        {open && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}
              style={{ position: "fixed", inset: 0, zIndex: 40, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)" }} />
            <motion.div initial={{ x: -320 }} animate={{ x: 0 }} exit={{ x: -320 }} transition={{ type: "spring", damping: 30, stiffness: 300 }}
              style={{ position: "fixed", left: 0, top: 0, bottom: 0, width: sidebarWidth, zIndex: 50 }}>
              {content}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    );
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.aside initial={{ width: 0, opacity: 0 }} animate={{ width: 260, opacity: 1 }} exit={{ width: 0, opacity: 0 }} transition={{ duration: 0.22 }}
          style={{ flexShrink: 0, overflow: "hidden" }}>
          {content}
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

function MobilePageHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.07)", flexShrink: 0, ...glassDark }}>
      <button onClick={onBack} aria-label="Torna alla chat" className="wd-soft-btn"
        style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "8px 14px 8px 8px", borderRadius: "9999px", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
        <span style={{ width: "22px", height: "22px", borderRadius: "50%", background: "rgba(255,255,255,0.14)", border: "1px solid rgba(255,255,255,0.22)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
          <ArrowLeft style={{ width: "13px", height: "13px", color: "#fff" }} />
        </span>
        Chat
      </button>
      <span style={{ fontSize: "16px", fontWeight: 700, color: "#fff", letterSpacing: "-0.01em" }}>{title}</span>
    </div>
  );
}

function UserBubble({ text, mediaPreview }: { text: string; mediaPreview?: string }) {
  return (
    <div className="flex justify-end">
      <div style={{ maxWidth: "80%", display: "flex", flexDirection: "column", gap: "8px", alignItems: "flex-end" }}>
        {mediaPreview && <div style={{ borderRadius: "12px", overflow: "hidden", maxWidth: "200px" }}><img src={mediaPreview} alt="allegato" style={{ width: "100%", objectFit: "cover", display: "block" }} /></div>}
        {text && <div className="wd-bubble-user" style={{ padding: "10px 14px", borderRadius: "18px 18px 4px 18px", fontSize: "14px", lineHeight: 1.55 }}>{text}</div>}
      </div>
    </div>
  );
}
const URL_RX = /(https?:\/\/[^\s)]+[^\s).,;:!?])/g;
function renderWithLinks(text: string): ReactNode {
  const parts = text.split(URL_RX);
  return parts.map((p, i) => /^https?:\/\//.test(p)
    ? <a key={i} href={p} target="_blank" rel="noopener noreferrer sponsored" style={{ color: "#fb923c", textDecoration: "underline", wordBreak: "break-all" }}>{p}</a>
    : <Fragment key={i}>{p}</Fragment>);
}
function AssistantBubble({ text }: { text: string }) {
  return <div className="flex justify-start"><div style={{ maxWidth: "85%", padding: "10px 14px", borderRadius: "18px 18px 18px 4px", background: "rgba(32,22,52,0.98)", border: "1px solid rgba(255,255,255,0.11)", color: "rgba(255,255,255,0.88)", fontSize: "14px", lineHeight: 1.65, whiteSpace: "pre-wrap" }}>{renderWithLinks(text)}</div></div>;
}
const LOADING_PHRASES: Array<{ emoji: string; text: string }> = [
  { emoji: "🧭", text: "Sto cercando i posti migliori..." },
  { emoji: "🏄‍♂️", text: "Controllo le onde locali..." },
  { emoji: "🗺️", text: "Sto disegnando la mappa..." },
  { emoji: "🍝", text: "Chiedo consiglio agli chef del posto..." },
  { emoji: "🌅", text: "Guardo gli orari del tramonto..." },
  { emoji: "✈️", text: "Verifico voli e treni..." },
  { emoji: "🏛", text: "Leggo le guide dei locali..." },
  { emoji: "📍", text: "Piazzo i pin sull'itinerario..." },
  { emoji: "🎒", text: "Preparo il bagaglio mentale..." },
  { emoji: "✨", text: "Ultimi ritocchi..." },
];

function TypingIndicator() {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIdx(i => (i + 1) % LOADING_PHRASES.length), 2800);
    return () => clearInterval(t);
  }, []);
  const phrase = LOADING_PHRASES[idx];
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
      <div className="flex items-center gap-3 px-4 py-3 rounded-2xl" style={{ background: "rgba(32,22,52,0.98)", border: "1px solid rgba(255,255,255,0.1)", minWidth: "260px" }}>
        <motion.span
          key={phrase.emoji}
          initial={{ scale: 0.6, opacity: 0, y: 8 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 280, damping: 18 }}
          style={{ fontSize: "22px", lineHeight: 1, display: "inline-block" }}
        >
          {phrase.emoji}
        </motion.span>
        <div className="flex flex-col gap-1" style={{ flex: 1, minWidth: 0 }}>
          <AnimatePresence mode="wait">
            <motion.span
              key={phrase.text}
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.25 }}
              style={{ fontSize: "13px", color: "rgba(255,255,255,0.78)", fontWeight: 500 }}
            >
              {phrase.text}
            </motion.span>
          </AnimatePresence>
          <div className="flex items-center gap-1">
            {[0, 150, 300].map(d => (
              <div key={d} className="rounded-full" style={{ width: "5px", height: "5px", background: "rgba(255,255,255,0.45)", animation: `wd-bounce 1.2s ease-in-out ${d}ms infinite` }} />
            ))}
          </div>
        </div>
      </div>
      <style>{`@keyframes wd-bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}`}</style>
    </motion.div>
  );
}
const WELCOME_PROMPTS: Array<{ label: string; prompt: string }> = [
  { label: "🗺️ 3 giorni a Tokyo",   prompt: "Pianificami 3 giorni a Tokyo" },
  { label: "🏖️ Settimana al mare",  prompt: "Vorrei una settimana al mare, suggeriscimi una destinazione" },
  { label: "🏛️ Weekend a Roma",     prompt: "Pianificami un weekend a Roma" },
];

function WelcomeMessage({ userName, onPrompt }: { userName?: string; onPrompt?: (p: string) => void }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="flex flex-col items-center justify-center h-full gap-4 text-center px-6">
      <div style={{ fontSize: "3rem" }}>✈️</div>
      <div>
        <h3 style={{ fontSize: "18px", fontWeight: 800, color: "#fff", marginBottom: "8px" }}>{userName ? `Ciao, ${userName.split(" ")[0]}! 👋` : "Ciao! 👋"}</h3>
        <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.5)", lineHeight: 1.6, maxWidth: "280px" }}>Sono Waydora, la tua assistente di viaggio AI. Dimmi dove vuoi andare!</p>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", justifyContent: "center" }}>
        {WELCOME_PROMPTS.map(s => (
          <button key={s.label} onClick={() => onPrompt?.(s.prompt)}
            style={{ fontSize: "12px", fontWeight: 600, padding: "7px 14px", borderRadius: "9999px", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.7)", cursor: "pointer", transition: "all 0.15s" }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.14)"; e.currentTarget.style.color = "#fff"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.07)"; e.currentTarget.style.color = "rgba(255,255,255,0.7)"; }}>
            {s.label}
          </button>
        ))}
      </div>
    </motion.div>
  );
}

function AdvancedChatInput({ value, onChange, onSubmit, isPending, onMediaAttach, mediaContent, onMediaRemove, placeholder }: {
  value: string; onChange: (v: string) => void; onSubmit: () => void; isPending: boolean;
  onMediaAttach: (m: MediaContent) => void; mediaContent: MediaContent | null; onMediaRemove: () => void; placeholder?: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recognition, setRecognition] = useState<any>(null);
  const active = (value.trim() || mediaContent) && !isPending;
  const hc = (e: React.ChangeEvent<HTMLTextAreaElement>) => { onChange(e.target.value); const ta = e.target; ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight, 120) + "px"; };
  const hf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const isImg = file.type.startsWith("image/"); const isVid = file.type.startsWith("video/");
    if (!isImg && !isVid) return; if (file.size > 20 * 1024 * 1024) { alert("Max 20MB"); return; }
    const preview = URL.createObjectURL(file); const reader = new FileReader();
    reader.onload = ev => { const b64 = (ev.target?.result as string)?.split(",")[1]; if (b64) onMediaAttach({ mediaType: isImg ? file.type : "image/jpeg", data: b64, preview, name: file.name }); };
    if (isImg) { reader.readAsDataURL(file); } else {
      const v = document.createElement("video"); v.src = preview; v.currentTime = 1;
      v.onloadeddata = () => { const c = document.createElement("canvas"); c.width = v.videoWidth; c.height = v.videoHeight; c.getContext("2d")?.drawImage(v, 0, 0); c.toBlob(blob => { if (!blob) return; const fr = new FileReader(); fr.onload = ev => { const b64 = (ev.target?.result as string)?.split(",")[1]; if (b64) onMediaAttach({ mediaType: "image/jpeg", data: b64, preview, name: file.name }); }; fr.readAsDataURL(blob); }, "image/jpeg", 0.85); };
    }
    e.target.value = "";
  };
  const toggleRec = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { alert("Usa Chrome."); return; }
    if (isRecording && recognition) { recognition.stop(); setIsRecording(false); return; }
    const rec = new SR(); rec.lang = "it-IT"; rec.continuous = true; rec.interimResults = true;
    rec.onresult = (event: any) => { let t = ""; for (let i = 0; i < event.results.length; i++) t += event.results[i][0].transcript; onChange(t); };
    rec.onend = () => setIsRecording(false); rec.onerror = () => setIsRecording(false);
    rec.start(); setRecognition(rec); setIsRecording(true);
  };
  const hasTT = /tiktok\.com/i.test(value);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {mediaContent && <div style={{ position: "relative", display: "inline-block", alignSelf: "flex-start" }}><img src={mediaContent.preview} alt="allegato" style={{ height: "80px", borderRadius: "10px", objectFit: "cover", border: "1px solid rgba(255,255,255,0.15)" }} /><button onClick={onMediaRemove} style={{ position: "absolute", top: "-6px", right: "-6px", width: "20px", height: "20px", borderRadius: "50%", background: "rgba(0,0,0,0.8)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0 }}><X style={{ width: "11px", height: "11px" }} /></button></div>}
      {hasTT && <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "6px 10px", borderRadius: "8px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}><Link style={{ width: "12px", height: "12px", color: "#a78bfa" }} /><span style={{ fontSize: "11px", color: "rgba(255,255,255,0.6)" }}>Link TikTok rilevato 🎬</span></div>}
      <div style={{ display: "flex", alignItems: "flex-end", gap: "6px", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "20px", padding: "8px 8px 8px 14px" }}>
        <textarea value={value} onChange={hc} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (active) onSubmit(); } }} placeholder={isRecording ? "🎤 In ascolto..." : placeholder} rows={1}
          className="flex-1 bg-transparent resize-none outline-none border-none text-sm leading-relaxed"
          style={{ minHeight: "32px", maxHeight: "120px", paddingTop: "6px", paddingBottom: "6px", color: "rgba(255,255,255,0.9)", caretColor: "#fff" }} />
        <div style={{ display: "flex", alignItems: "center", gap: "4px", flexShrink: 0 }}>
          <input ref={fileRef} type="file" accept="image/*,video/*" style={{ display: "none" }} onChange={hf} />
          <button onClick={() => fileRef.current?.click()} style={{ width: "32px", height: "32px", borderRadius: "50%", border: "none", background: mediaContent ? "rgba(167,139,250,0.2)" : "rgba(255,255,255,0.07)", color: mediaContent ? "#a78bfa" : "rgba(255,255,255,0.4)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><ImagePlus style={{ width: "15px", height: "15px" }} /></button>
          <button onClick={toggleRec} style={{ width: "32px", height: "32px", borderRadius: "50%", border: "none", background: isRecording ? "rgba(239,68,68,0.25)" : "rgba(255,255,255,0.07)", color: isRecording ? "#f87171" : "rgba(255,255,255,0.4)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>{isRecording ? <MicOff style={{ width: "14px", height: "14px" }} /> : <Mic style={{ width: "14px", height: "14px" }} />}</button>
          <button onClick={onSubmit} disabled={!active} style={{ width: "34px", height: "34px", borderRadius: "50%", border: "none", background: active ? "var(--wd-grad-warm)" : "rgba(255,255,255,0.06)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: active ? "pointer" : "not-allowed", transform: active ? "scale(1)" : "scale(0.9)", transition: "all 0.15s" }}>
            {isPending ? <Loader2 style={{ width: "14px", height: "14px", animation: "wd-spin2 0.8s linear infinite" }} /> : <Send style={{ width: "13px", height: "13px" }} />}
          </button>
        </div>
      </div>
      <style>{`@keyframes wd-spin2{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

function QuickSuggestions({ onSelect, visible }: { onSelect: (p: string) => void; visible: boolean }) {
  if (!visible) return null;
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      style={{ display: "flex", gap: "8px", overflowX: "auto", padding: "8px 0 0", scrollbarWidth: "none" }}
      className="[&::-webkit-scrollbar]:hidden">
      {QUICK_SUGGESTIONS.map(s => (
        <button key={s.label} onClick={() => onSelect(s.prompt)}
          style={{ fontSize: "12px", fontWeight: 600, padding: "6px 14px", borderRadius: "9999px", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.7)", cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0, transition: "all 0.15s" }}
          onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.13)"; e.currentTarget.style.color = "#fff"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.07)"; e.currentTarget.style.color = "rgba(255,255,255,0.7)"; }}>
          {s.label}
        </button>
      ))}
    </motion.div>
  );
}

function ChatTurnView({ turn }: { turn: ChatTurn }) {
  return (
    <div className="space-y-3">
      <UserBubble text={turn.userMessage} mediaPreview={turn.mediaPreview} />
      {turn.assistantReply === "" ? <TypingIndicator /> : (
        <><AssistantBubble text={turn.assistantReply} />
        {turn.itinerary && <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} style={itineraryCard}><ItineraryResults itinerary={turn.itinerary} /></motion.div>}</>
      )}
    </div>
  );
}

function LandingNavActions({ onLoginClick, onEnterChat }: { onLoginClick: () => void; onEnterChat: () => void }) {
  const { user, logout } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  // Hero scuro → bottoni chiari. Scrolled (header glass) → bottoni adattivi al tema.
  const bg = scrolled ? "var(--wd-surface-8)" : "rgba(255,255,255,0.18)";
  const border = scrolled ? "1px solid var(--wd-border-10)" : "1px solid rgba(255,255,255,0.28)";
  const fg = scrolled ? "var(--wd-text)" : "#fff";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      {user ? (
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button onClick={onEnterChat} style={{ display: "flex", alignItems: "center", gap: "8px", background: bg, border, backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", borderRadius: "9999px", padding: "7px 14px 7px 8px", color: fg, fontSize: "13px", fontWeight: 600, cursor: "pointer", transition: "background 0.25s, color 0.25s, border-color 0.25s" }}>
            {user.avatar
              ? <img src={user.avatar} alt={user.name} style={{ width: "24px", height: "24px", borderRadius: "50%", objectFit: "cover" }} />
              : <div className="wd-travel-btn" style={{ width: "24px", height: "24px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: "11px", boxShadow: "none" }}>{user.name?.[0]?.toUpperCase() ?? "W"}</div>}
            {user.name?.split(" ")[0]}
          </button>
          <button onClick={logout} style={{ background: bg, border, borderRadius: "9999px", padding: "7px 14px", color: scrolled ? "var(--wd-text-55)" : "rgba(255,255,255,0.7)", fontSize: "12px", fontWeight: 600, cursor: "pointer", transition: "background 0.25s, color 0.25s, border-color 0.25s" }}>Esci</button>
        </div>
      ) : (
        <button onClick={onLoginClick} className="wd-soft-btn" style={{ display: "flex", alignItems: "center", gap: "6px", borderRadius: "9999px", padding: "8px 18px", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
          <User style={{ width: "14px", height: "14px" }} />Accedi
        </button>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────
export default function Home() {
  const [turns,            setTurns]            = useState<ChatTurn[]>([]);
  const [input,            setInput]            = useState("");
  const [mediaContent,     setMediaContent]     = useState<MediaContent | null>(null);
  const [currentItinerary, setCurrentItinerary] = useState<ItineraryData | undefined>();
  const [apiMessages,      setApiMessages]      = useState<ChatMessage[]>([]);
  const [sidebarOpen,      setSidebarOpen]      = useState(true);
  const [mobileSidebarOpen,setMobileSidebarOpen]= useState(false);
  const [activeTool,       setActiveTool]       = useState("map");
  const [authOpen,         setAuthOpen]         = useState(false);
  const [showLanding,      setShowLanding]      = useState(() => {
    if (typeof window !== "undefined") return sessionStorage.getItem("waydora_in_app") !== "1";
    return true;
  });
  const [activeView,       setActiveView]       = useState<ActiveView>("chat");
  const [mobileScreen,     setMobileScreen]     = useState<MobileScreen>("chat");
  const [ideas,            setIdeas]            = useState<string[]>([]);
  const [mediaFiles,       setMediaFiles]       = useState<Array<{ name: string; preview: string }>>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | undefined>();
  const [mapReady,         setMapReady]         = useState(false);
  const [mapNotifShown,    setMapNotifShown]    = useState(false);

  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const chatScrollRef = useRef<HTMLDivElement>(null);
  // refs per swipe — solo dal bordo sinistro
  const swipeStartX = useRef<number>(-1);
  const swipeStartY = useRef<number>(0);
  const localSessions = useLocalSessions();

  const { sessions: dbSessions, upsert: upsertSession, remove: removeDbSession } = useChatSessions(user?.id);
  const { trips: userTrips, upsert: upsertTrip, publish: publishTrip, remove: removeTrip } = useUserTrips(user?.id);
  const { saved: savedTrips, saveItinerary, toggleFeaturedTrip, remove: removeSaved, isFeaturedLiked } = useSavedTrips(user?.id);

  const [localSessionsList, setLocalSessionsList] = useState<any[]>(() => localSessions.load());
  const sidebarSessions = user ? dbSessions : localSessionsList;
  const chatMutation = useChat();

  useEffect(() => { document.title = "Waydora — Travel simple, everywhere!"; }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("chat") === "1") {
      setShowLanding(false); setActiveView("chat"); setMobileScreen("chat");
      sessionStorage.setItem("waydora_in_app", "1");
      window.history.replaceState({}, "", "/");
    }
  }, []);

  useEffect(() => {
    setTimeout(() => { chatScrollRef.current?.scrollTo({ top: chatScrollRef.current.scrollHeight, behavior: "smooth" }); }, 80);
  }, [turns]);

  useEffect(() => {
    if (currentItinerary && !mapReady && !mapNotifShown) {
      setMapReady(true); setMapNotifShown(true);
      toast({ title: "Mappa pronta!", description: "Tocca 'Mappa' per vedere il percorso." });
    }
  }, [currentItinerary]);

  // ── Swipe gesture: edge-zone con touchmove preventDefault per bloccare back del browser ──
  // L'effetto registra i listener sulla zona invisibile (left-edge) sotto, non sul window:
  // questo evita di consumare touch globali e blocca il gesto back di iOS preventDefault().
  // Lo stato `mobileScreen` viene letto via ref per non re-registrare i listener ad ogni cambio.
  const mobileScreenRef = useRef<MobileScreen>(mobileScreen);
  useEffect(() => { mobileScreenRef.current = mobileScreen; }, [mobileScreen]);
  const sidebarOpenRef = useRef(mobileSidebarOpen);
  useEffect(() => { sidebarOpenRef.current = mobileSidebarOpen; }, [mobileSidebarOpen]);

  const persistSession = useCallback(async (t: ChatTurn[], itinerary?: ItineraryData, msgs?: ChatMessage[], id?: string) => {
    const title = generateTitle(t, itinerary);
    if (user) {
      const result = await upsertSession({ id, title, turns: t, api_messages: msgs ?? [], itinerary: itinerary ?? null });
      return result?.id;
    } else {
      const localId = id ?? Date.now().toString();
      const session = { id: localId, title, turns: t, itinerary, apiMessages: msgs ?? [], createdAt: new Date().toISOString() };
      localSessions.add(session); setLocalSessionsList(localSessions.load());
      return localId;
    }
  }, [user, upsertSession, localSessions]);

  const enterApp = useCallback(() => {
    setShowLanding(false);
    sessionStorage.setItem("waydora_in_app", "1");
  }, []);

  const handleSubmit = useCallback((overridePrompt?: string) => {
    const promptText = (overridePrompt ?? input).trim();
    if ((!promptText && !mediaContent) || chatMutation.isPending) return;
    if (!overridePrompt) setInput("");
    enterApp(); setActiveView("chat"); setMobileScreen("chat");
    setMapReady(false); setMapNotifShown(false);

    const turnId = Date.now(); const mediaPreview = mediaContent?.preview;
    setTurns(prev => [...prev, { id: turnId, userMessage: promptText || "📎 Media allegato", assistantReply: "", mediaPreview }]);
    // Limita il contesto alle ultime 8 entrate (4 turni) per ridurre token su sessioni lunghe
    const recentMsgs = apiMessages.slice(-8);
    const newMsgs: ChatMessage[] = [...recentMsgs, { role: "user", content: promptText || "Analizza questo contenuto" }];
    setApiMessages(newMsgs);
    const mediaForBackend = mediaContent ? { mediaType: mediaContent.mediaType, data: mediaContent.data } : undefined;
    setMediaContent(null);

    chatMutation.mutate(
      {
        data: { messages: newMsgs, existingItinerary: currentItinerary, mediaContent: mediaForBackend, userTier: user ? "free" : "guest" } as any,
        useRailway: shouldUseRailway(promptText, !!currentItinerary),
      },
      {
        onSuccess: async (data) => {
          setApiMessages(prev => [...prev, { role: "assistant", content: data.reply }]);
          if (data.itinerary) setCurrentItinerary(data.itinerary);
          const updatedTurns = [...turns.filter(t => t.id !== turnId), { id: turnId, userMessage: promptText || "📎 Media allegato", assistantReply: data.reply, itinerary: data.itinerary ?? undefined, mediaPreview }];
          setTurns(updatedTurns);
          if (data.itinerary) {
            const sid = await persistSession(updatedTurns, data.itinerary, [...newMsgs, { role: "assistant" as const, content: data.reply }], currentSessionId);
            if (sid) setCurrentSessionId(sid);
          }
        },
        onError: (err: any) => {
          setTurns(prev => prev.filter(t => t.id !== turnId));
          setApiMessages(prev => prev.slice(0, -1));
          const msg = err?.message?.includes("429") || err?.status === 429 ? "Hai raggiunto il limite orario. Riprova tra qualche minuto." : "Qualcosa è andato storto. Riprova.";
          toast({ title: msg, variant: "destructive" });
        },
      }
    );
  }, [input, mediaContent, apiMessages, currentItinerary, turns, currentSessionId, chatMutation, toast, persistSession, enterApp]);

  const handleSave = async () => {
    if (!currentItinerary) return;
    if (!user) { setAuthOpen(true); return; }
    const result = await saveItinerary(currentItinerary);
    if (result) toast({ title: "Itinerario salvato! 🎉", description: "Vai in 'Viaggi salvati' per condividerlo." });
    else toast({ title: "Errore salvataggio", variant: "destructive" });
  };

  const handleNewTrip = useCallback(async () => {
    if (turns.length > 0) await persistSession(turns, currentItinerary, apiMessages, currentSessionId);
    setTurns([]); setApiMessages([]); setCurrentItinerary(undefined);
    setInput(""); setMediaContent(null); setCurrentSessionId(undefined);
    setActiveView("chat"); setMobileScreen("chat");
    setMapReady(false); setMapNotifShown(false);
  }, [turns, currentItinerary, apiMessages, currentSessionId, persistSession]);

  const handleDeleteSession = useCallback(async (id: string | number) => {
    if (user) {
      await removeDbSession(String(id));
    } else {
      localSessions.remove(id);
      setLocalSessionsList(localSessions.load());
    }
    if (currentSessionId && String(currentSessionId) === String(id)) {
      setTurns([]); setApiMessages([]); setCurrentItinerary(undefined); setCurrentSessionId(undefined);
    }
  }, [user, removeDbSession, localSessions, currentSessionId]);

  const handleLoadSession = (s: any) => {
    setTurns(s.turns ?? []); setApiMessages(s.apiMessages ?? s.api_messages ?? []);
    setCurrentItinerary(s.itinerary); setCurrentSessionId(s.id?.toString());
    enterApp(); setActiveView("chat"); setMobileScreen("chat");
  };

  const handleChangeView = (view: ActiveView) => {
    setActiveView(view); enterApp();
    if (view === "inspire") setMobileScreen("inspire");
    else if (view === "create") setMobileScreen("create");
    else if (view === "saved") setMobileScreen("saved");
    else setMobileScreen("chat");
  };

  const handleLike = async (tripId: string, title: string) => {
    if (!user) { setAuthOpen(true); return; }
    await toggleFeaturedTrip(tripId, title);
  };

  const hasItinerary = turns.some(t => t.itinerary);
  const publishedUserTrips = userTrips.filter(t => t.status === "published");

  if (showLanding) {
    return (
      <Layout>
        <div className="flex-1 overflow-y-auto" style={{ background: "var(--wd-bg)", position: "relative" }}>
          <StickyLandingHeader right={<LandingNavActions onLoginClick={() => setAuthOpen(true)} onEnterChat={() => { enterApp(); setActiveView("chat"); }} />} />
          <HeroLanding onSubmit={handleSubmit} isPending={chatMutation.isPending} />
          <SuggestedTrips onSelect={p => handleSubmit(p)} />
          <AnimatedRoadmap />
          <WorldGallery />
          <AppShowcase />
          <TripCounter /><Partners /><Reviews /><Faq /><SiteFooter />
        </div>
        <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
      </Layout>
    );
  }

  const mobileHeader = (
    <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.07)", flexShrink: 0, ...glassDark, minHeight: "60px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <button onClick={() => setMobileSidebarOpen(true)} aria-label="Apri menu"
          style={{ position: "relative", width: "40px", height: "40px", borderRadius: "13px", padding: 0, cursor: "pointer",
            background: "var(--wd-surface-8)",
            border: "1px solid var(--wd-border-13)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 2px 10px rgba(0,0,0,0.25)",
            overflow: "hidden",
          }}>
          <span aria-hidden style={{ position: "absolute", inset: 0, background: "var(--wd-grad-warm)", opacity: 0.18 }} />
          <svg width="18" height="14" viewBox="0 0 18 14" fill="none" style={{ position: "relative", zIndex: 1 }}>
            <rect y="0"   width="18" height="2.2" rx="1.1" fill="#fff" />
            <rect y="5.9" width="12" height="2.2" rx="1.1" fill="#fff" />
            <rect y="11.8" width="15" height="2.2" rx="1.1" fill="#fff" />
          </svg>
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--wd-grad-warm)" }} />
          <span style={{ fontSize: "15px", fontWeight: 700, color: "#fff" }}>Waydora</span>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        {currentItinerary && (
          <button onClick={handleSave} style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "13px", fontWeight: 600, padding: "7px 13px", borderRadius: "9999px", background: "rgba(255,255,255,0.09)", color: "#fff", border: "1px solid rgba(255,255,255,0.18)", cursor: "pointer" }}>
            <Save style={{ width: "14px", height: "14px" }} />Salva
          </button>
        )}
        {currentItinerary && (
          <button onClick={() => { setMobileScreen("map"); setMapReady(false); }}
            style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "13px", fontWeight: 600, padding: "7px 13px", borderRadius: "9999px", cursor: "pointer", transition: "all 0.2s",
              background: mapReady ? "var(--wd-grad-warm)" : "rgba(255,255,255,0.07)",
              color: mapReady ? "#fff" : "rgba(255,255,255,0.7)",
              border: mapReady ? "none" : "1px solid rgba(255,255,255,0.12)",
              boxShadow: mapReady ? "0 0 16px rgba(249,115,22,0.4)" : "none" }}>
            <Map style={{ width: "14px", height: "14px" }} />Mappa
          </button>
        )}
        <button onClick={handleNewTrip} aria-label="Nuova chat"
          style={{ width: "34px", height: "34px", borderRadius: "50%", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.6)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <Plus style={{ width: "18px", height: "18px" }} />
        </button>
      </div>
    </div>
  );

  const chatSection = (
    <section className="flex flex-col min-h-0 h-full">
      <div className="hidden lg:flex px-4 py-3 items-center justify-between shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)", ...glassDark }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {!sidebarOpen && <button onClick={() => setSidebarOpen(true)} style={{ color: "rgba(255,255,255,0.4)", background: "none", border: "none", cursor: "pointer", marginRight: "4px", display: "flex" }}><ChevronRight style={{ width: "18px", height: "18px" }} /></button>}
          <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--wd-grad-warm)" }} />
          <span style={{ fontSize: "14px", fontWeight: 700, color: "#fff" }}>Waydora</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {currentItinerary && <button onClick={handleSave} style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "12px", fontWeight: 600, padding: "6px 12px", borderRadius: "9999px", background: "rgba(255,255,255,0.09)", color: "#fff", border: "1px solid rgba(255,255,255,0.18)", cursor: "pointer" }}><Save style={{ width: "12px", height: "12px" }} />Salva</button>}
          <button onClick={handleNewTrip} style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "12px", fontWeight: 600, padding: "6px 12px", borderRadius: "9999px", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.1)", cursor: "pointer", background: "transparent" }}><PlusCircle style={{ width: "12px", height: "12px" }} />Nuovo</button>
        </div>
      </div>
      <div className="lg:hidden">{mobileHeader}</div>
      <div ref={chatScrollRef} style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: "20px" }}>
        {turns.length === 0 ? <WelcomeMessage userName={user?.name} onPrompt={p => handleSubmit(p)} /> : turns.map(turn => <ChatTurnView key={turn.id} turn={turn} />)}
      </div>
      <div style={{ padding: "12px 16px", borderTop: "1px solid rgba(255,255,255,0.07)", flexShrink: 0, ...glassDark }}>
        <QuickSuggestions onSelect={p => handleSubmit(p)} visible={hasItinerary && !chatMutation.isPending} />
        <div style={{ marginTop: hasItinerary ? "8px" : "0" }}>
          <AdvancedChatInput value={input} onChange={setInput} onSubmit={() => handleSubmit()} isPending={chatMutation.isPending}
            onMediaAttach={setMediaContent} mediaContent={mediaContent} onMediaRemove={() => setMediaContent(null)}
            placeholder="Dimmi dove vuoi andare..." />
        </div>
      </div>
    </section>
  );

  return (
    <Layout>
      <div className="fixed inset-0 -z-10" style={{ background: "var(--wd-bg)" }}>
        <div style={{ position: "absolute", top: "-10%", right: "-5%", width: "50vw", height: "50vw", borderRadius: "50%", background: "radial-gradient(circle,var(--wd-blob-pink) 0%,transparent 65%)", filter: "blur(70px)" }} />
        <div style={{ position: "absolute", bottom: "5%", left: "-5%", width: "45vw", height: "45vw", borderRadius: "50%", background: "radial-gradient(circle,var(--wd-blob-indigo) 0%,transparent 65%)", filter: "blur(70px)" }} />
      </div>

      {/* DESKTOP */}
      <div className="flex-1 min-h-0 hidden lg:flex">
        {!sidebarOpen && <button onClick={() => setSidebarOpen(true)} className="absolute left-0 top-1/2 -translate-y-1/2 z-20 p-2 rounded-r-xl" style={{ background: "rgba(10,10,18,0.9)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)" }}><ChevronRight style={{ width: "16px", height: "16px" }} /></button>}
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} onNewTrip={handleNewTrip}
          sessions={sidebarSessions} onLoadSession={handleLoadSession} onDeleteSession={handleDeleteSession}
          activeView={activeView} onChangeView={handleChangeView} onLoginClick={() => setAuthOpen(true)} />
        {activeView === "inspire" && <div className="flex-1 min-h-0 overflow-hidden"><InspirePage onSelectTrip={p => handleSubmit(p)} onLikeFeatured={handleLike} isFeaturedLiked={isFeaturedLiked} publishedUserTrips={publishedUserTrips} /></div>}
        {activeView === "create"  && <div className="flex-1 min-h-0 overflow-hidden"><CreateTripPage userId={user?.id} trips={userTrips} onSaveDraft={async d => await upsertTrip(d)} onPublish={async id => await publishTrip(id)} onDelete={removeTrip} /></div>}
        {activeView === "saved"   && <div className="flex-1 min-h-0 overflow-hidden"><SavedTripsPage saved={savedTrips} loading={false} onRemove={removeSaved} onLogin={() => setAuthOpen(true)} isLoggedIn={!!user} /></div>}
        {activeView === "chat" && (
          <>
            <section className="flex flex-col min-h-0 shrink-0" style={{ width: "38vw", borderRight: "1px solid rgba(255,255,255,0.07)" }}>{chatSection}</section>
            <aside className="flex flex-col min-h-0 flex-1">
              <MapToolbar active={activeTool} onChange={setActiveTool} />
              <div className="flex-1 min-h-0">
                <ToolContent tool={activeTool} itinerary={currentItinerary}
                  ideas={ideas} onAddIdea={i => setIdeas(prev => [...prev, i])} onRemoveIdea={idx => setIdeas(prev => prev.filter((_, i) => i !== idx))}
                  mediaFiles={mediaFiles} onUploadMedia={f => setMediaFiles(prev => [...prev, ...f])} onRemoveMedia={idx => setMediaFiles(prev => prev.filter((_, i) => i !== idx))} />
              </div>
            </aside>
          </>
        )}
      </div>

      {/* MOBILE */}
      <div className="flex-1 min-h-0 lg:hidden flex flex-col" style={{ overscrollBehaviorX: "contain", touchAction: "pan-y" }}>
        {/* Edge-zone invisible: cattura il swipe dal bordo sinistro per aprire la sidebar
            o tornare in chat dalle altre sezioni, bloccando il gesto back del browser. */}
        {!mobileSidebarOpen && (
          <div
            aria-hidden
            onTouchStart={(e) => {
              const x = e.touches[0].clientX;
              if (x <= 24) {
                swipeStartX.current = x;
                swipeStartY.current = e.touches[0].clientY;
              } else {
                swipeStartX.current = -1;
              }
            }}
            onTouchMove={(e) => {
              if (swipeStartX.current < 0) return;
              const dx = e.touches[0].clientX - swipeStartX.current;
              const dy = Math.abs(e.touches[0].clientY - swipeStartY.current);
              // Se l'utente sta tirando orizzontalmente: blocca il back gesture nativo
              if (dx > 6 && dy < 30) {
                try { e.preventDefault(); } catch {}
              }
            }}
            onTouchEnd={(e) => {
              if (swipeStartX.current < 0) return;
              const endX = e.changedTouches[0].clientX;
              const endY = e.changedTouches[0].clientY;
              const dx = endX - swipeStartX.current;
              const dy = Math.abs(endY - swipeStartY.current);
              if (dx > 60 && dy < 80) {
                if (mobileScreenRef.current !== "chat") {
                  // Da altre schermate → torna in chat invece che back del browser
                  setMobileScreen("chat");
                  setActiveView("chat");
                } else {
                  setMobileSidebarOpen(true);
                }
              }
              swipeStartX.current = -1;
            }}
            style={{
              position: "fixed", top: 0, left: 0, bottom: 0, width: "20px",
              zIndex: 35, touchAction: "none", background: "transparent",
            }}
          />
        )}
        <Sidebar open={mobileSidebarOpen} onClose={() => setMobileSidebarOpen(false)} onNewTrip={handleNewTrip}
          sessions={sidebarSessions} onLoadSession={handleLoadSession} onDeleteSession={handleDeleteSession}
          activeView={activeView} onChangeView={handleChangeView} onLoginClick={() => setAuthOpen(true)} isMobile />

        {mobileScreen === "chat" && <div className="flex-1 min-h-0 flex flex-col">{chatSection}</div>}

        {mobileScreen === "map" && (
          <div className="flex-1 min-h-0 flex flex-col">
            <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.07)", flexShrink: 0, ...glassDark, minHeight: "60px" }}>
              <button onClick={() => setMobileScreen("chat")} className="wd-soft-btn"
                style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "9px 16px 9px 10px", borderRadius: "9999px", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
                <span style={{ width: "22px", height: "22px", borderRadius: "50%", background: "rgba(255,255,255,0.14)", border: "1px solid rgba(255,255,255,0.22)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                  <ArrowLeft style={{ width: "13px", height: "13px", color: "#fff" }} />
                </span>
                Torna alla chat
              </button>
              <span style={{ fontSize: "14px", fontWeight: 700, color: "rgba(255,255,255,0.7)" }}>
                {MAP_TOOLS.find(t => t.id === activeTool)?.label ?? "Mappa"}
              </span>
              <div style={{ width: "80px" }} />
            </div>
            <div style={{ flex: 1, minHeight: 0, overflowY: activeTool === "map" ? "hidden" : "auto" }}>
              <ToolContent tool={activeTool} itinerary={currentItinerary}
                ideas={ideas} onAddIdea={i => setIdeas(prev => [...prev, i])} onRemoveIdea={idx => setIdeas(prev => prev.filter((_, i) => i !== idx))}
                mediaFiles={mediaFiles} onUploadMedia={f => setMediaFiles(prev => [...prev, ...f])} onRemoveMedia={idx => setMediaFiles(prev => prev.filter((_, i) => i !== idx))} />
            </div>
            {/* Toolbar bassa — nessun swipe listener qui, il problema era nel window listener */}
            <div style={{ flexShrink: 0, padding: "10px 12px 20px", display: "flex", justifyContent: "center", ...glassDark, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
              <div style={{ display: "flex", gap: "2px", overflowX: "auto", scrollbarWidth: "none", maxWidth: "100%" }}>
                {MAP_TOOLS.map(t => {
                  const Icon = t.icon; const isActive = activeTool === t.id;
                  return (
                    <button key={t.id} onClick={() => setActiveTool(t.id)}
                      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", padding: "8px 12px", borderRadius: "12px", border: "none", flexShrink: 0, cursor: "pointer", transition: "all 0.15s", background: isActive ? "rgba(255,255,255,0.12)" : "transparent", color: isActive ? "#fff" : "rgba(255,255,255,0.45)", minWidth: "54px" }}>
                      <Icon style={{ width: "18px", height: "18px" }} />
                      <span style={{ fontSize: "10px", fontWeight: 600 }}>{t.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {mobileScreen === "inspire" && (
          <div className="flex-1 min-h-0 flex flex-col">
            <MobilePageHeader title="Lasciati ispirare" onBack={() => setMobileScreen("chat")} />
            <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
              <InspirePage onSelectTrip={p => handleSubmit(p)} onLikeFeatured={handleLike} isFeaturedLiked={isFeaturedLiked} publishedUserTrips={publishedUserTrips} />
            </div>
          </div>
        )}

        {mobileScreen === "create" && (
          <div className="flex-1 min-h-0 flex flex-col">
            <MobilePageHeader title="Crea un viaggio" onBack={() => setMobileScreen("chat")} />
            <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
              <CreateTripPage userId={user?.id} trips={userTrips}
                onSaveDraft={async d => await upsertTrip(d)} onPublish={async id => await publishTrip(id)}
                onDelete={removeTrip} mobileOnly />
            </div>
          </div>
        )}

        {mobileScreen === "saved" && (
          <div className="flex-1 min-h-0 flex flex-col">
            <MobilePageHeader title="Viaggi salvati" onBack={() => setMobileScreen("chat")} />
            <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
              <SavedTripsPage saved={savedTrips} loading={false} onRemove={removeSaved} onLogin={() => setAuthOpen(true)} isLoggedIn={!!user} />
            </div>
          </div>
        )}
      </div>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </Layout>
  );
}