import { useEffect, useRef, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  useListSuggestions,
  useChat,
  useSaveItinerary,
  type ChatMessage,
  type ItineraryData,
  type Suggestion,
} from "@/hooks/api";
import {
  Send, Loader2, Save, PlusCircle,
  Map, ChevronLeft, ChevronRight,
  Compass, BookMarked, Users, Calendar, DollarSign,
  Cloud, Camera, Lightbulb, Menu, CheckSquare,
} from "lucide-react";
import { Layout, Logo } from "@/components/layout";
import { ItineraryResults, PackingList } from "@/components/itinerary-results";
import { TripMap } from "@/components/trip-map";
import {
  HowItWorks, TripCounter, Partners, Reviews, Faq, SiteFooter,
  HeroLanding,
} from "@/components/landing-sections";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
 
// ── Stili glass condivisi ─────────────────────────────────────────────────
const glass = {
  background: "rgba(255,255,255,0.06)",
  backdropFilter: "blur(20px) saturate(140%)",
  WebkitBackdropFilter: "blur(20px) saturate(140%)",
  border: "1px solid rgba(255,255,255,0.10)",
} as React.CSSProperties;
 
const glassDark = {
  background: "rgba(10,10,18,0.85)",
  backdropFilter: "blur(24px) saturate(160%)",
  WebkitBackdropFilter: "blur(24px) saturate(160%)",
  border: "1px solid rgba(255,255,255,0.08)",
} as React.CSSProperties;
 
// ── Tool tabs sopra la mappa ──────────────────────────────────────────────
const MAP_TOOLS = [
  { id: "map",      label: "Mappa",     icon: Map },
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
            style={{
              background: isActive ? "rgba(167,139,250,0.18)" : "transparent",
              color: isActive ? "#a78bfa" : "rgba(255,255,255,0.45)",
              border: isActive ? "1px solid rgba(167,139,250,0.3)" : "1px solid transparent",
            }}>
            <Icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
 
function ToolPlaceholder({ emoji, title, desc }: { emoji: string; title: string; desc: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6">
      <div style={{ fontSize: "3rem" }}>{emoji}</div>
      <div className="font-bold text-white" style={{ fontSize: "15px" }}>{title}</div>
      <div className="text-sm" style={{ color: "rgba(255,255,255,0.4)", maxWidth: "240px" }}>{desc}</div>
      <div className="text-xs font-semibold px-3 py-1 rounded-full"
        style={{ background: "rgba(167,139,250,0.12)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.25)" }}>
        Disponibile prossimamente
      </div>
    </div>
  );
}
 
function ToolContent({ tool, itinerary }: { tool: string; itinerary?: ItineraryData }) {
  if (tool === "map") return null;
  if (tool === "bagaglio") return <PackingList list={itinerary?.packingList ?? []} />;
 
  const placeholders: Record<string, { emoji: string; title: string; desc: string }> = {
    calendar: { emoji: "📅", title: "Calendario viaggio",  desc: "Organizza le date e gli appuntamenti del tuo itinerario" },
    expenses: { emoji: "💰", title: "Gestione spese",       desc: "Tieni traccia del budget e dividi le spese con il gruppo" },
    weather:  { emoji: "🌤", title: "Meteo in tempo reale", desc: "Previsioni aggiornate per ogni tappa del viaggio" },
    ideas:    { emoji: "💡", title: "Le tue idee",          desc: "Salva ispirazioni, note e idee per il viaggio" },
    media:    { emoji: "📸", title: "Foto e media",         desc: "Carica e condividi foto e video con il gruppo" },
  };
 
  const p = placeholders[tool];
  if (!p) return null;
  return <ToolPlaceholder {...p} />;
}
 
// ── Sidebar sinistra ──────────────────────────────────────────────────────
const NAV_ITEMS = [
  { id: "new",     label: "Nuova chat",        icon: PlusCircle },
  { id: "saved",   label: "Viaggi salvati",     icon: BookMarked },
  { id: "inspire", label: "Lasciati ispirare",  icon: Compass },
  { id: "group",   label: "Gruppi vacanza",     icon: Users },
];
 
function Sidebar({ open, onClose, onNewTrip, suggestions, onSuggestionClick }: {
  open: boolean; onClose: () => void; onNewTrip: () => void;
  suggestions?: Suggestion[]; onSuggestionClick: (prompt: string) => void;
}) {
  const [active, setActive] = useState("new");
 
  const handleNav = (id: string) => {
    setActive(id);
    if (id === "new") onNewTrip();
  };
 
  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 248, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ duration: 0.22 }}
          className="flex flex-col min-h-0 overflow-hidden shrink-0"
          style={{ borderRight: "1px solid rgba(255,255,255,0.07)", ...glassDark }}
        >
          {/* Header */}
          <div className="px-4 py-4 flex items-center justify-between shrink-0"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
            <Logo variant="header" />
            <button onClick={onClose}
              className="transition-colors"
              style={{ color: "rgba(255,255,255,0.35)" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#fff")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.35)")}>
              <ChevronLeft className="w-5 h-5" />
            </button>
          </div>
 
          {/* Nav */}
          <div className="px-2 py-3 space-y-1 shrink-0">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = active === item.id;
              return (
                <button key={item.id} onClick={() => handleNav(item.id)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200"
                  style={{
                    background: isActive ? "rgba(167,139,250,0.15)" : "transparent",
                    color: isActive ? "#a78bfa" : "rgba(255,255,255,0.55)",
                    border: isActive ? "1px solid rgba(167,139,250,0.25)" : "1px solid transparent",
                  }}>
                  <Icon className="w-4 h-4 shrink-0" />
                  {item.label}
                </button>
              );
            })}
          </div>
 
          {/* Ispirazioni */}
          {active === "inspire" && suggestions && suggestions.length > 0 && (
            <ScrollArea className="flex-1 px-2 py-2">
              <div className="space-y-2">
                {suggestions.map((s) => (
                  <button key={s.slug} onClick={() => onSuggestionClick(s.prompt)}
                    className="w-full text-left px-3 py-2.5 rounded-xl transition-all duration-200"
                    style={{ border: "1px solid rgba(255,255,255,0.06)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                    <div className="flex items-center gap-2">
                      <span style={{ fontSize: "1.2rem" }}>{s.heroEmoji}</span>
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
 
          {/* Salvati placeholder */}
          {active === "saved" && (
            <div className="flex-1 flex flex-col items-center justify-center p-4 text-center gap-2">
              <BookMarked style={{ width: "28px", height: "28px", color: "rgba(167,139,250,0.4)" }} />
              <p className="text-sm font-medium text-white">Viaggi salvati</p>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>I tuoi itinerari salvati appariranno qui</p>
            </div>
          )}
 
          {/* Gruppi placeholder */}
          {active === "group" && (
            <div className="flex-1 flex flex-col items-center justify-center p-4 text-center gap-2">
              <Users style={{ width: "28px", height: "28px", color: "rgba(167,139,250,0.4)" }} />
              <p className="text-sm font-medium text-white">Gruppi vacanza</p>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>Crea e gestisci gruppi di viaggio con amici</p>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
                style={{ background: "rgba(167,139,250,0.12)", color: "#a78bfa" }}>Prossimamente</span>
            </div>
          )}
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
 
// ── Bubble messaggio chat ─────────────────────────────────────────────────
function ChatBubble({ message, index }: { message: ChatMessage; index: number }) {
  const isUser = message.role === "user";
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.2) }}
      className={cn("flex", isUser ? "justify-end" : "justify-start")}
    >
      <div
        className="max-w-[85%] text-sm leading-relaxed whitespace-pre-wrap"
        style={{
          padding: "10px 14px",
          borderRadius: isUser ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
          background: isUser
            ? "linear-gradient(135deg, #7c3aed, #a855f7)"
            : "rgba(255,255,255,0.08)",
          border: isUser ? "none" : "1px solid rgba(255,255,255,0.1)",
          color: isUser ? "#fff" : "rgba(255,255,255,0.85)",
          boxShadow: isUser ? "0 4px 16px rgba(124,58,237,0.3)" : "none",
        }}
      >
        {message.content}
      </div>
    </motion.div>
  );
}
 
// ── Indicatore di digitazione ─────────────────────────────────────────────
function TypingIndicator() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
      <div className="flex items-center gap-2 px-4 py-3 rounded-2xl"
        style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)" }}>
        {[0, 150, 300].map((d) => (
          <div key={d} className="w-2 h-2 rounded-full"
            style={{ background: "#a78bfa", animation: `bounce 1.2s ease-in-out ${d}ms infinite` }} />
        ))}
        <span className="text-xs ml-1" style={{ color: "rgba(255,255,255,0.4)" }}>Waydora sta pianificando...</span>
      </div>
      <style>{`@keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}`}</style>
    </motion.div>
  );
}
 
// ── Input chat stile iOS ──────────────────────────────────────────────────
function ChatInput({ value, onChange, onSubmit, isPending, placeholder = "Continua la conversazione..." }: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  isPending: boolean;
  placeholder?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const active = value.trim() && !isPending;
 
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
    const ta = e.target;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
  };
 
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSubmit(); }
  };
 
  return (
    <div className="flex items-center gap-2 px-3 py-2"
      style={{
        background: "rgba(255,255,255,0.09)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        border: "1px solid rgba(255,255,255,0.14)",
        borderRadius: "9999px",
        boxShadow: "0 2px 16px rgba(0,0,0,0.2)",
      }}>
      <textarea
        ref={ref}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={1}
        className="flex-1 bg-transparent resize-none outline-none border-none text-sm leading-relaxed"
        style={{
          minHeight: "32px", maxHeight: "120px",
          paddingLeft: "10px", paddingTop: "7px", paddingBottom: "7px",
          color: "rgba(255,255,255,0.9)",
          caretColor: "#a78bfa",
        }}
      />
      <button
        onClick={onSubmit}
        disabled={!active}
        className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full transition-all duration-200"
        style={{
          background: active ? "linear-gradient(135deg,#7c3aed,#a855f7)" : "rgba(255,255,255,0.08)",
          border: "none",
          cursor: active ? "pointer" : "not-allowed",
          transform: active ? "scale(1)" : "scale(0.92)",
          boxShadow: active ? "0 2px 12px rgba(124,58,237,0.4)" : "none",
        }}>
        {isPending
          ? <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
          : <Send style={{ width: "14px", height: "14px", color: active ? "#fff" : "rgba(255,255,255,0.3)" }} />}
      </button>
    </div>
  );
}
 
// ── Main ──────────────────────────────────────────────────────────────────
export default function Home() {
  const [messages,          setMessages]          = useState<ChatMessage[]>([]);
  const [input,             setInput]             = useState("");
  const [currentItinerary,  setCurrentItinerary]  = useState<ItineraryData | undefined>();
  const [sidebarOpen,       setSidebarOpen]       = useState(true);
  const [activeTool,        setActiveTool]        = useState("map");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const chatScrollRef = useRef<HTMLDivElement>(null);
 
  const { data: suggestions } = useListSuggestions();
  const chatMutation = useChat();
  const saveMutation = useSaveItinerary();
 
  useEffect(() => { document.title = "Waydora — Travel simple, everywhere!"; }, []);
 
  // Scroll automatico alla fine della chat
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTo({
        top: chatScrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages, chatMutation.isPending, currentItinerary]);
 
  const handleSubmit = useCallback((overridePrompt?: string) => {
    const promptText = overridePrompt ?? input;
    if (!promptText.trim() || chatMutation.isPending) return;
 
    const newMessages = [...messages, { role: "user" as const, content: promptText.trim() }];
    setMessages(newMessages);
    if (!overridePrompt) setInput("");
 
    chatMutation.mutate(
      { data: { messages: newMessages, existingItinerary: currentItinerary } },
      {
        onSuccess: (data) => {
          setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
          if (data.itinerary) setCurrentItinerary(data.itinerary);
        },
        onError: () => toast({
          title: "Qualcosa è andato storto",
          description: "Non sono riuscita a rispondere. Riprova.",
          variant: "destructive",
        }),
      }
    );
  }, [input, messages, currentItinerary, chatMutation, toast]);
 
  const handleSave = () => {
    if (!currentItinerary || saveMutation.isPending) return;
    saveMutation.mutate(
      { data: { itinerary: currentItinerary } },
      {
        onSuccess: (saved) => {
          toast({ title: "Itinerario salvato!" });
          setLocation(`/trip/${saved.shareSlug}`);
        },
        onError: () => toast({ title: "Errore di salvataggio", variant: "destructive" }),
      }
    );
  };
 
  const handleNewTrip = () => {
    setMessages([]);
    setCurrentItinerary(undefined);
    setInput("");
  };
 
  const isInitialState = messages.length === 0;
 
  // ── LANDING ──────────────────────────────────────────────────────────────
  if (isInitialState) {
    return (
      <Layout>
        <div className="flex-1 overflow-y-auto" style={{ background: "#0a0a12" }}>
          <HeroLanding onSubmit={handleSubmit} isPending={chatMutation.isPending} />
          <HowItWorks />
          <TripCounter />
          <Partners />
          <Reviews />
          <Faq />
          <SiteFooter />
        </div>
      </Layout>
    );
  }
 
  // ── APP (3 colonne desktop / tab mobile) ──────────────────────────────────
  return (
    <Layout>
      {/* Sfondo inferno anche nella pagina chat */}
      <div className="fixed inset-0 -z-10" style={{ background: "#0a0a12" }}>
        <div style={{ position: "absolute", top: "-10%", right: "-5%", width: "50vw", height: "50vw", borderRadius: "50%", background: "radial-gradient(circle,rgba(109,40,217,0.25) 0%,transparent 70%)", filter: "blur(70px)" }} />
        <div style={{ position: "absolute", bottom: "10%", left: "-5%", width: "45vw", height: "45vw", borderRadius: "50%", background: "radial-gradient(circle,rgba(67,56,202,0.2) 0%,transparent 70%)", filter: "blur(70px)" }} />
      </div>
 
      {/* ── DESKTOP ── */}
      <div className="flex-1 min-h-0 hidden lg:flex">
 
        {/* Toggle sidebar chiusa */}
        {!sidebarOpen && (
          <button onClick={() => setSidebarOpen(true)}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-20 p-2 rounded-r-xl transition-colors"
            style={{ background: "rgba(10,10,18,0.9)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)" }}>
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
 
        {/* Sidebar */}
        <Sidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          onNewTrip={handleNewTrip}
          suggestions={suggestions}
          onSuggestionClick={(prompt) => handleSubmit(prompt)}
        />
 
        {/* ── CHAT + ITINERARIO ── */}
        <section className="flex flex-col min-h-0 shrink-0" style={{ width: "36vw", borderRight: "1px solid rgba(255,255,255,0.07)" }}>
 
          {/* Header chat */}
          <div className="px-4 py-3 flex items-center justify-between shrink-0"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.07)", ...glassDark }}>
            <div className="flex items-center gap-2">
              {!sidebarOpen && (
                <button onClick={() => setSidebarOpen(true)}
                  style={{ color: "rgba(255,255,255,0.4)", marginRight: "4px" }}>
                  <Menu className="w-4 h-4" />
                </button>
              )}
              <div className="w-2 h-2 rounded-full" style={{ background: "#a78bfa", boxShadow: "0 0 6px rgba(167,139,250,0.6)" }} />
              <span className="text-sm font-bold text-white">Waydora</span>
            </div>
            <div className="flex items-center gap-2">
              {currentItinerary && (
                <button onClick={handleSave} disabled={saveMutation.isPending}
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full transition-all"
                  style={{ background: "rgba(167,139,250,0.15)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.3)" }}>
                  {saveMutation.isPending
                    ? <Loader2 className="w-3 h-3 animate-spin" />
                    : <Save className="w-3 h-3" />}
                  Salva
                </button>
              )}
              <button onClick={handleNewTrip}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full transition-all"
                style={{ color: "rgba(255,255,255,0.45)", border: "1px solid rgba(255,255,255,0.1)" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#fff")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.45)")}>
                <PlusCircle className="w-3.5 h-3.5" />
                Nuovo
              </button>
            </div>
          </div>
 
          {/* Scroll area messaggi */}
          <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-5 space-y-4 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:transparent [&::-webkit-scrollbar-thumb]:rounded-full"
            style={{ scrollbarColor: "rgba(167,139,250,0.3) transparent" }}>
 
            {messages.map((m, i) => (
              <div key={i}>
                <ChatBubble message={m} index={i} />
                {/* Itinerario inline dopo il messaggio assistant che lo ha generato */}
                {m.role === "assistant" && currentItinerary &&
                  i === messages.length - 1 && (
                    <motion.div
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.15 }}
                      className="mt-4"
                      style={{ ...glass, borderRadius: "16px", padding: "16px" }}>
                      <ItineraryResults itinerary={currentItinerary} />
                    </motion.div>
                  )}
              </div>
            ))}
 
            {chatMutation.isPending && <TypingIndicator />}
          </div>
 
          {/* Input chat */}
          <div className="px-4 py-3 shrink-0"
            style={{ borderTop: "1px solid rgba(255,255,255,0.07)", ...glassDark }}>
            <ChatInput
              value={input}
              onChange={setInput}
              onSubmit={() => handleSubmit()}
              isPending={chatMutation.isPending}
              placeholder="Aggiungi un giorno, cambia città, riduci budget..."
            />
            <p className="text-center text-xs mt-2" style={{ color: "rgba(255,255,255,0.2)" }}>
              Shift+Invio per andare a capo
            </p>
          </div>
        </section>
 
        {/* ── MAPPA + STRUMENTI ── */}
        <aside className="flex flex-col min-h-0 flex-1">
          <MapToolbar active={activeTool} onChange={setActiveTool} />
          <div className="flex-1 min-h-0">
            {activeTool === "map" ? (
              currentItinerary
                ? <TripMap itinerary={currentItinerary} />
                : (
                  <div className="h-full flex flex-col items-center justify-center gap-3"
                    style={{ color: "rgba(255,255,255,0.3)" }}>
                    <Map style={{ width: "36px", height: "36px", opacity: 0.3 }} />
                    <span className="text-sm">La mappa apparirà qui</span>
                  </div>
                )
            ) : (
              <ToolContent tool={activeTool} itinerary={currentItinerary} />
            )}
          </div>
        </aside>
      </div>
 
      {/* ── MOBILE ── */}
      <div className="flex-1 min-h-0 lg:hidden flex flex-col">
        <Tabs defaultValue="chat" className="flex-1 flex flex-col min-h-0">
 
          {/* Tab bar mobile */}
          <div className="px-3 pt-3 shrink-0">
            <TabsList className="w-full grid grid-cols-3 rounded-xl p-1"
              style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)" }}>
              {[
                { value: "chat",  label: "Chat" },
                { value: "trip",  label: "Itinerario" },
                { value: "map",   label: "Mappa" },
              ].map((t) => (
                <TabsTrigger key={t.value} value={t.value}
                  className="text-xs font-semibold rounded-lg transition-all data-[state=active]:bg-[rgba(167,139,250,0.2)] data-[state=active]:text-[#a78bfa] text-[rgba(255,255,255,0.45)]">
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
 
          {/* Chat mobile */}
          <TabsContent value="chat" className="flex-1 min-h-0 flex flex-col mt-2">
            <div className="flex-1 overflow-y-auto px-4 py-2 space-y-4">
              {messages.map((m, i) => (
                <div key={i}>
                  <ChatBubble message={m} index={i} />
                </div>
              ))}
              {chatMutation.isPending && <TypingIndicator />}
            </div>
            <div className="px-3 py-3 shrink-0"
              style={{ borderTop: "1px solid rgba(255,255,255,0.07)", ...glassDark }}>
              <ChatInput
                value={input}
                onChange={setInput}
                onSubmit={() => handleSubmit()}
                isPending={chatMutation.isPending}
                placeholder="Scrivi il tuo viaggio..."
              />
            </div>
          </TabsContent>
 
          {/* Itinerario mobile */}
          <TabsContent value="trip" className="flex-1 min-h-0 mt-2">
            <div className="h-full overflow-y-auto px-4 pb-8">
              {currentItinerary ? (
                <div style={{ ...glass, borderRadius: "16px", padding: "16px" }}>
                  <ItineraryResults itinerary={currentItinerary} />
                  {/* Bagaglio anche su mobile */}
                  <div className="mt-6 pt-5" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                    <PackingList list={currentItinerary.packingList ?? []} />
                  </div>
                  <div className="flex justify-center mt-6">
                    <button onClick={handleSave} disabled={saveMutation.isPending}
                      className="flex items-center gap-2 px-6 py-3 rounded-full font-semibold text-sm text-white transition-all"
                      style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)", boxShadow: "0 4px 20px rgba(124,58,237,0.4)" }}>
                      {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      Salva e condividi
                    </button>
                  </div>
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-sm"
                  style={{ color: "rgba(255,255,255,0.35)" }}>
                  Pianifica un viaggio per vedere l'itinerario
                </div>
              )}
            </div>
          </TabsContent>
 
          {/* Mappa mobile */}
          <TabsContent value="map" className="flex-1 min-h-0 mt-2">
            <div className="h-full">
              {currentItinerary
                ? <TripMap itinerary={currentItinerary} />
                : (
                  <div className="h-full flex items-center justify-center text-sm"
                    style={{ color: "rgba(255,255,255,0.35)" }}>
                    In attesa dell'itinerario...
                  </div>
                )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
 