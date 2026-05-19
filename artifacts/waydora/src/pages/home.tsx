import { useEffect, useRef, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  useListSuggestions, useChat, useSaveItinerary,
  type ChatMessage, type ItineraryData,
} from "@/hooks/api";
import { useAuth } from "@/hooks/auth";
import { AuthModal } from "@/components/auth-modal";
import { fetchWeather, type WeatherData } from "@/lib/weather";
import { InspirePage } from "@/components/inspire-page";
import { CreateTripPage } from "@/components/create-trip-page";
import { SavedTripsPage } from "@/components/saved-trips-page";
import { useChatSessions, useUserTrips, useSavedTrips, useLocalSessions } from "@/hooks/trips";
import {
  Send, Loader2, Save, PlusCircle, Map, ChevronLeft, ChevronRight,
  Compass, BookMarked, Calendar, DollarSign, Cloud, Camera,
  Lightbulb, Menu, CheckSquare, LogOut, LogIn, User,
  Mic, MicOff, ImagePlus, X, Link, ExternalLink,
  Navigation, Download, Plus, MessageSquare, Edit3,
} from "lucide-react";
import { Layout, Logo } from "@/components/layout";
import { ItineraryResults, PackingList } from "@/components/itinerary-results";
import { TripMap } from "@/components/trip-map";
import {
  HowItWorks, TripCounter, Partners, Reviews, Faq, SiteFooter, HeroLanding,
} from "@/components/landing-sections";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";

// ── Tipi ──────────────────────────────────────────────────────────────────
type ChatTurn = {
  id: number;
  userMessage: string;
  assistantReply: string;
  itinerary?: ItineraryData;
  mediaPreview?: string;
};

type MediaContent = {
  mediaType: string; data: string; preview: string; name: string;
};

type ActiveView = "chat" | "inspire" | "create" | "saved";

// ── Stili ─────────────────────────────────────────────────────────────────
const glassDark = {
  background: "rgba(10,10,18,0.88)",
  backdropFilter: "blur(24px) saturate(160%)",
  WebkitBackdropFilter: "blur(24px) saturate(160%)",
  border: "1px solid rgba(255,255,255,0.08)",
} as React.CSSProperties;

const itineraryCard = {
  background: "rgba(22,14,38,0.98)",
  border: "1px solid rgba(255,255,255,0.09)",
  borderRadius: "16px", padding: "16px", marginTop: "8px",
} as React.CSSProperties;

const activeTabStyle  = { background: "rgba(255,255,255,0.10)", color: "#ffffff",               border: "1px solid rgba(255,255,255,0.18)" } as React.CSSProperties;
const inactiveTabStyle = { background: "transparent",           color: "rgba(255,255,255,0.38)", border: "1px solid transparent"           } as React.CSSProperties;

const QUICK_SUGGESTIONS = [
  { label: "➕ Aggiungi un giorno",  prompt: "Aggiungi un altro giorno all'itinerario" },
  { label: "🍽️ Più ristoranti",     prompt: "Suggeriscimi altri ristoranti locali da non perdere" },
  { label: "📸 Spot Instagram",     prompt: "Dammi i migliori spot per foto Instagram in questa destinazione" },
  { label: "💰 Versione economica", prompt: "Rendi l'itinerario più economico mantenendo le esperienze migliori" },
  { label: "🏨 Consigli hotel",     prompt: "Dove mi consigli di dormire? Sia lusso che budget" },
  { label: "🚗 Come spostarsi",     prompt: "Come mi sposto tra le varie tappe? Mezzi pubblici o noleggio auto?" },
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

// ── Genera titolo sessione ────────────────────────────────────────────────
function generateTitle(turns: ChatTurn[], itinerary?: ItineraryData): string {
  if (itinerary?.destination) {
    const dest = itinerary.destination.split(",")[0];
    return `${dest} · ${itinerary.durationDays ?? "?"} giorni`;
  }
  const first = turns[0]?.userMessage ?? "";
  return first.length > 32 ? first.substring(0, 32) + "..." : first || "Nuova chat";
}

// ── MapToolbar ────────────────────────────────────────────────────────────
function MapToolbar({ active, onChange }: { active: string; onChange: (id: string) => void }) {
  return (
    <div className="flex items-center gap-1 px-3 py-2 overflow-x-auto [&::-webkit-scrollbar]:hidden shrink-0"
      style={{ borderBottom: "1px solid rgba(255,255,255,0.07)", ...glassDark }}>
      {MAP_TOOLS.map((t) => {
        const Icon = t.icon;
        const isActive = active === t.id;
        return (
          <button key={t.id} onClick={() => onChange(t.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all"
            style={isActive ? activeTabStyle : inactiveTabStyle}>
            <Icon className="w-3.5 h-3.5" />{t.label}
          </button>
        );
      })}
    </div>
  );
}

// ── MapTool ───────────────────────────────────────────────────────────────
function MapTool({ itinerary }: { itinerary?: ItineraryData }) {
  const open = () => {
    if (!itinerary) return;
    const points = (itinerary.days?.flatMap((d: any) => d.activities) ?? [])
      .filter((a: any) => a.coordinates?.lat && a.coordinates?.lng)
      .map((a: any) => `${a.coordinates.lat},${a.coordinates.lng}`).slice(0, 10);
    if (!points.length) { window.open(`https://www.google.com/maps/search/${encodeURIComponent(itinerary.destination)}`, "_blank"); return; }
    if (points.length === 1) { window.open(`https://www.google.com/maps/search/${points[0]}`, "_blank"); return; }
    window.open(`https://www.google.com/maps/dir/${points.map(p => encodeURIComponent(p)).join("/")}`, "_blank");
  };
  if (!itinerary) return <div className="h-full flex flex-col items-center justify-center gap-3" style={{ color: "rgba(255,255,255,0.3)" }}><Map style={{ width: "36px", height: "36px", opacity: 0.3 }} /><span className="text-sm">La mappa apparirà qui</span></div>;
  return (
    <div className="h-full flex flex-col">
      <div className="px-3 py-2 shrink-0 flex items-center justify-end" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <button onClick={open} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full" style={{ background: "rgba(66,133,244,0.15)", color: "#4285f4", border: "1px solid rgba(66,133,244,0.3)", cursor: "pointer" }}>
          <Navigation style={{ width: "12px", height: "12px" }} />Apri in Google Maps<ExternalLink style={{ width: "11px", height: "11px" }} />
        </button>
      </div>
      <div className="flex-1 min-h-0"><TripMap itinerary={itinerary} /></div>
    </div>
  );
}

// ── Tool components semplificati ──────────────────────────────────────────
function CalendarTool({ itinerary }: { itinerary?: ItineraryData }) {
  const exp = () => {
    if (!itinerary) return;
    const today = new Date();
    itinerary.days?.forEach((day: any, i: number) => {
      const d = new Date(today); d.setDate(today.getDate() + i);
      const ds = d.toISOString().replace(/[-:]/g,"").split(".")[0]+"Z";
      const nd = new Date(d); nd.setDate(d.getDate()+1);
      const nds = nd.toISOString().replace(/[-:]/g,"").split(".")[0]+"Z";
      const acts = day.activities?.map((a: any) => `• ${a.time} - ${a.title}`).join("\n") ?? "";
      const url = new URL("https://calendar.google.com/calendar/render");
      url.searchParams.set("action","TEMPLATE"); url.searchParams.set("text",`${itinerary.destination} - Giorno ${day.day}: ${day.title}`);
      url.searchParams.set("dates",`${ds}/${nds}`); url.searchParams.set("details",`${day.summary}\n\n${acts}\n\nCreato con Waydora 🗺️`);
      url.searchParams.set("location",itinerary.destination);
      setTimeout(() => window.open(url.toString(),"_blank"), i*500);
    });
  };
  if (!itinerary) return <PlaceholderTool emoji="📅" title="Calendario viaggio" desc="Genera un itinerario per sincronizzarlo" />;
  return (
    <div className="p-4 h-full overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <div style={{ fontSize:"15px",fontWeight:700,color:"#fff" }}>📅 Calendario</div>
        <button onClick={exp} style={{ display:"flex",alignItems:"center",gap:"6px",fontSize:"12px",fontWeight:600,padding:"6px 12px",borderRadius:"9999px",background:"rgba(66,133,244,0.15)",color:"#4285f4",border:"1px solid rgba(66,133,244,0.3)",cursor:"pointer" }}>
          <Download style={{ width:"12px",height:"12px" }} />Importa in Google Calendar
        </button>
      </div>
      <div style={{ display:"flex",flexDirection:"column",gap:"8px" }}>
        {itinerary.days?.map((day: any, i: number) => (
          <div key={day.day} style={{ background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:"12px",padding:"12px" }}>
            <div style={{ display:"flex",alignItems:"center",gap:"8px",marginBottom:"6px" }}>
              <div style={{ width:"22px",height:"22px",borderRadius:"50%",background:"linear-gradient(135deg,#f97316,#a855f7)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"11px",fontWeight:900,color:"#fff" }}>{i+1}</div>
              <div style={{ fontSize:"13px",fontWeight:700,color:"#fff" }}>{day.title}</div>
            </div>
            {day.activities?.map((a: any,ai: number) => (
              <div key={ai} style={{ display:"flex",gap:"8px",fontSize:"12px" }}>
                <span style={{ color:"rgba(255,255,255,0.4)",minWidth:"80px" }}>{a.time}</span>
                <span style={{ color:"rgba(255,255,255,0.7)" }}>{a.title}</span>
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
    fetchWeather(itinerary.destination, Math.min(itinerary.durationDays+1,14))
      .then(d => { setWeather(d); if (!d) setError("Impossibile caricare il meteo"); })
      .catch(() => setError("Errore meteo")).finally(() => setLoading(false));
  }, [itinerary?.destination, itinerary?.durationDays]);
  if (!itinerary) return <PlaceholderTool emoji="🌤" title="Meteo in tempo reale" desc="Genera un itinerario per vedere le previsioni" />;
  if (loading) return <div className="flex items-center justify-center h-full gap-3"><Loader2 style={{ width:"22px",height:"22px",color:"rgba(255,255,255,0.4)",animation:"wd-spin 0.8s linear infinite" }} /><span style={{ fontSize:"13px",color:"rgba(255,255,255,0.4)" }}>Caricamento...</span><style>{`@keyframes wd-spin{to{transform:rotate(360deg)}}`}</style></div>;
  if (!weather) return <div className="flex flex-col items-center justify-center h-full gap-3"><div style={{ fontSize:"2.5rem" }}>⛅</div><p style={{ fontSize:"13px",color:"rgba(255,255,255,0.4)" }}>{error ?? "Dati non disponibili"}</p></div>;
  return (
    <div className="p-4 h-full overflow-y-auto">
      <div style={{ marginBottom:"16px" }}><div style={{ fontSize:"15px",fontWeight:700,color:"#fff" }}>🌤 Meteo a {weather.location}</div><div style={{ fontSize:"11px",color:"rgba(255,255,255,0.35)" }}>{weather.country}</div></div>
      <div style={{ display:"flex",flexDirection:"column",gap:"8px" }}>
        {weather.days.map((day,i) => (
          <div key={i} style={{ display:"flex",alignItems:"center",gap:"12px",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:"12px",padding:"10px 14px" }}>
            <div style={{ fontSize:"11px",color:"rgba(255,255,255,0.45)",minWidth:"70px" }}>{new Date(day.date).toLocaleDateString("it-IT",{weekday:"short",day:"numeric",month:"short"})}</div>
            <img src={day.icon} alt={day.condition} style={{ width:"30px",height:"30px" }} />
            <div style={{ flex:1 }}><div style={{ fontSize:"13px",fontWeight:600,color:"#fff" }}>{day.condition}</div><div style={{ fontSize:"11px",color:"rgba(255,255,255,0.4)" }}>💨 {day.maxWindKph} km/h · 🌧 {day.chanceOfRain}%</div></div>
            <div style={{ fontSize:"16px",fontWeight:800,color:"#fff" }}>{day.avgTempC}°C</div>
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
      <div style={{ fontSize:"15px",fontWeight:700,color:"#fff",marginBottom:"14px" }}>💡 Le tue idee</div>
      <div style={{ display:"flex",gap:"8px",marginBottom:"14px" }}>
        <input value={v} onChange={e => setV(e.target.value)} onKeyDown={e => { if(e.key==="Enter") add(); }} placeholder="Aggiungi un'idea..." style={{ flex:1,background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:"10px",padding:"8px 12px",color:"#fff",fontSize:"13px",outline:"none" }} />
        <button onClick={add} style={{ width:"36px",height:"36px",borderRadius:"10px",background:"linear-gradient(135deg,#f97316,#a855f7)",border:"none",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0 }}><Plus style={{ width:"16px",height:"16px" }} /></button>
      </div>
      <div style={{ flex:1,overflowY:"auto" }}>
        {ideas.length===0 ? <div style={{ textAlign:"center",padding:"40px 20px",color:"rgba(255,255,255,0.3)" }}><div style={{ fontSize:"2.5rem",marginBottom:"8px" }}>💡</div><p style={{ fontSize:"13px" }}>Nessuna idea ancora</p></div>
          : <div style={{ display:"flex",flexDirection:"column",gap:"7px" }}>{ideas.map((idea,i) => <div key={i} style={{ display:"flex",alignItems:"center",gap:"8px",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:"10px",padding:"10px 12px" }}><span style={{ fontSize:"13px",color:"rgba(255,255,255,0.8)",flex:1 }}>{idea}</span><button onClick={()=>onRemove(i)} style={{ background:"none",border:"none",cursor:"pointer",color:"rgba(255,255,255,0.3)",padding:0 }}><X style={{ width:"14px",height:"14px" }} /></button></div>)}</div>}
      </div>
    </div>
  );
}

function MediaTool({ files, onUpload, onRemove }: { files: Array<{name:string;preview:string}>; onUpload: (f: Array<{name:string;preview:string}>) => void; onRemove: (idx:number) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="p-4 h-full flex flex-col">
      <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"14px" }}>
        <div style={{ fontSize:"15px",fontWeight:700,color:"#fff" }}>📸 Foto e media</div>
        <input ref={ref} type="file" accept="image/*,video/*" multiple style={{ display:"none" }} onChange={e => { onUpload(Array.from(e.target.files??[]).map(f=>({name:f.name,preview:URL.createObjectURL(f)}))); e.target.value=""; }} />
        <button onClick={()=>ref.current?.click()} style={{ display:"flex",alignItems:"center",gap:"5px",fontSize:"12px",fontWeight:600,padding:"6px 12px",borderRadius:"9999px",background:"rgba(255,255,255,0.09)",color:"rgba(255,255,255,0.7)",border:"1px solid rgba(255,255,255,0.15)",cursor:"pointer" }}><Plus style={{ width:"13px",height:"13px" }} />Carica</button>
      </div>
      {files.length===0 ? <div style={{ flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:"12px",color:"rgba(255,255,255,0.3)",textAlign:"center" }}><Camera style={{ width:"36px",height:"36px",opacity:0.3 }} /><p style={{ fontSize:"13px" }}>Nessun media caricato</p></div>
        : <div style={{ flex:1,overflowY:"auto",display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px" }}>{files.map((f,i)=><div key={i} style={{ position:"relative",borderRadius:"10px",overflow:"hidden",aspectRatio:"1" }}><img src={f.preview} alt={f.name} style={{ width:"100%",height:"100%",objectFit:"cover" }} /><button onClick={()=>onRemove(i)} style={{ position:"absolute",top:"4px",right:"4px",width:"20px",height:"20px",borderRadius:"50%",background:"rgba(0,0,0,0.7)",border:"none",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",padding:0 }}><X style={{ width:"11px",height:"11px" }} /></button></div>)}</div>}
    </div>
  );
}

function PlaceholderTool({ emoji, title, desc }: { emoji:string; title:string; desc:string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6">
      <div style={{ fontSize:"2.8rem" }}>{emoji}</div>
      <div style={{ fontSize:"15px",fontWeight:700,color:"#fff" }}>{title}</div>
      <div style={{ fontSize:"13px",color:"rgba(255,255,255,0.4)",maxWidth:"240px" }}>{desc}</div>
      <div className="text-xs font-semibold px-3 py-1 rounded-full" style={{ background:"rgba(255,255,255,0.08)",color:"rgba(255,255,255,0.6)",border:"1px solid rgba(255,255,255,0.15)" }}>Disponibile prossimamente</div>
    </div>
  );
}

function ToolContent({ tool,itinerary,ideas,onAddIdea,onRemoveIdea,mediaFiles,onUploadMedia,onRemoveMedia }: {
  tool:string; itinerary?:ItineraryData;
  ideas:string[]; onAddIdea:(i:string)=>void; onRemoveIdea:(idx:number)=>void;
  mediaFiles:Array<{name:string;preview:string}>; onUploadMedia:(f:Array<{name:string;preview:string}>)=>void; onRemoveMedia:(idx:number)=>void;
}) {
  if (tool==="map")      return null;
  if (tool==="calendar") return <CalendarTool itinerary={itinerary} />;
  if (tool==="weather")  return <WeatherTool itinerary={itinerary} />;
  if (tool==="bagaglio") return <PackingList list={itinerary?.packingList??[]} destination={itinerary?.destination} />;
  if (tool==="ideas")    return <IdeasTool ideas={ideas} onAdd={onAddIdea} onRemove={onRemoveIdea} />;
  if (tool==="media")    return <MediaTool files={mediaFiles} onUpload={onUploadMedia} onRemove={onRemoveMedia} />;
  if (tool==="expenses") return <PlaceholderTool emoji="💰" title="Gestione spese" desc="Tieni traccia del budget e dividi con il gruppo" />;
  return null;
}

// ── Sidebar ───────────────────────────────────────────────────────────────
function Sidebar({ open, onClose, onNewTrip, sessions, onLoadSession, activeView, onChangeView, onLoginClick }: {
  open:boolean; onClose:()=>void; onNewTrip:()=>void;
  sessions:Array<{id:string|number;title:string;turns:any[];itinerary?:any;apiMessages?:any[]}>;
  onLoadSession:(s:any)=>void;
  activeView:ActiveView; onChangeView:(v:ActiveView)=>void;
  onLoginClick:()=>void;
}) {
  const { user, logout } = useAuth();

  return (
    <AnimatePresence>
      {open && (
        <motion.aside initial={{ width:0,opacity:0 }} animate={{ width:260,opacity:1 }} exit={{ width:0,opacity:0 }} transition={{ duration:0.22 }}
          className="flex flex-col min-h-0 overflow-hidden shrink-0"
          style={{ borderRight:"1px solid rgba(255,255,255,0.07)",...glassDark }}>

          <div className="px-4 py-4 flex items-center justify-between shrink-0" style={{ borderBottom:"1px solid rgba(255,255,255,0.07)" }}>
            <Logo variant="header" />
            <button onClick={onClose} style={{ color:"rgba(255,255,255,0.35)" }}><ChevronLeft className="w-5 h-5" /></button>
          </div>

          {/* Nuova chat — rimane nella chat, NON torna alla landing */}
          <div className="px-3 pt-3 pb-1 shrink-0">
            <button onClick={onNewTrip}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
              style={activeView==="chat" ? activeTabStyle : inactiveTabStyle}>
              <PlusCircle className="w-4 h-4 shrink-0" />Nuova chat
            </button>
          </div>

          {/* Storico sessioni */}
          {sessions.length > 0 && (
            <div className="px-3 pb-2 shrink-0">
              <div style={{ fontSize:"10px",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.15em",color:"rgba(255,255,255,0.28)",padding:"8px 4px 4px" }}>Recenti</div>
              <ScrollArea style={{ maxHeight:"180px" }}>
                <div className="space-y-0.5">
                  {sessions.map((s) => (
                    <button key={s.id} onClick={()=>{ onLoadSession(s); onChangeView("chat"); }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left transition-all"
                      onMouseEnter={e=>(e.currentTarget.style.background="rgba(255,255,255,0.06)")}
                      onMouseLeave={e=>(e.currentTarget.style.background="transparent")}>
                      <MessageSquare style={{ width:"12px",height:"12px",color:"rgba(255,255,255,0.3)",flexShrink:0 }} />
                      <div style={{ flex:1,minWidth:0 }}>
                        <div style={{ fontSize:"12px",fontWeight:600,color:"rgba(255,255,255,0.75)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{s.title}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          <div style={{ height:"1px",background:"rgba(255,255,255,0.06)",margin:"4px 12px" }} />

          {/* Navigazione */}
          <div className="px-3 py-2 space-y-1 shrink-0">
            {([
              { id:"inspire", label:"Lasciati ispirare", icon:Compass },
              { id:"create",  label:"Crea un viaggio",   icon:Edit3 },
              { id:"saved",   label:"Viaggi salvati",    icon:BookMarked },
            ] as const).map(item => {
              const Icon = item.icon;
              return (
                <button key={item.id} onClick={()=>onChangeView(item.id)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
                  style={activeView===item.id ? activeTabStyle : inactiveTabStyle}>
                  <Icon className="w-4 h-4 shrink-0" />{item.label}
                </button>
              );
            })}
          </div>

          <div className="flex-1" />

          {/* Footer utente */}
          <div style={{ borderTop:"1px solid rgba(255,255,255,0.07)",padding:"12px" }}>
            {user ? (
              <div style={{ display:"flex",alignItems:"center",gap:"10px" }}>
                {user.avatar ? <img src={user.avatar} alt={user.name} style={{ width:"34px",height:"34px",borderRadius:"50%",objectFit:"cover",flexShrink:0 }} />
                  : <div style={{ width:"34px",height:"34px",borderRadius:"50%",flexShrink:0,background:"linear-gradient(135deg,#f97316,#a855f7)",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:700,fontSize:"13px" }}>{user.name?.[0]?.toUpperCase()??"W"}</div>}
                <div style={{ flex:1,minWidth:0 }}>
                  <div style={{ fontSize:"13px",fontWeight:600,color:"#fff",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{user.name}</div>
                  <div style={{ fontSize:"11px",color:"rgba(255,255,255,0.35)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{user.email}</div>
                </div>
                <button onClick={logout} style={{ background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:"8px",padding:"6px",cursor:"pointer",color:"rgba(255,255,255,0.45)",flexShrink:0,display:"flex" }}
                  onMouseEnter={e=>{e.currentTarget.style.color="#fff";}} onMouseLeave={e=>{e.currentTarget.style.color="rgba(255,255,255,0.45)";}}>
                  <LogOut style={{ width:"14px",height:"14px" }} />
                </button>
              </div>
            ) : (
              <button onClick={onLoginClick} style={{ width:"100%",display:"flex",alignItems:"center",justifyContent:"center",gap:"8px",padding:"10px",borderRadius:"12px",background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.12)",color:"rgba(255,255,255,0.7)",fontSize:"13px",fontWeight:600,cursor:"pointer" }}
                onMouseEnter={e=>{e.currentTarget.style.background="rgba(255,255,255,0.12)";e.currentTarget.style.color="#fff";}}
                onMouseLeave={e=>{e.currentTarget.style.background="rgba(255,255,255,0.07)";e.currentTarget.style.color="rgba(255,255,255,0.7)";}}>
                <LogIn style={{ width:"15px",height:"15px" }} />Accedi o Registrati
              </button>
            )}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

// ── Chat components ───────────────────────────────────────────────────────
function UserBubble({ text,mediaPreview }: { text:string;mediaPreview?:string }) {
  return (
    <div className="flex justify-end">
      <div style={{ maxWidth:"80%",display:"flex",flexDirection:"column",gap:"8px",alignItems:"flex-end" }}>
        {mediaPreview && <div style={{ borderRadius:"12px",overflow:"hidden",maxWidth:"200px" }}><img src={mediaPreview} alt="allegato" style={{ width:"100%",objectFit:"cover",display:"block" }} /></div>}
        {text && <div style={{ padding:"10px 14px",borderRadius:"18px 18px 4px 18px",background:"linear-gradient(135deg,#f97316,#a855f7)",color:"#fff",fontSize:"14px",lineHeight:1.55,boxShadow:"0 4px 16px rgba(249,115,22,0.2)" }}>{text}</div>}
      </div>
    </div>
  );
}

function AssistantBubble({ text }: { text:string }) {
  return <div className="flex justify-start"><div style={{ maxWidth:"85%",padding:"10px 14px",borderRadius:"18px 18px 18px 4px",background:"rgba(32,22,52,0.98)",border:"1px solid rgba(255,255,255,0.11)",color:"rgba(255,255,255,0.88)",fontSize:"14px",lineHeight:1.65 }}>{text}</div></div>;
}

function TypingIndicator() {
  return (
    <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} className="flex justify-start">
      <div className="flex items-center gap-2 px-4 py-3 rounded-2xl" style={{ background:"rgba(32,22,52,0.98)",border:"1px solid rgba(255,255,255,0.1)" }}>
        {[0,150,300].map(d=><div key={d} className="w-2 h-2 rounded-full" style={{ background:"rgba(255,255,255,0.5)",animation:`wd-bounce 1.2s ease-in-out ${d}ms infinite` }} />)}
        <span className="text-xs ml-1" style={{ color:"rgba(255,255,255,0.35)" }}>Waydora sta pianificando...</span>
      </div>
      <style>{`@keyframes wd-bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}`}</style>
    </motion.div>
  );
}

function WelcomeMessage({ userName }: { userName?:string }) {
  return (
    <motion.div initial={{ opacity:0,y:12 }} animate={{ opacity:1,y:0 }} transition={{ duration:0.5 }} className="flex flex-col items-center justify-center h-full gap-4 text-center px-6">
      <div style={{ fontSize:"3rem" }}>✈️</div>
      <div>
        <h3 style={{ fontSize:"18px",fontWeight:800,color:"#fff",marginBottom:"8px" }}>{userName?`Ciao, ${userName.split(" ")[0]}! 👋`:"Ciao! 👋"}</h3>
        <p style={{ fontSize:"14px",color:"rgba(255,255,255,0.5)",lineHeight:1.6,maxWidth:"280px" }}>Sono Waydora, la tua assistente di viaggio AI. Dimmi dove vuoi andare!</p>
      </div>
      <div style={{ display:"flex",flexWrap:"wrap",gap:"8px",justifyContent:"center",marginTop:"8px" }}>
        {["🗺️ 3 giorni a Tokyo","🏖️ Settimana al mare","🏛️ Weekend a Roma"].map(s=><span key={s} style={{ fontSize:"12px",fontWeight:600,padding:"6px 12px",borderRadius:"9999px",background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.12)",color:"rgba(255,255,255,0.6)" }}>{s}</span>)}
      </div>
    </motion.div>
  );
}

function AdvancedChatInput({ value,onChange,onSubmit,isPending,onMediaAttach,mediaContent,onMediaRemove,placeholder }: {
  value:string; onChange:(v:string)=>void; onSubmit:()=>void; isPending:boolean;
  onMediaAttach:(m:MediaContent)=>void; mediaContent:MediaContent|null; onMediaRemove:()=>void; placeholder?:string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [isRecording,setIsRecording] = useState(false);
  const [recognition,setRecognition] = useState<any>(null);
  const active = (value.trim()||mediaContent)&&!isPending;

  const hc = (e: React.ChangeEvent<HTMLTextAreaElement>) => { onChange(e.target.value); const ta=e.target; ta.style.height="auto"; ta.style.height=Math.min(ta.scrollHeight,120)+"px"; };
  const hf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file=e.target.files?.[0]; if(!file) return;
    const isImg=file.type.startsWith("image/"); const isVid=file.type.startsWith("video/");
    if(!isImg&&!isVid) return;
    if(file.size>20*1024*1024){alert("Max 20MB");return;}
    const preview=URL.createObjectURL(file);
    const reader=new FileReader();
    reader.onload=ev=>{const b64=(ev.target?.result as string)?.split(",")[1];if(b64)onMediaAttach({mediaType:isImg?file.type:"image/jpeg",data:b64,preview,name:file.name});};
    if(isImg){reader.readAsDataURL(file);}else{
      const v=document.createElement("video"); v.src=preview; v.currentTime=1;
      v.onloadeddata=()=>{const c=document.createElement("canvas");c.width=v.videoWidth;c.height=v.videoHeight;c.getContext("2d")?.drawImage(v,0,0);c.toBlob(blob=>{if(!blob)return;const fr=new FileReader();fr.onload=ev=>{const b64=(ev.target?.result as string)?.split(",")[1];if(b64)onMediaAttach({mediaType:"image/jpeg",data:b64,preview,name:file.name});};fr.readAsDataURL(blob);},"image/jpeg",0.85);};
    }
    e.target.value="";
  };
  const toggleRec = () => {
    const SR=(window as any).SpeechRecognition||(window as any).webkitSpeechRecognition;
    if(!SR){alert("Usa Chrome.");return;}
    if(isRecording&&recognition){recognition.stop();setIsRecording(false);return;}
    const rec=new SR(); rec.lang="it-IT"; rec.continuous=true; rec.interimResults=true;
    rec.onresult=(event: any)=>{let t="";for(let i=0;i<event.results.length;i++)t+=event.results[i][0].transcript;onChange(t);};
    rec.onend=()=>setIsRecording(false); rec.onerror=()=>setIsRecording(false);
    rec.start(); setRecognition(rec); setIsRecording(true);
  };
  const hasTT=/tiktok\.com/i.test(value);

  return (
    <div style={{ display:"flex",flexDirection:"column",gap:"8px" }}>
      {mediaContent&&<div style={{ position:"relative",display:"inline-block",alignSelf:"flex-start" }}><img src={mediaContent.preview} alt="allegato" style={{ height:"80px",borderRadius:"10px",objectFit:"cover",border:"1px solid rgba(255,255,255,0.15)" }} /><button onClick={onMediaRemove} style={{ position:"absolute",top:"-6px",right:"-6px",width:"20px",height:"20px",borderRadius:"50%",background:"rgba(0,0,0,0.8)",border:"1px solid rgba(255,255,255,0.2)",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",padding:0 }}><X style={{ width:"11px",height:"11px" }} /></button></div>}
      {hasTT&&<div style={{ display:"flex",alignItems:"center",gap:"6px",padding:"6px 10px",borderRadius:"8px",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)" }}><Link style={{ width:"12px",height:"12px",color:"#a78bfa" }} /><span style={{ fontSize:"11px",color:"rgba(255,255,255,0.6)" }}>Link TikTok rilevato 🎬</span></div>}
      <div style={{ display:"flex",alignItems:"flex-end",gap:"6px",background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:"20px",padding:"8px 8px 8px 14px" }}>
        <textarea value={value} onChange={hc} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();if(active)onSubmit();}}} placeholder={isRecording?"🎤 In ascolto...":placeholder} rows={1}
          className="flex-1 bg-transparent resize-none outline-none border-none text-sm leading-relaxed"
          style={{ minHeight:"32px",maxHeight:"120px",paddingTop:"6px",paddingBottom:"6px",color:"rgba(255,255,255,0.9)",caretColor:"#fff" }} />
        <div style={{ display:"flex",alignItems:"center",gap:"4px",flexShrink:0 }}>
          <input ref={fileRef} type="file" accept="image/*,video/*" style={{ display:"none" }} onChange={hf} />
          <button onClick={()=>fileRef.current?.click()} style={{ width:"32px",height:"32px",borderRadius:"50%",border:"none",background:mediaContent?"rgba(167,139,250,0.2)":"rgba(255,255,255,0.07)",color:mediaContent?"#a78bfa":"rgba(255,255,255,0.4)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer" }}><ImagePlus style={{ width:"15px",height:"15px" }} /></button>
          <button onClick={toggleRec} style={{ width:"32px",height:"32px",borderRadius:"50%",border:"none",background:isRecording?"rgba(239,68,68,0.25)":"rgba(255,255,255,0.07)",color:isRecording?"#f87171":"rgba(255,255,255,0.4)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer" }}>{isRecording?<MicOff style={{ width:"14px",height:"14px" }} />:<Mic style={{ width:"14px",height:"14px" }} />}</button>
          <button onClick={onSubmit} disabled={!active} style={{ width:"34px",height:"34px",borderRadius:"50%",border:"none",background:active?"linear-gradient(135deg,#f97316,#a855f7)":"rgba(255,255,255,0.06)",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",cursor:active?"pointer":"not-allowed",transform:active?"scale(1)":"scale(0.9)",transition:"all 0.15s" }}>
            {isPending?<Loader2 style={{ width:"14px",height:"14px",animation:"wd-spin2 0.8s linear infinite" }} />:<Send style={{ width:"13px",height:"13px" }} />}
          </button>
        </div>
      </div>
      <style>{`@keyframes wd-spin2{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

function QuickSuggestions({ onSelect,visible }: { onSelect:(p:string)=>void;visible:boolean }) {
  if(!visible) return null;
  return <motion.div initial={{ opacity:0,y:8 }} animate={{ opacity:1,y:0 }} style={{ display:"flex",flexWrap:"wrap",gap:"6px",padding:"8px 0 0" }}>{QUICK_SUGGESTIONS.map(s=><button key={s.label} onClick={()=>onSelect(s.prompt)} style={{ fontSize:"12px",fontWeight:600,padding:"5px 12px",borderRadius:"9999px",background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.12)",color:"rgba(255,255,255,0.7)",cursor:"pointer",transition:"all 0.15s",whiteSpace:"nowrap" }} onMouseEnter={e=>{e.currentTarget.style.background="rgba(255,255,255,0.13)";e.currentTarget.style.color="#fff";}} onMouseLeave={e=>{e.currentTarget.style.background="rgba(255,255,255,0.07)";e.currentTarget.style.color="rgba(255,255,255,0.7)";}}>  {s.label}</button>)}</motion.div>;
}

function ChatTurnView({ turn }: { turn:ChatTurn }) {
  return (
    <div className="space-y-3">
      <UserBubble text={turn.userMessage} mediaPreview={turn.mediaPreview} />
      {turn.assistantReply===""?<TypingIndicator/>:(
        <><AssistantBubble text={turn.assistantReply} />
        {turn.itinerary&&<motion.div initial={{ opacity:0,y:10 }} animate={{ opacity:1,y:0 }} transition={{ delay:0.1 }} style={itineraryCard}><ItineraryResults itinerary={turn.itinerary} /></motion.div>}</>
      )}
    </div>
  );
}

function LandingNav({ onLoginClick,onEnterChat }: { onLoginClick:()=>void;onEnterChat:()=>void }) {
  const { user,logout } = useAuth();
  return (
    <div style={{ position:"absolute",top:0,right:0,zIndex:30,padding:"20px 24px",display:"flex",alignItems:"center",gap:"12px" }}>
      {user?(
        <div style={{ display:"flex",alignItems:"center",gap:"10px" }}>
          <button onClick={onEnterChat} style={{ display:"flex",alignItems:"center",gap:"8px",background:"rgba(255,255,255,0.12)",border:"1px solid rgba(255,255,255,0.22)",backdropFilter:"blur(12px)",WebkitBackdropFilter:"blur(12px)",borderRadius:"9999px",padding:"7px 14px 7px 8px",color:"#fff",fontSize:"13px",fontWeight:600,cursor:"pointer" }}>
            {user.avatar?<img src={user.avatar} alt={user.name} style={{ width:"24px",height:"24px",borderRadius:"50%",objectFit:"cover" }} />:<div style={{ width:"24px",height:"24px",borderRadius:"50%",background:"linear-gradient(135deg,#f97316,#a855f7)",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:700,fontSize:"11px" }}>{user.name?.[0]?.toUpperCase()??"W"}</div>}
            {user.name?.split(" ")[0]}
          </button>
          <button onClick={logout} style={{ background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:"9999px",padding:"7px 14px",color:"rgba(255,255,255,0.6)",fontSize:"12px",fontWeight:600,cursor:"pointer" }}>Esci</button>
        </div>
      ):(
        <button onClick={onLoginClick} style={{ display:"flex",alignItems:"center",gap:"6px",background:"rgba(255,255,255,0.12)",border:"1px solid rgba(255,255,255,0.22)",backdropFilter:"blur(12px)",WebkitBackdropFilter:"blur(12px)",borderRadius:"9999px",padding:"8px 18px",color:"#fff",fontSize:"13px",fontWeight:600,cursor:"pointer" }}>
          <User style={{ width:"14px",height:"14px" }} />Accedi
        </button>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────
export default function Home() {
  const [turns,            setTurns]            = useState<ChatTurn[]>([]);
  const [input,            setInput]            = useState("");
  const [mediaContent,     setMediaContent]     = useState<MediaContent|null>(null);
  const [currentItinerary, setCurrentItinerary] = useState<ItineraryData|undefined>();
  const [apiMessages,      setApiMessages]      = useState<ChatMessage[]>([]);
  const [sidebarOpen,      setSidebarOpen]      = useState(true);
  const [activeTool,       setActiveTool]       = useState("map");
  const [authOpen,         setAuthOpen]         = useState(false);
  // ← KEY FIX: showLanding invece di forceChat
  // true = mostra landing; false = mostra app (chat/inspire/create/saved)
  const [showLanding,      setShowLanding]      = useState(true);
  const [activeView,       setActiveView]       = useState<ActiveView>("chat");
  const [ideas,            setIdeas]            = useState<string[]>([]);
  const [mediaFiles,       setMediaFiles]       = useState<Array<{name:string;preview:string}>>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string|undefined>();

  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const localSessions = useLocalSessions();

  // Hooks Supabase
  const { sessions: dbSessions, upsert: upsertSession } = useChatSessions(user?.id);
  const { trips: userTrips, upsert: upsertTrip, publish: publishTrip, remove: removeTrip } = useUserTrips(user?.id);
  const { saved: savedTrips, saveItinerary, saveInspiredTrip, remove: removeSaved, isLiked } = useSavedTrips(user?.id);

  // Sessioni locali per utenti non loggati
  const [localSessionsList, setLocalSessionsList] = useState<any[]>(() => localSessions.load());

  // Sessioni da mostrare nella sidebar
  const sidebarSessions = user ? dbSessions : localSessionsList;

  const { data: suggestions } = useListSuggestions();
  const chatMutation = useChat();
  const saveMutation = useSaveItinerary(); // backend legacy — useremo Supabase

  useEffect(() => { document.title = "Waydora — Travel simple, everywhere!"; }, []);
  useEffect(() => { setTimeout(() => { chatScrollRef.current?.scrollTo({ top:chatScrollRef.current.scrollHeight,behavior:"smooth" }); },80); }, [turns]);

  // ── Salva sessione (Supabase o localStorage) ────────────────────────────
  const persistSession = useCallback(async (t: ChatTurn[], itinerary?: ItineraryData, msgs?: ChatMessage[], id?: string) => {
    const title = generateTitle(t, itinerary);
    if (user) {
      const result = await upsertSession({ id, title, turns: t, api_messages: msgs ?? [], itinerary: itinerary ?? null });
      return result?.id;
    } else {
      const localId = id ?? Date.now().toString();
      const session = { id: localId, title, turns: t, itinerary, apiMessages: msgs ?? [], createdAt: new Date().toISOString() };
      localSessions.add(session);
      setLocalSessionsList(localSessions.load());
      return localId;
    }
  }, [user, upsertSession, localSessions]);

  const handleSubmit = useCallback((overridePrompt?: string) => {
    const promptText = (overridePrompt ?? input).trim();
    if ((!promptText && !mediaContent) || chatMutation.isPending) return;
    if (!overridePrompt) setInput("");
    // Quando l'utente manda un messaggio → sempre in chat, mai landing
    setShowLanding(false);
    setActiveView("chat");

    const turnId = Date.now();
    const mediaPreview = mediaContent?.preview;
    setTurns(prev => [...prev, { id:turnId, userMessage:promptText||"📎 Media allegato", assistantReply:"", mediaPreview }]);

    const newMsgs: ChatMessage[] = [...apiMessages, { role:"user", content:promptText||"Analizza questo contenuto" }];
    setApiMessages(newMsgs);
    const mediaForBackend = mediaContent ? { mediaType:mediaContent.mediaType, data:mediaContent.data } : undefined;
    setMediaContent(null);

    chatMutation.mutate(
      { data:{ messages:newMsgs, existingItinerary:currentItinerary, mediaContent:mediaForBackend } as any },
      {
        onSuccess: async (data) => {
          setApiMessages(prev => [...prev, { role:"assistant", content:data.reply }]);
          if (data.itinerary) setCurrentItinerary(data.itinerary);
          const updatedTurns = [...turns.filter(t=>t.id!==turnId), { id:turnId, userMessage:promptText||"📎 Media allegato", assistantReply:data.reply, itinerary:data.itinerary??undefined, mediaPreview }];
          setTurns(updatedTurns);
          // Persisti automaticamente quando arriva un itinerario
          if (data.itinerary) {
            const sid = await persistSession(updatedTurns, data.itinerary, [...newMsgs,{role:"assistant",content:data.reply}], currentSessionId);
            if (sid) setCurrentSessionId(sid);
          }
        },
        onError: () => {
          setTurns(prev => prev.filter(t=>t.id!==turnId));
          setApiMessages(prev => prev.slice(0,-1));
          toast({ title:"Qualcosa è andato storto", description:"Riprova.", variant:"destructive" });
        },
      }
    );
  }, [input,mediaContent,apiMessages,currentItinerary,turns,currentSessionId,chatMutation,toast,persistSession]);

  // ── Salva itinerario su Supabase ─────────────────────────────────────────
  const handleSave = async () => {
    if (!currentItinerary) return;
    if (!user) { setAuthOpen(true); return; }
    const result = await saveItinerary(currentItinerary);
    if (result) toast({ title:"Itinerario salvato! 🎉", description:"Vai in 'Viaggi salvati' per condividerlo." });
    else toast({ title:"Errore salvataggio", variant:"destructive" });
  };

  // ── Nuova chat — NON torna alla landing ──────────────────────────────────
  const handleNewTrip = useCallback(async () => {
    // Salva la sessione corrente prima di azzerarla
    if (turns.length > 0) {
      await persistSession(turns, currentItinerary, apiMessages, currentSessionId);
    }
    setTurns([]); setApiMessages([]); setCurrentItinerary(undefined);
    setInput(""); setMediaContent(null); setCurrentSessionId(undefined);
    setActiveView("chat");
    // ← NON setShowLanding(true) — rimane nell'app con chat vuota
  }, [turns,currentItinerary,apiMessages,currentSessionId,persistSession]);

  const handleLoadSession = (s: any) => {
    setTurns(s.turns ?? []);
    setApiMessages(s.apiMessages ?? s.api_messages ?? []);
    setCurrentItinerary(s.itinerary);
    setCurrentSessionId(s.id?.toString());
    setShowLanding(false);
    setActiveView("chat");
  };

  const handleChangeView = (view: ActiveView) => {
    setActiveView(view);
    setShowLanding(false); // qualsiasi view → fuori dalla landing
  };

  // ── Like su "Lasciati ispirare" ──────────────────────────────────────────
  const handleLike = async (tripId: string, title: string) => {
    if (!user) { setAuthOpen(true); return; }
    if (isLiked(tripId)) {
      const existing = savedTrips.find(s => s.trip_id === tripId);
      if (existing) await removeSaved(existing.id);
    } else {
      await saveInspiredTrip(tripId, title);
    }
  };

  const hasItinerary = turns.some(t => t.itinerary);
  const publishedUserTrips = userTrips.filter(t => t.status === "published");

  // ── LANDING ──────────────────────────────────────────────────────────────
  if (showLanding) {
    return (
      <Layout>
        <div className="flex-1 overflow-y-auto" style={{ background:"#0a0a12",position:"relative" }}>
          <LandingNav onLoginClick={()=>setAuthOpen(true)} onEnterChat={()=>{ setShowLanding(false); setActiveView("chat"); }} />
          <HeroLanding onSubmit={handleSubmit} isPending={chatMutation.isPending} />
          <HowItWorks /><TripCounter /><Partners /><Reviews /><Faq /><SiteFooter />
        </div>
        <AuthModal open={authOpen} onClose={()=>setAuthOpen(false)} />
      </Layout>
    );
  }

  // ── APP ───────────────────────────────────────────────────────────────────
  return (
    <Layout>
      <div className="fixed inset-0 -z-10" style={{ background:"#0a0a12" }}>
        <div style={{ position:"absolute",top:"-10%",right:"-5%",width:"50vw",height:"50vw",borderRadius:"50%",background:"radial-gradient(circle,rgba(249,115,22,0.15) 0%,transparent 65%)",filter:"blur(70px)" }} />
        <div style={{ position:"absolute",bottom:"5%",left:"-5%",width:"45vw",height:"45vw",borderRadius:"50%",background:"radial-gradient(circle,rgba(168,85,247,0.15) 0%,transparent 65%)",filter:"blur(70px)" }} />
      </div>

      {/* DESKTOP */}
      <div className="flex-1 min-h-0 hidden lg:flex">
        {!sidebarOpen&&<button onClick={()=>setSidebarOpen(true)} className="absolute left-0 top-1/2 -translate-y-1/2 z-20 p-2 rounded-r-xl" style={{ background:"rgba(10,10,18,0.9)",border:"1px solid rgba(255,255,255,0.1)",color:"rgba(255,255,255,0.5)" }}><ChevronRight className="w-4 h-4" /></button>}

        <Sidebar open={sidebarOpen} onClose={()=>setSidebarOpen(false)} onNewTrip={handleNewTrip}
          sessions={sidebarSessions} onLoadSession={handleLoadSession}
          activeView={activeView} onChangeView={handleChangeView}
          onLoginClick={()=>setAuthOpen(true)} />

        {/* Pagine non-chat */}
        {activeView==="inspire" && (
          <div className="flex-1 min-h-0 overflow-hidden">
            <InspirePage onSelectTrip={p=>handleSubmit(p)}
              likedIds={savedTrips.filter(s=>s.trip_id).map(s=>s.trip_id!)}
              onLike={handleLike}
              publishedUserTrips={publishedUserTrips} />
          </div>
        )}

        {activeView==="create" && (
          <div className="flex-1 min-h-0 overflow-hidden">
            <CreateTripPage userId={user?.id} trips={userTrips}
              onSaveDraft={async (draft) => { const r = await upsertTrip(draft); return r; }}
              onPublish={async (id) => { const r = await publishTrip(id); return r; }}
              onDelete={removeTrip} />
          </div>
        )}

        {activeView==="saved" && (
          <div className="flex-1 min-h-0 overflow-hidden">
            <SavedTripsPage saved={savedTrips} loading={false}
              onRemove={removeSaved} onLogin={()=>setAuthOpen(true)} isLoggedIn={!!user} />
          </div>
        )}

        {activeView==="chat" && (
          <>
            {/* CHAT */}
            <section className="flex flex-col min-h-0 shrink-0" style={{ width:"38vw",borderRight:"1px solid rgba(255,255,255,0.07)" }}>
              <div className="px-4 py-3 flex items-center justify-between shrink-0" style={{ borderBottom:"1px solid rgba(255,255,255,0.07)",...glassDark }}>
                <div className="flex items-center gap-2">
                  {!sidebarOpen&&<button onClick={()=>setSidebarOpen(true)} style={{ color:"rgba(255,255,255,0.4)",marginRight:"4px" }}><Menu className="w-4 h-4" /></button>}
                  <div className="w-2 h-2 rounded-full" style={{ background:"linear-gradient(135deg,#f97316,#a855f7)" }} />
                  <span className="text-sm font-bold text-white">Waydora</span>
                </div>
                <div className="flex items-center gap-2">
                  {currentItinerary&&<button onClick={handleSave} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full" style={{ background:"rgba(255,255,255,0.09)",color:"#fff",border:"1px solid rgba(255,255,255,0.18)",cursor:"pointer" }}><Save className="w-3 h-3" />Salva</button>}
                  <button onClick={handleNewTrip} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full" style={{ color:"rgba(255,255,255,0.45)",border:"1px solid rgba(255,255,255,0.1)",cursor:"pointer" }} onMouseEnter={e=>{e.currentTarget.style.color="#fff";}} onMouseLeave={e=>{e.currentTarget.style.color="rgba(255,255,255,0.45)";}}>
                    <PlusCircle className="w-3.5 h-3.5" />Nuovo
                  </button>
                </div>
              </div>

              <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-4 space-y-6 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded-full" style={{ scrollbarColor:"rgba(255,255,255,0.15) transparent" }}>
                {turns.length===0?<WelcomeMessage userName={user?.name} />:turns.map(turn=><ChatTurnView key={turn.id} turn={turn} />)}
              </div>

              <div className="px-4 py-3 shrink-0" style={{ borderTop:"1px solid rgba(255,255,255,0.07)",...glassDark }}>
                <QuickSuggestions onSelect={p=>handleSubmit(p)} visible={hasItinerary&&!chatMutation.isPending} />
                <div style={{ marginTop:hasItinerary?"8px":"0" }}>
                  <AdvancedChatInput value={input} onChange={setInput} onSubmit={()=>handleSubmit()} isPending={chatMutation.isPending}
                    onMediaAttach={setMediaContent} mediaContent={mediaContent} onMediaRemove={()=>setMediaContent(null)}
                    placeholder="Dimmi dove vuoi andare..." />
                </div>
                <p className="text-center text-xs mt-2" style={{ color:"rgba(255,255,255,0.15)" }}>Shift+Invio per andare a capo</p>
              </div>
            </section>

            {/* MAPPA */}
            <aside className="flex flex-col min-h-0 flex-1">
              <MapToolbar active={activeTool} onChange={setActiveTool} />
              <div className="flex-1 min-h-0">
                {activeTool==="map"?<MapTool itinerary={currentItinerary} />
                  :<ToolContent tool={activeTool} itinerary={currentItinerary}
                      ideas={ideas} onAddIdea={i=>setIdeas(prev=>[...prev,i])} onRemoveIdea={idx=>setIdeas(prev=>prev.filter((_,i)=>i!==idx))}
                      mediaFiles={mediaFiles} onUploadMedia={f=>setMediaFiles(prev=>[...prev,...f])} onRemoveMedia={idx=>setMediaFiles(prev=>prev.filter((_,i)=>i!==idx))} />}
              </div>
            </aside>
          </>
        )}
      </div>

      {/* MOBILE */}
      <div className="flex-1 min-h-0 lg:hidden flex flex-col">
        <Tabs defaultValue="chat" className="flex-1 flex flex-col min-h-0">
          <div className="px-3 pt-3 shrink-0">
            <TabsList className="w-full grid grid-cols-3 rounded-xl p-1" style={{ background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.09)" }}>
              {[{value:"chat",label:"Chat"},{value:"trip",label:"Itinerario"},{value:"map",label:"Mappa"}].map(t=>(
                <TabsTrigger key={t.value} value={t.value} className="text-xs font-semibold rounded-lg data-[state=active]:bg-[rgba(255,255,255,0.12)] data-[state=active]:text-white text-[rgba(255,255,255,0.4)]">{t.label}</TabsTrigger>
              ))}
            </TabsList>
          </div>
          <TabsContent value="chat" className="flex-1 min-h-0 flex flex-col mt-2">
            <div className="flex-1 overflow-y-auto px-3 py-2 space-y-5">
              {turns.length===0?<WelcomeMessage userName={user?.name} />:turns.map(turn=><ChatTurnView key={turn.id} turn={turn} />)}
            </div>
            <div className="px-3 py-3 shrink-0" style={{ borderTop:"1px solid rgba(255,255,255,0.07)",...glassDark }}>
              <QuickSuggestions onSelect={p=>handleSubmit(p)} visible={hasItinerary&&!chatMutation.isPending} />
              <div style={{ marginTop:hasItinerary?"8px":"0" }}>
                <AdvancedChatInput value={input} onChange={setInput} onSubmit={()=>handleSubmit()} isPending={chatMutation.isPending}
                  onMediaAttach={setMediaContent} mediaContent={mediaContent} onMediaRemove={()=>setMediaContent(null)} placeholder="Dimmi dove vuoi andare..." />
              </div>
            </div>
          </TabsContent>
          <TabsContent value="trip" className="flex-1 min-h-0 mt-2">
            <div className="h-full overflow-y-auto px-3 pb-8">
              {currentItinerary?(
                <div style={{ background:"rgba(22,14,38,0.98)",border:"1px solid rgba(255,255,255,0.09)",borderRadius:"16px",padding:"14px" }}>
                  <ItineraryResults itinerary={currentItinerary} />
                  <div className="mt-5 pt-4" style={{ borderTop:"1px solid rgba(255,255,255,0.07)" }}><PackingList list={currentItinerary.packingList??[]} destination={currentItinerary.destination} /></div>
                  <div className="flex justify-center mt-5">
                    <button onClick={handleSave} className="flex items-center gap-2 px-6 py-3 rounded-full font-semibold text-sm text-white" style={{ background:"linear-gradient(135deg,#f97316,#a855f7)",boxShadow:"0 4px 20px rgba(249,115,22,0.3)" }}><Save className="w-4 h-4" />Salva e condividi</button>
                  </div>
                </div>
              ):<div className="h-full flex items-center justify-center text-sm" style={{ color:"rgba(255,255,255,0.35)" }}>Pianifica un viaggio per vedere l'itinerario</div>}
            </div>
          </TabsContent>
          <TabsContent value="map" className="flex-1 min-h-0 mt-2">
            <div className="h-full">{currentItinerary?<TripMap itinerary={currentItinerary} />:<div className="h-full flex items-center justify-center text-sm" style={{ color:"rgba(255,255,255,0.35)" }}>In attesa dell'itinerario...</div>}</div>
          </TabsContent>
        </Tabs>
      </div>

      <AuthModal open={authOpen} onClose={()=>setAuthOpen(false)} />
    </Layout>
  );
}