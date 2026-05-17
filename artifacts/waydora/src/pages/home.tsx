import { useEffect, useRef, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  useListSuggestions, useChat, useSaveItinerary,
  type ChatMessage, type ItineraryData, type Suggestion,
} from "@/hooks/api";
import { useAuth } from "@/hooks/auth";
import { AuthModal } from "@/components/auth-modal";
import {
  Send, Loader2, Save, PlusCircle, Map, ChevronLeft, ChevronRight,
  Compass, BookMarked, Calendar, DollarSign, Cloud, Camera,
  Lightbulb, Menu, CheckSquare, LogOut, LogIn, User,
  Mic, MicOff, ImagePlus, X, Link,
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
  mediaType: string;
  data: string;
  preview: string;
  name: string;
};

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
  borderRadius: "16px",
  padding: "16px",
  marginTop: "8px",
} as React.CSSProperties;

const activeTab = {
  background: "rgba(255,255,255,0.10)",
  color: "#ffffff",
  border: "1px solid rgba(255,255,255,0.18)",
} as React.CSSProperties;

const inactiveTab = {
  background: "transparent",
  color: "rgba(255,255,255,0.38)",
  border: "1px solid transparent",
} as React.CSSProperties;

// ── Suggerimenti rapidi ───────────────────────────────────────────────────
const QUICK_SUGGESTIONS = [
  { label: "➕ Aggiungi un giorno",  prompt: "Aggiungi un altro giorno all'itinerario" },
  { label: "🍽️ Più ristoranti",      prompt: "Suggeriscimi altri ristoranti locali da non perdere" },
  { label: "📸 Spot Instagram",      prompt: "Dammi i migliori spot per foto Instagram in questa destinazione" },
  { label: "💰 Versione economica",  prompt: "Rendi l'itinerario più economico mantenendo le esperienze migliori" },
  { label: "🏨 Consigli hotel",      prompt: "Dove mi consigli di dormire? Sia lusso che budget" },
  { label: "🚗 Come spostarsi",      prompt: "Come mi sposto tra le varie tappe? Mezzi pubblici o noleggio auto?" },
];

// ── Tool tabs ─────────────────────────────────────────────────────────────
const MAP_TOOLS = [
  { id: "map",      label: "Mappa",      icon: Map },
  { id: "calendar", label: "Calendario", icon: Calendar },
  { id: "expenses", label: "Spese",      icon: DollarSign },
  { id: "weather",  label: "Meteo",      icon: Cloud },
  { id: "ideas",    label: "Idee",       icon: Lightbulb },
  { id: "bagaglio", label: "Bagaglio",   icon: CheckSquare },
  { id: "media",    label: "Media",      icon: Camera },
];

function MapToolbar({ active, onChange }: { active: string; onChange: (id: string) => void }) {
  return (
    <div className="flex items-center gap-1 px-3 py-2 overflow-x-auto [&::-webkit-scrollbar]:hidden shrink-0"
      style={{ borderBottom: "1px solid rgba(255,255,255,0.07)", ...glassDark }}>
      {MAP_TOOLS.map((t) => {
        const Icon = t.icon;
        const isActive = active === t.id;
        return (
          <button key={t.id} onClick={() => onChange(t.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all duration-200"
            style={isActive ? activeTab : inactiveTab}>
            <Icon className="w-3.5 h-3.5" />{t.label}
          </button>
        );
      })}
    </div>
  );
}

function ToolPlaceholder({ emoji, title, desc }: { emoji: string; title: string; desc: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6">
      <div style={{ fontSize: "2.8rem" }}>{emoji}</div>
      <div style={{ fontSize: "15px", fontWeight: 700, color: "#fff" }}>{title}</div>
      <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.4)", maxWidth: "240px" }}>{desc}</div>
      <div className="text-xs font-semibold px-3 py-1 rounded-full"
        style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.15)" }}>
        Disponibile prossimamente
      </div>
    </div>
  );
}

function ToolContent({ tool, itinerary }: { tool: string; itinerary?: ItineraryData }) {
  if (tool === "map") return null;
  if (tool === "bagaglio") return <PackingList list={itinerary?.packingList ?? []} />;
  const placeholders: Record<string, { emoji: string; title: string; desc: string }> = {
    calendar: { emoji: "📅", title: "Calendario viaggio",  desc: "Organizza date e appuntamenti" },
    expenses: { emoji: "💰", title: "Gestione spese",       desc: "Tieni traccia del budget" },
    weather:  { emoji: "🌤", title: "Meteo in tempo reale", desc: "Previsioni per ogni tappa" },
    ideas:    { emoji: "💡", title: "Le tue idee",          desc: "Salva ispirazioni per il viaggio" },
    media:    { emoji: "📸", title: "Foto e media",         desc: "Carica e condividi foto" },
  };
  const p = placeholders[tool];
  return p ? <ToolPlaceholder {...p} /> : null;
}

// ── Sidebar ───────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { id: "new",     label: "Nuova chat",        icon: PlusCircle },
  { id: "saved",   label: "Viaggi salvati",    icon: BookMarked },
  { id: "inspire", label: "Lasciati ispirare", icon: Compass },
];

function Sidebar({ open, onClose, onNewTrip, suggestions, onSuggestionClick, onLoginClick }: {
  open: boolean; onClose: () => void; onNewTrip: () => void;
  suggestions?: Suggestion[]; onSuggestionClick: (prompt: string) => void;
  onLoginClick: () => void;
}) {
  const [active, setActive] = useState("new");
  const { user, logout } = useAuth();

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          initial={{ width: 0, opacity: 0 }} animate={{ width: 248, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }} transition={{ duration: 0.22 }}
          className="flex flex-col min-h-0 overflow-hidden shrink-0"
          style={{ borderRight: "1px solid rgba(255,255,255,0.07)", ...glassDark }}>

          <div className="px-4 py-4 flex items-center justify-between shrink-0"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
            <Logo variant="header" />
            <button onClick={onClose} style={{ color: "rgba(255,255,255,0.35)" }}>
              <ChevronLeft className="w-5 h-5" />
            </button>
          </div>

          <div className="px-2 py-3 space-y-1 shrink-0">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = active === item.id;
              return (
                <button key={item.id}
                  onClick={() => { setActive(item.id); if (item.id === "new") onNewTrip(); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
                  style={isActive ? activeTab : inactiveTab}>
                  <Icon className="w-4 h-4 shrink-0" />{item.label}
                </button>
              );
            })}
          </div>

          {active === "inspire" && suggestions && suggestions.length > 0 && (
            <ScrollArea className="flex-1 px-2 py-2">
              <div className="space-y-2">
                {suggestions.map((s) => (
                  <button key={s.slug} onClick={() => onSuggestionClick(s.prompt)}
                    className="w-full text-left px-3 py-2.5 rounded-xl transition-all"
                    style={{ border: "1px solid rgba(255,255,255,0.06)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                    <div className="flex items-center gap-2">
                      <span style={{ fontSize: "1.1rem" }}>{s.heroEmoji}</span>
                      <div>
                        <div className="text-sm font-semibold text-white">{s.title}</div>
                        <div className="text-xs line-clamp-1" style={{ color: "rgba(255,255,255,0.4)" }}>{s.tagline}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          )}

          {active === "saved" && (
            <div className="flex-1 flex flex-col items-center justify-center p-4 text-center gap-2">
              <BookMarked style={{ width: "28px", height: "28px", color: "rgba(255,255,255,0.25)" }} />
              <p className="text-sm font-medium text-white">Viaggi salvati</p>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
                {user ? "I tuoi itinerari salvati appariranno qui" : "Accedi per vedere i tuoi viaggi"}
              </p>
              {!user && (
                <button onClick={onLoginClick} style={{
                  marginTop: "8px", padding: "8px 16px", borderRadius: "9999px",
                  background: "linear-gradient(135deg,#f97316,#a855f7)",
                  color: "#fff", fontSize: "12px", fontWeight: 700, border: "none", cursor: "pointer",
                }}>Accedi</button>
              )}
            </div>
          )}

          <div className="flex-1" />

          <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", padding: "12px" }}>
            {user ? (
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                {user.avatar
                  ? <img src={user.avatar} alt={user.name} style={{ width: "34px", height: "34px", borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                  : <div style={{ width: "34px", height: "34px", borderRadius: "50%", flexShrink: 0, background: "linear-gradient(135deg,#f97316,#a855f7)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: "13px" }}>
                      {user.name?.[0]?.toUpperCase() ?? "W"}
                    </div>
                }
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.name}</div>
                  <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.email}</div>
                </div>
                <button onClick={logout} title="Esci"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", padding: "6px", cursor: "pointer", color: "rgba(255,255,255,0.45)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = "#fff"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(255,255,255,0.45)"; }}>
                  <LogOut style={{ width: "14px", height: "14px" }} />
                </button>
              </div>
            ) : (
              <button onClick={onLoginClick}
                style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", padding: "10px", borderRadius: "12px", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.7)", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.12)"; e.currentTarget.style.color = "#fff"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.07)"; e.currentTarget.style.color = "rgba(255,255,255,0.7)"; }}>
                <LogIn style={{ width: "15px", height: "15px" }} />
                Accedi o Registrati
              </button>
            )}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

// ── Bubbles ───────────────────────────────────────────────────────────────
function UserBubble({ text, mediaPreview }: { text: string; mediaPreview?: string }) {
  return (
    <div className="flex justify-end">
      <div style={{ maxWidth: "80%", display: "flex", flexDirection: "column", gap: "8px", alignItems: "flex-end" }}>
        {mediaPreview && (
          <div style={{ borderRadius: "12px", overflow: "hidden", maxWidth: "200px" }}>
            <img src={mediaPreview} alt="allegato" style={{ width: "100%", objectFit: "cover", display: "block" }} />
          </div>
        )}
        {text && (
          <div style={{
            padding: "10px 14px", borderRadius: "18px 18px 4px 18px",
            background: "linear-gradient(135deg,#f97316,#a855f7)",
            color: "#fff", fontSize: "14px", lineHeight: 1.55,
            boxShadow: "0 4px 16px rgba(249,115,22,0.2)",
          }}>{text}</div>
        )}
      </div>
    </div>
  );
}

function AssistantBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-start">
      <div style={{
        maxWidth: "85%", padding: "10px 14px",
        borderRadius: "18px 18px 18px 4px",
        background: "rgba(32,22,52,0.98)",
        border: "1px solid rgba(255,255,255,0.11)",
        color: "rgba(255,255,255,0.88)", fontSize: "14px", lineHeight: 1.65,
      }}>{text}</div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
      <div className="flex items-center gap-2 px-4 py-3 rounded-2xl"
        style={{ background: "rgba(32,22,52,0.98)", border: "1px solid rgba(255,255,255,0.1)" }}>
        {[0, 150, 300].map((d) => (
          <div key={d} className="w-2 h-2 rounded-full"
            style={{ background: "rgba(255,255,255,0.5)", animation: `wd-bounce 1.2s ease-in-out ${d}ms infinite` }} />
        ))}
        <span className="text-xs ml-1" style={{ color: "rgba(255,255,255,0.35)" }}>Waydora sta pianificando...</span>
      </div>
      <style>{`@keyframes wd-bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}`}</style>
    </motion.div>
  );
}

// ── Welcome message per chat vuota ────────────────────────────────────────
function WelcomeMessage({ userName }: { userName?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="flex flex-col items-center justify-center h-full gap-4 text-center px-6"
    >
      <div style={{ fontSize: "3rem" }}>✈️</div>
      <div>
        <h3 style={{ fontSize: "18px", fontWeight: 800, color: "#fff", marginBottom: "8px" }}>
          {userName ? `Ciao, ${userName.split(" ")[0]}! 👋` : "Ciao! 👋"}
        </h3>
        <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.5)", lineHeight: 1.6, maxWidth: "280px" }}>
          Sono Waydora, la tua assistente di viaggio AI. Dimmi dove vuoi andare e creo il tuo itinerario perfetto!
        </p>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", justifyContent: "center", marginTop: "8px" }}>
        {["🗺️ 3 giorni a Tokyo", "🏖️ Settimana al mare", "🏛️ Weekend a Roma"].map((s) => (
          <span key={s} style={{
            fontSize: "12px", fontWeight: 600, padding: "6px 12px", borderRadius: "9999px",
            background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)",
            color: "rgba(255,255,255,0.6)",
          }}>{s}</span>
        ))}
      </div>
    </motion.div>
  );
}

// ── Input avanzato ────────────────────────────────────────────────────────
function AdvancedChatInput({ value, onChange, onSubmit, isPending, onMediaAttach, mediaContent, onMediaRemove, placeholder }: {
  value: string; onChange: (v: string) => void; onSubmit: () => void;
  isPending: boolean; onMediaAttach: (media: MediaContent) => void;
  mediaContent: MediaContent | null; onMediaRemove: () => void;
  placeholder?: string;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recognition, setRecognition] = useState<any>(null);
  const active = (value.trim() || mediaContent) && !isPending;

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
    const ta = e.target;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");
    if (!isImage && !isVideo) return;
    if (file.size > 20 * 1024 * 1024) { alert("File troppo grande. Max 20MB."); return; }
    const preview = URL.createObjectURL(file);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = (ev.target?.result as string)?.split(",")[1];
      if (!base64) return;
      onMediaAttach({ mediaType: isImage ? file.type : "image/jpeg", data: base64, preview, name: file.name });
    };
    if (isImage) {
      reader.readAsDataURL(file);
    } else {
      const video = document.createElement("video");
      video.src = preview;
      video.currentTime = 1;
      video.onloadeddata = () => {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext("2d")?.drawImage(video, 0, 0);
        canvas.toBlob((blob) => {
          if (!blob) return;
          const fr = new FileReader();
          fr.onload = (ev) => {
            const base64 = (ev.target?.result as string)?.split(",")[1];
            if (base64) onMediaAttach({ mediaType: "image/jpeg", data: base64, preview, name: file.name });
          };
          fr.readAsDataURL(blob);
        }, "image/jpeg", 0.85);
      };
    }
    e.target.value = "";
  };

  const toggleRecording = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { alert("Il tuo browser non supporta la registrazione vocale. Usa Chrome."); return; }
    if (isRecording && recognition) { recognition.stop(); setIsRecording(false); return; }
    const rec = new SR();
    rec.lang = "it-IT";
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (event: any) => {
      let t = "";
      for (let i = 0; i < event.results.length; i++) t += event.results[i][0].transcript;
      onChange(t);
    };
    rec.onend = () => setIsRecording(false);
    rec.onerror = () => setIsRecording(false);
    rec.start();
    setRecognition(rec);
    setIsRecording(true);
  };

  const hasTikTokLink = /tiktok\.com/i.test(value);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {mediaContent && (
        <div style={{ position: "relative", display: "inline-block", alignSelf: "flex-start" }}>
          <img src={mediaContent.preview} alt="allegato"
            style={{ height: "80px", borderRadius: "10px", objectFit: "cover", border: "1px solid rgba(255,255,255,0.15)" }} />
          <button onClick={onMediaRemove}
            style={{ position: "absolute", top: "-6px", right: "-6px", width: "20px", height: "20px", borderRadius: "50%", background: "rgba(0,0,0,0.8)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0 }}>
            <X style={{ width: "11px", height: "11px" }} />
          </button>
        </div>
      )}

      {hasTikTokLink && (
        <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "6px 10px", borderRadius: "8px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
          <Link style={{ width: "12px", height: "12px", color: "#a78bfa" }} />
          <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.6)" }}>Link TikTok rilevato — genererò un itinerario ispirato al video 🎬</span>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "flex-end", gap: "6px", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "20px", padding: "8px 8px 8px 14px" }}>
        <textarea
          value={value}
          onChange={handleChange}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (active) onSubmit(); } }}
          placeholder={isRecording ? "🎤 In ascolto..." : placeholder}
          rows={1}
          className="flex-1 bg-transparent resize-none outline-none border-none text-sm leading-relaxed"
          style={{ minHeight: "32px", maxHeight: "120px", paddingTop: "6px", paddingBottom: "6px", color: isRecording ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.9)", caretColor: "#fff" }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: "4px", flexShrink: 0 }}>
          <input ref={fileInputRef} type="file" accept="image/*,video/*" style={{ display: "none" }} onChange={handleFileChange} />
          <button onClick={() => fileInputRef.current?.click()} title="Allega foto o video"
            style={{ width: "32px", height: "32px", borderRadius: "50%", border: "none", background: mediaContent ? "rgba(167,139,250,0.2)" : "rgba(255,255,255,0.07)", color: mediaContent ? "#a78bfa" : "rgba(255,255,255,0.4)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <ImagePlus style={{ width: "15px", height: "15px" }} />
          </button>
          <button onClick={toggleRecording} title={isRecording ? "Stop" : "Registra voce"}
            style={{ width: "32px", height: "32px", borderRadius: "50%", border: "none", background: isRecording ? "rgba(239,68,68,0.25)" : "rgba(255,255,255,0.07)", color: isRecording ? "#f87171" : "rgba(255,255,255,0.4)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            {isRecording ? <MicOff style={{ width: "14px", height: "14px" }} /> : <Mic style={{ width: "14px", height: "14px" }} />}
          </button>
          <button onClick={onSubmit} disabled={!active}
            style={{ width: "34px", height: "34px", borderRadius: "50%", border: "none", background: active ? "linear-gradient(135deg,#f97316,#a855f7)" : "rgba(255,255,255,0.06)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: active ? "pointer" : "not-allowed", transform: active ? "scale(1)" : "scale(0.9)", transition: "all 0.15s" }}>
            {isPending
              ? <Loader2 style={{ width: "14px", height: "14px", animation: "spin 0.8s linear infinite" }} />
              : <Send style={{ width: "13px", height: "13px" }} />}
          </button>
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ── Suggerimenti rapidi ───────────────────────────────────────────────────
function QuickSuggestions({ onSelect, visible }: { onSelect: (prompt: string) => void; visible: boolean }) {
  if (!visible) return null;
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      style={{ display: "flex", flexWrap: "wrap", gap: "6px", padding: "8px 0 0" }}>
      {QUICK_SUGGESTIONS.map((s) => (
        <button key={s.label} onClick={() => onSelect(s.prompt)}
          style={{ fontSize: "12px", fontWeight: 600, padding: "5px 12px", borderRadius: "9999px", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.7)", cursor: "pointer", transition: "all 0.15s", whiteSpace: "nowrap" }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.13)"; e.currentTarget.style.color = "#fff"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.07)"; e.currentTarget.style.color = "rgba(255,255,255,0.7)"; }}>
          {s.label}
        </button>
      ))}
    </motion.div>
  );
}

// ── Turno chat ────────────────────────────────────────────────────────────
function ChatTurnView({ turn }: { turn: ChatTurn }) {
  return (
    <div className="space-y-3">
      <UserBubble text={turn.userMessage} mediaPreview={turn.mediaPreview} />
      {turn.assistantReply === "" ? (
        <TypingIndicator />
      ) : (
        <>
          <AssistantBubble text={turn.assistantReply} />
          {turn.itinerary && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
              style={itineraryCard}>
              <ItineraryResults itinerary={turn.itinerary} />
            </motion.div>
          )}
        </>
      )}
    </div>
  );
}

// ── Navbar landing ────────────────────────────────────────────────────────
function LandingNav({ onLoginClick, onEnterChat }: { onLoginClick: () => void; onEnterChat: () => void }) {
  const { user, logout } = useAuth();
  return (
    <div style={{ position: "absolute", top: 0, right: 0, zIndex: 30, padding: "20px 24px", display: "flex", alignItems: "center", gap: "12px" }}>
      {user ? (
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {/* Nome cliccabile → va alla chat */}
          <button
            onClick={onEnterChat}
            style={{
              display: "flex", alignItems: "center", gap: "8px",
              background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.22)",
              backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
              borderRadius: "9999px", padding: "7px 14px 7px 8px",
              color: "#fff", fontSize: "13px", fontWeight: 600, cursor: "pointer",
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.2)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.12)"; }}
          >
            {user.avatar
              ? <img src={user.avatar} alt={user.name} style={{ width: "24px", height: "24px", borderRadius: "50%", objectFit: "cover" }} />
              : <div style={{ width: "24px", height: "24px", borderRadius: "50%", background: "linear-gradient(135deg,#f97316,#a855f7)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: "11px" }}>
                  {user.name?.[0]?.toUpperCase() ?? "W"}
                </div>
            }
            {user.name?.split(" ")[0]}
          </button>
          <button onClick={logout}
            style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "9999px", padding: "7px 14px", color: "rgba(255,255,255,0.6)", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>
            Esci
          </button>
        </div>
      ) : (
        <button onClick={onLoginClick}
          style={{ display: "flex", alignItems: "center", gap: "6px", background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.22)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", borderRadius: "9999px", padding: "8px 18px", color: "#fff", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.2)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.12)"; }}>
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
  const [activeTool,       setActiveTool]       = useState("map");
  const [authOpen,         setAuthOpen]         = useState(false);
  // forceChat = true quando l'utente clicca il suo nome dalla landing
  const [forceChat,        setForceChat]        = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const { data: suggestions } = useListSuggestions();
  const chatMutation = useChat();
  const saveMutation = useSaveItinerary();

  useEffect(() => { document.title = "Waydora — Travel simple, everywhere!"; }, []);

  useEffect(() => {
    setTimeout(() => {
      chatScrollRef.current?.scrollTo({ top: chatScrollRef.current.scrollHeight, behavior: "smooth" });
    }, 80);
  }, [turns]);

  const handleSubmit = useCallback((overridePrompt?: string) => {
    const promptText = (overridePrompt ?? input).trim();
    if ((!promptText && !mediaContent) || chatMutation.isPending) return;
    if (!overridePrompt) setInput("");

    // Se era in forceChat (chat vuota) e ora manda un messaggio, rimane in chat
    setForceChat(true);

    const turnId = Date.now();
    const mediaPreview = mediaContent?.preview;

    setTurns(prev => [...prev, {
      id: turnId,
      userMessage: promptText || "📎 Media allegato",
      assistantReply: "",
      mediaPreview,
    }]);

    const newApiMessages: ChatMessage[] = [...apiMessages, { role: "user", content: promptText || "Analizza questo contenuto e suggerisci un itinerario" }];
    setApiMessages(newApiMessages);

    const mediaForBackend = mediaContent ? { mediaType: mediaContent.mediaType, data: mediaContent.data } : undefined;
    setMediaContent(null);

    chatMutation.mutate(
      { data: { messages: newApiMessages, existingItinerary: currentItinerary, mediaContent: mediaForBackend } as any },
      {
        onSuccess: (data) => {
          setApiMessages(prev => [...prev, { role: "assistant", content: data.reply }]);
          if (data.itinerary) setCurrentItinerary(data.itinerary);
          setTurns(prev => prev.map(t =>
            t.id === turnId ? { ...t, assistantReply: data.reply, itinerary: data.itinerary ?? undefined } : t
          ));
        },
        onError: () => {
          setTurns(prev => prev.filter(t => t.id !== turnId));
          setApiMessages(prev => prev.slice(0, -1));
          toast({ title: "Qualcosa è andato storto", description: "Riprova.", variant: "destructive" });
        },
      }
    );
  }, [input, mediaContent, apiMessages, currentItinerary, chatMutation, toast]);

  const handleSave = () => {
    if (!currentItinerary || saveMutation.isPending) return;
    saveMutation.mutate(
      { data: { itinerary: currentItinerary } },
      {
        onSuccess: (saved) => { toast({ title: "Itinerario salvato!" }); setLocation(`/trip/${saved.shareSlug}`); },
        onError: () => toast({ title: "Errore di salvataggio", variant: "destructive" }),
      }
    );
  };

  const handleNewTrip = () => {
    setTurns([]); setApiMessages([]); setCurrentItinerary(undefined);
    setInput(""); setMediaContent(null); setForceChat(false);
  };

  const handleEnterChat = () => {
    // Clicca nome utente dalla landing → apre chat vuota
    setForceChat(true);
  };

  const hasItinerary = turns.some(t => t.itinerary);
  // Mostra landing solo se non ci sono turni E non è stato forzato l'accesso alla chat
  const isLanding = turns.length === 0 && !chatMutation.isPending && !forceChat;

  // ── LANDING ──────────────────────────────────────────────────────────────
  if (isLanding) {
    return (
      <Layout>
        <div className="flex-1 overflow-y-auto" style={{ background: "#0a0a12", position: "relative" }}>
          <LandingNav onLoginClick={() => setAuthOpen(true)} onEnterChat={handleEnterChat} />
          <HeroLanding onSubmit={handleSubmit} isPending={chatMutation.isPending} />
          <HowItWorks />
          <TripCounter />
          <Partners />
          <Reviews />
          <Faq />
          <SiteFooter />
        </div>
        <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
      </Layout>
    );
  }

  // ── APP ───────────────────────────────────────────────────────────────────
  return (
    <Layout>
      <div className="fixed inset-0 -z-10" style={{ background: "#0a0a12" }}>
        <div style={{ position: "absolute", top: "-10%", right: "-5%", width: "50vw", height: "50vw", borderRadius: "50%", background: "radial-gradient(circle,rgba(249,115,22,0.15) 0%,transparent 65%)", filter: "blur(70px)" }} />
        <div style={{ position: "absolute", bottom: "5%", left: "-5%", width: "45vw", height: "45vw", borderRadius: "50%", background: "radial-gradient(circle,rgba(168,85,247,0.15) 0%,transparent 65%)", filter: "blur(70px)" }} />
      </div>

      {/* ── DESKTOP ── */}
      <div className="flex-1 min-h-0 hidden lg:flex">
        {!sidebarOpen && (
          <button onClick={() => setSidebarOpen(true)}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-20 p-2 rounded-r-xl"
            style={{ background: "rgba(10,10,18,0.9)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)" }}>
            <ChevronRight className="w-4 h-4" />
          </button>
        )}

        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} onNewTrip={handleNewTrip}
          suggestions={suggestions} onSuggestionClick={(p) => handleSubmit(p)} onLoginClick={() => setAuthOpen(true)} />

        {/* CHAT */}
        <section className="flex flex-col min-h-0 shrink-0" style={{ width: "38vw", borderRight: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="px-4 py-3 flex items-center justify-between shrink-0"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.07)", ...glassDark }}>
            <div className="flex items-center gap-2">
              {!sidebarOpen && (
                <button onClick={() => setSidebarOpen(true)} style={{ color: "rgba(255,255,255,0.4)", marginRight: "4px" }}>
                  <Menu className="w-4 h-4" />
                </button>
              )}
              <div className="w-2 h-2 rounded-full" style={{ background: "linear-gradient(135deg,#f97316,#a855f7)" }} />
              <span className="text-sm font-bold text-white">Waydora</span>
            </div>
            <div className="flex items-center gap-2">
              {currentItinerary && (
                <button onClick={handleSave} disabled={saveMutation.isPending}
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full"
                  style={{ background: "rgba(255,255,255,0.09)", color: "#fff", border: "1px solid rgba(255,255,255,0.18)" }}>
                  {saveMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                  Salva
                </button>
              )}
              <button onClick={handleNewTrip}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full"
                style={{ color: "rgba(255,255,255,0.45)", border: "1px solid rgba(255,255,255,0.1)" }}
                onMouseEnter={(e) => { e.currentTarget.style.color = "#fff"; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(255,255,255,0.45)"; }}>
                <PlusCircle className="w-3.5 h-3.5" />Nuovo
              </button>
            </div>
          </div>

          {/* Area messaggi */}
          <div ref={chatScrollRef}
            className="flex-1 overflow-y-auto p-4 space-y-6 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded-full"
            style={{ scrollbarColor: "rgba(255,255,255,0.15) transparent" }}>
            {turns.length === 0
              ? <WelcomeMessage userName={user?.name} />
              : turns.map((turn) => (<ChatTurnView key={turn.id} turn={turn} />))
            }
          </div>

          <div className="px-4 py-3 shrink-0" style={{ borderTop: "1px solid rgba(255,255,255,0.07)", ...glassDark }}>
            <QuickSuggestions onSelect={(p) => handleSubmit(p)} visible={hasItinerary && !chatMutation.isPending} />
            <div style={{ marginTop: hasItinerary ? "8px" : "0" }}>
              <AdvancedChatInput value={input} onChange={setInput} onSubmit={() => handleSubmit()}
                isPending={chatMutation.isPending} onMediaAttach={setMediaContent}
                mediaContent={mediaContent} onMediaRemove={() => setMediaContent(null)}
                placeholder="Dimmi dove vuoi andare..." />
            </div>
            <p className="text-center text-xs mt-2" style={{ color: "rgba(255,255,255,0.15)" }}>
              Shift+Invio per andare a capo
            </p>
          </div>
        </section>

        {/* MAPPA */}
        <aside className="flex flex-col min-h-0 flex-1">
          <MapToolbar active={activeTool} onChange={setActiveTool} />
          <div className="flex-1 min-h-0">
            {activeTool === "map"
              ? currentItinerary
                ? <TripMap itinerary={currentItinerary} />
                : <div className="h-full flex flex-col items-center justify-center gap-3" style={{ color: "rgba(255,255,255,0.3)" }}>
                    <Map style={{ width: "36px", height: "36px", opacity: 0.3 }} />
                    <span className="text-sm">La mappa apparirà qui</span>
                  </div>
              : <ToolContent tool={activeTool} itinerary={currentItinerary} />
            }
          </div>
        </aside>
      </div>

      {/* ── MOBILE ── */}
      <div className="flex-1 min-h-0 lg:hidden flex flex-col">
        <Tabs defaultValue="chat" className="flex-1 flex flex-col min-h-0">
          <div className="px-3 pt-3 shrink-0">
            <TabsList className="w-full grid grid-cols-3 rounded-xl p-1"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.09)" }}>
              {[{ value: "chat", label: "Chat" }, { value: "trip", label: "Itinerario" }, { value: "map", label: "Mappa" }].map((t) => (
                <TabsTrigger key={t.value} value={t.value}
                  className="text-xs font-semibold rounded-lg data-[state=active]:bg-[rgba(255,255,255,0.12)] data-[state=active]:text-white text-[rgba(255,255,255,0.4)]">
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <TabsContent value="chat" className="flex-1 min-h-0 flex flex-col mt-2">
            <div className="flex-1 overflow-y-auto px-3 py-2 space-y-5">
              {turns.length === 0
                ? <WelcomeMessage userName={user?.name} />
                : turns.map((turn) => (<ChatTurnView key={turn.id} turn={turn} />))
              }
            </div>
            <div className="px-3 py-3 shrink-0" style={{ borderTop: "1px solid rgba(255,255,255,0.07)", ...glassDark }}>
              <QuickSuggestions onSelect={(p) => handleSubmit(p)} visible={hasItinerary && !chatMutation.isPending} />
              <div style={{ marginTop: hasItinerary ? "8px" : "0" }}>
                <AdvancedChatInput value={input} onChange={setInput} onSubmit={() => handleSubmit()}
                  isPending={chatMutation.isPending} onMediaAttach={setMediaContent}
                  mediaContent={mediaContent} onMediaRemove={() => setMediaContent(null)}
                  placeholder="Dimmi dove vuoi andare..." />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="trip" className="flex-1 min-h-0 mt-2">
            <div className="h-full overflow-y-auto px-3 pb-8">
              {currentItinerary
                ? <div style={{ background: "rgba(22,14,38,0.98)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: "16px", padding: "14px" }}>
                    <ItineraryResults itinerary={currentItinerary} />
                    <div className="mt-5 pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
                      <PackingList list={currentItinerary.packingList ?? []} />
                    </div>
                    <div className="flex justify-center mt-5">
                      <button onClick={handleSave} disabled={saveMutation.isPending}
                        className="flex items-center gap-2 px-6 py-3 rounded-full font-semibold text-sm text-white"
                        style={{ background: "linear-gradient(135deg,#f97316,#a855f7)", boxShadow: "0 4px 20px rgba(249,115,22,0.3)" }}>
                        {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Salva e condividi
                      </button>
                    </div>
                  </div>
                : <div className="h-full flex items-center justify-center text-sm" style={{ color: "rgba(255,255,255,0.35)" }}>Pianifica un viaggio per vedere l'itinerario</div>
              }
            </div>
          </TabsContent>

          <TabsContent value="map" className="flex-1 min-h-0 mt-2">
            <div className="h-full">
              {currentItinerary
                ? <TripMap itinerary={currentItinerary} />
                : <div className="h-full flex items-center justify-center text-sm" style={{ color: "rgba(255,255,255,0.35)" }}>In attesa dell'itinerario...</div>
              }
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </Layout>
  );
}