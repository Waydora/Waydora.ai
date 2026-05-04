import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  useListSuggestions,
  useListTemplates,
  useChat,
  useSaveItinerary,
  type ChatMessage,
  type ItineraryData,
  type Suggestion,
  type TripTemplate,
} from "@/hooks/api";
import {
  Send, Loader2, Sparkles, Save, Heart, PlusCircle,
  MessageSquare, Map, ChevronLeft, ChevronRight,
  Compass, BookMarked, Users, Calendar, DollarSign,
  Cloud, Camera, Lightbulb, Menu, X
} from "lucide-react";
import { Layout, Logo } from "@/components/layout";
import { TravelBackdrop } from "@/components/travel-backdrop";
import { ItineraryResults, PackingList } from "@/components/itinerary-results";
import { TripMap } from "@/components/trip-map";
import { FilterBar, EMPTY_FILTERS, filtersToPromptPrefix, type TripFilters } from "@/components/filter-bar";
import { HowItWorks, TripCounter, Partners, Reviews, Faq, SiteFooter } from "@/components/landing-sections";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { pickPhoto } from "@/lib/photos";
import { cn } from "@/lib/utils";

// ── Tool tabs sopra la mappa ──────────────────────────────────────────────
const MAP_TOOLS = [
  { id: "map", label: "Mappa", icon: Map },
  { id: "calendar", label: "Calendario", icon: Calendar },
  { id: "expenses", label: "Spese", icon: DollarSign },
  { id: "weather", label: "Meteo", icon: Cloud },
  { id: "ideas", label: "Idee", icon: Lightbulb },
  { id: "media", label: "Media", icon: Camera },
];

function MapToolbar({ active, onChange }: { active: string; onChange: (id: string) => void }) {
  return (
    <div className="flex items-center gap-1 px-3 py-2 border-b border-border/40 bg-card/60 backdrop-blur overflow-x-auto [&::-webkit-scrollbar]:hidden">
      {MAP_TOOLS.map((t) => {
        const Icon = t.icon;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all",
              active === t.id
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary"
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

function ToolContent({ tool, itinerary }: { tool: string; itinerary?: ItineraryData }) {
  if (tool === "map") return null; // mappa gestita separatamente

  const placeholders: Record<string, { emoji: string; title: string; desc: string }> = {
    calendar: { emoji: "📅", title: "Calendario viaggio", desc: "Organizza le date e gli appuntamenti del tuo itinerario" },
    expenses: { emoji: "💰", title: "Gestione spese", desc: "Tieni traccia del budget e dividi le spese con il gruppo" },
    weather: { emoji: "🌤", title: "Meteo in tempo reale", desc: "Previsioni aggiornate per ogni tappa del viaggio" },
    ideas: { emoji: "💡", title: "Le tue idee", desc: "Salva ispirazioni, note e idee per il viaggio" },
    media: { emoji: "📸", title: "Foto e media", desc: "Carica e condividi foto e video con il gruppo" },
  };

  const p = placeholders[tool];
  if (!p) return null;

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center gap-3">
      <div className="text-5xl">{p.emoji}</div>
      <div className="font-serif text-lg font-bold text-foreground">{p.title}</div>
      <div className="text-sm text-muted-foreground max-w-xs">{p.desc}</div>
      <div className="text-xs text-accent font-semibold mt-2">Disponibile prossimamente</div>
    </div>
  );
}

// ── Sidebar sinistra ──────────────────────────────────────────────────────
const NAV_ITEMS = [
  { id: "new", label: "Nuova chat", icon: PlusCircle },
  { id: "saved", label: "Viaggi salvati", icon: BookMarked },
  { id: "inspire", label: "Lasciati ispirare", icon: Compass },
  { id: "group", label: "Gruppi vacanza", icon: Users },
];

function Sidebar({
  open,
  onClose,
  onNewTrip,
  suggestions,
  onSuggestionClick,
}: {
  open: boolean;
  onClose: () => void;
  onNewTrip: () => void;
  suggestions?: Suggestion[];
  onSuggestionClick: (prompt: string) => void;
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
          animate={{ width: 260, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="border-r border-border/40 bg-sidebar flex flex-col min-h-0 overflow-hidden shrink-0"
        >
          {/* Header */}
          <div className="px-4 py-4 border-b border-border/40 flex items-center justify-between">
            <Logo variant="header" />
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
          </div>

          {/* Nav items */}
          <div className="px-2 py-3 space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNav(item.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                    active === item.id
                      ? "bg-accent/15 text-accent"
                      : "text-sidebar-foreground hover:bg-secondary"
                  )}
                >
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
                  <button
                    key={s.slug}
                    onClick={() => onSuggestionClick(s.prompt)}
                    className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-secondary transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{s.heroEmoji}</span>
                      <div>
                        <div className="text-sm font-semibold text-foreground">{s.title}</div>
                        <div className="text-xs text-muted-foreground line-clamp-1">{s.tagline}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          )}

          {/* Gruppi placeholder */}
          {active === "group" && (
            <div className="flex-1 flex flex-col items-center justify-center p-4 text-center gap-2">
              <Users className="w-8 h-8 text-accent/50" />
              <p className="text-sm font-medium text-foreground">Gruppi vacanza</p>
              <p className="text-xs text-muted-foreground">Crea e gestisci gruppi di viaggio con amici</p>
              <span className="text-xs text-accent font-semibold">Prossimamente</span>
            </div>
          )}

          {/* Salvati placeholder */}
          {active === "saved" && (
            <div className="flex-1 flex flex-col items-center justify-center p-4 text-center gap-2">
              <BookMarked className="w-8 h-8 text-accent/50" />
              <p className="text-sm font-medium text-foreground">Viaggi salvati</p>
              <p className="text-xs text-muted-foreground">I tuoi itinerari salvati appariranno qui</p>
            </div>
          )}
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

// ── Chat thread ───────────────────────────────────────────────────────────
function ChatThread({ messages, isPending, itinerary }: {
  messages: ChatMessage[];
  isPending: boolean;
  itinerary?: ItineraryData;
}) {
  return (
    <div className="space-y-4">
      {messages.map((m, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className={m.role === "user" ? "flex justify-end" : "flex justify-start"}
        >
          <div className={cn(
            "max-w-[88%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap",
            m.role === "user"
              ? "rounded-tr-sm bg-accent text-accent-foreground font-medium"
              : "rounded-tl-sm bg-secondary text-foreground border border-border/40"
          )}>
            {m.content}
          </div>
        </motion.div>
      ))}

      {/* Itinerario inline nella chat */}
      {itinerary && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <ItineraryResults itinerary={itinerary} />
          <PackingList list={itinerary.packingList} />
        </motion.div>
      )}

      {isPending && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
          <div className="rounded-2xl rounded-tl-sm px-4 py-3 bg-secondary border border-border/40 flex items-center gap-2">
            <div className="flex gap-1.5">
              {[0, 150, 300].map((d) => (
                <div key={d} className="w-2 h-2 rounded-full bg-accent animate-bounce" style={{ animationDelay: `${d}ms` }} />
              ))}
            </div>
            <span className="text-xs font-medium text-muted-foreground">Pianificando...</span>
          </div>
        </motion.div>
      )}
    </div>
  );
}

// ── SuggestionCard ────────────────────────────────────────────────────────
function SuggestionCard({ suggestion, onClick }: { suggestion: Suggestion; onClick: () => void }) {
  const photo = pickPhoto(suggestion.title);
  return (
    <Card className="w-[280px] md:w-[320px] shrink-0 cursor-pointer overflow-hidden group hover:shadow-2xl transition-all duration-300 border-white/10 bg-card/90 backdrop-blur" onClick={onClick}>
      <div className="relative h-32 bg-cover bg-center" style={{ backgroundImage: `url(${photo.src})` }}>
        <div className="absolute inset-0 bg-gradient-to-t from-card via-card/40 to-transparent" />
        <div className="absolute top-3 right-3 text-[10px] font-bold px-2.5 py-1 rounded-full bg-card/80 backdrop-blur text-foreground uppercase tracking-widest">
          {suggestion.budgetTier === "low" ? "Basso" : suggestion.budgetTier === "mid" ? "Medio" : "Alto"} budget
        </div>
        <div className="absolute bottom-2 left-3 text-3xl drop-shadow-lg">{suggestion.heroEmoji}</div>
      </div>
      <CardContent className="p-5 space-y-2">
        <h3 className="font-serif text-xl font-bold text-foreground leading-tight group-hover:text-accent transition-colors">{suggestion.title}</h3>
        <p className="text-sm font-medium text-accent">{suggestion.tagline}</p>
        <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">{suggestion.description}</p>
      </CardContent>
    </Card>
  );
}

// ── Main component ────────────────────────────────────────────────────────
export default function Home() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [filters, setFilters] = useState<TripFilters>(EMPTY_FILTERS);
  const [currentItinerary, setCurrentItinerary] = useState<ItineraryData | undefined>();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTool, setActiveTool] = useState("map");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const { data: suggestions } = useListSuggestions();
  const chatMutation = useChat();
  const saveMutation = useSaveItinerary();

  useEffect(() => { document.title = "Waydora — Travel simple, everywhere!"; }, []);

  useEffect(() => {
    chatScrollRef.current?.scrollTo({ top: chatScrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, chatMutation.isPending, currentItinerary]);

  const handleSubmit = (overridePrompt?: string) => {
    const promptText = overridePrompt ?? input;
    if (!promptText.trim() || chatMutation.isPending) return;

    const prefix = messages.length === 0 ? filtersToPromptPrefix(filters) : "";
    const fullPrompt = `${prefix}${promptText.trim()}`;
    const newMessages = [...messages, { role: "user" as const, content: fullPrompt }];
    setMessages(newMessages);
    if (!overridePrompt) setInput("");

    chatMutation.mutate(
      { data: { messages: newMessages, existingItinerary: currentItinerary } },
      {
        onSuccess: (data) => {
          setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
          if (data.itinerary) setCurrentItinerary(data.itinerary);
        },
        onError: () => toast({ title: "Qualcosa è andato storto", description: "Non sono riuscito a rispondere. Riprova.", variant: "destructive" }),
      }
    );
  };

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

  const handleNewTrip = () => { setMessages([]); setCurrentItinerary(undefined); setInput(""); };

  const isInitialState = messages.length === 0;

  // ── LANDING ──
  if (isInitialState) {
    return (
      <Layout>
        <div className="flex-1 overflow-y-auto">
          <section className="relative min-h-[88vh] flex items-center justify-center overflow-hidden">
            <TravelBackdrop />
            <div className="relative z-10 w-full max-w-5xl mx-auto px-4 py-16 md:py-20 flex flex-col items-center space-y-12">
              <Logo />
              <div className="w-full max-w-3xl space-y-3">
                <FilterBar value={filters} onChange={setFilters} />
                <div className="relative group">
                  <div className="absolute -inset-1 bg-gradient-to-r from-accent/40 to-white/10 rounded-2xl blur-xl opacity-60" />
                  <div className="relative flex flex-col sm:flex-row gap-3 bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-white/40 p-3">
                    <Textarea
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
                      placeholder="Descrivi il tuo viaggio dei sogni — destinazione, vibe, durata..."
                      className="min-h-[64px] max-h-[200px] border-0 focus-visible:ring-0 resize-none text-base md:text-lg px-4 py-3 placeholder:text-slate-400 shadow-none bg-transparent text-slate-900"
                    />
                    <Button onClick={() => handleSubmit()} disabled={!input.trim()} className="h-auto py-3 px-7 rounded-xl bg-accent hover:bg-accent/90 text-accent-foreground text-base font-bold shadow-lg shrink-0">
                      <Sparkles className="w-5 h-5 mr-2" />
                      Pianifica
                    </Button>
                  </div>
                </div>
              </div>
              {suggestions && suggestions.length > 0 && (
                <div className="w-full space-y-4 overflow-hidden">
                  <div className="flex items-center gap-2 text-xs font-bold tracking-[0.25em] text-white/85 px-2 uppercase">
                    <Heart className="w-4 h-4 text-accent" />
                    <span>Ispirazione del momento</span>
                  </div>
                  <div className="flex overflow-x-auto pb-6 -mx-4 px-4 gap-5 snap-x snap-mandatory [&::-webkit-scrollbar]:hidden">
                    {suggestions.map((s) => (
                      <div key={s.slug} className="snap-start">
                        <SuggestionCard suggestion={s} onClick={() => handleSubmit(s.prompt)} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
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

  // ── APP (3 colonne) ──
  return (
    <Layout>
      {/* DESKTOP */}
      <div className="flex-1 min-h-0 hidden lg:flex">

        {/* Toggle sidebar button quando chiusa */}
        {!sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(true)}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-20 bg-card border border-border/40 rounded-r-xl p-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        )}

        {/* SIDEBAR */}
        <Sidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          onNewTrip={handleNewTrip}
          suggestions={suggestions}
          onSuggestionClick={(prompt) => handleSubmit(prompt)}
        />

        {/* CHAT + ITINERARIO */}
        <section className="flex-1 min-h-0 flex flex-col border-r border-border/40">
          <div className="px-5 py-3 border-b border-border/40 flex items-center justify-between bg-card/40 backdrop-blur shrink-0">
            <div className="flex items-center gap-2">
              {!sidebarOpen && (
                <button onClick={() => setSidebarOpen(true)} className="text-muted-foreground hover:text-foreground mr-1">
                  <Menu className="w-4 h-4" />
                </button>
              )}
              <MessageSquare className="w-4 h-4 text-accent" />
              <span className="text-sm font-bold uppercase tracking-wider">Chat</span>
            </div>
            <div className="flex items-center gap-2">
              {currentItinerary && (
                <Button size="sm" onClick={handleSave} disabled={saveMutation.isPending}
                  className="bg-accent hover:bg-accent/90 text-accent-foreground rounded-full text-xs gap-1.5">
                  {saveMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                  Salva
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={handleNewTrip}
                className="text-xs gap-1.5 text-muted-foreground hover:text-foreground">
                <PlusCircle className="w-3.5 h-3.5" />
                Nuovo
              </Button>
            </div>
          </div>

          <ScrollArea className="flex-1" ref={chatScrollRef}>
            <div className="p-6 max-w-3xl mx-auto">
              <ChatThread messages={messages} isPending={chatMutation.isPending} itinerary={currentItinerary} />
            </div>
          </ScrollArea>

          <div className="p-3 border-t border-border/40 bg-background/60 shrink-0">
            <div className="relative flex flex-col gap-2 bg-secondary/50 rounded-xl border border-border/60 p-2 max-w-3xl mx-auto">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
                placeholder="Aggiungi un giorno, cambia città, riduci budget..."
                className="min-h-[56px] max-h-[140px] border-0 focus-visible:ring-0 resize-none text-sm px-2 py-1.5 placeholder:text-muted-foreground/70 shadow-none bg-transparent"
              />
              <Button onClick={() => handleSubmit()} disabled={!input.trim() || chatMutation.isPending}
                size="sm" className="self-end bg-accent hover:bg-accent/90 text-accent-foreground rounded-lg font-semibold">
                {chatMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4 mr-1.5" />Invia</>}
              </Button>
            </div>
          </div>
        </section>

        {/* MAPPA + STRUMENTI */}
        <aside className="w-[380px] xl:w-[420px] min-h-0 flex flex-col shrink-0">
          <MapToolbar active={activeTool} onChange={setActiveTool} />
          <div className="flex-1 min-h-0">
            {activeTool === "map" ? (
              currentItinerary ? (
                <TripMap itinerary={currentItinerary} />
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-sm text-muted-foreground gap-2">
                  <Map className="w-8 h-8 opacity-30" />
                  <span>La mappa apparirà qui</span>
                </div>
              )
            ) : (
              <ToolContent tool={activeTool} itinerary={currentItinerary} />
            )}
          </div>
        </aside>
      </div>

      {/* MOBILE */}
      <div className="flex-1 min-h-0 lg:hidden flex flex-col">
        <Tabs defaultValue="chat" className="flex-1 flex flex-col min-h-0">
          <TabsList className="mx-3 mt-3 grid grid-cols-3 bg-secondary/60">
            <TabsTrigger value="chat" className="text-xs font-semibold">Chat</TabsTrigger>
            <TabsTrigger value="trip" className="text-xs font-semibold">Itinerario</TabsTrigger>
            <TabsTrigger value="map" className="text-xs font-semibold">Mappa</TabsTrigger>
          </TabsList>
          <TabsContent value="chat" className="flex-1 min-h-0 flex flex-col mt-2">
            <ScrollArea className="flex-1">
              <div className="p-4">
                <ChatThread messages={messages} isPending={chatMutation.isPending} />
              </div>
            </ScrollArea>
            <div className="p-3 border-t border-border/40">
              <div className="flex gap-2 bg-secondary/50 rounded-xl border border-border/60 p-2">
                <Textarea value={input} onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
                  placeholder="Continua la conversazione..." className="min-h-[56px] max-h-[120px] border-0 focus-visible:ring-0 resize-none text-sm shadow-none bg-transparent" />
                <Button onClick={() => handleSubmit()} disabled={!input.trim() || chatMutation.isPending}
                  size="icon" className="self-end bg-accent hover:bg-accent/90 text-accent-foreground rounded-lg">
                  {chatMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </TabsContent>
          <TabsContent value="trip" className="flex-1 min-h-0 mt-2">
            <ScrollArea className="h-full">
              <div className="p-4 pb-32 space-y-8">
                {currentItinerary ? (
                  <>
                    <ItineraryResults itinerary={currentItinerary} />
                    <PackingList list={currentItinerary.packingList} />
                    <div className="flex justify-center">
                      <Button onClick={handleSave} disabled={saveMutation.isPending}
                        className="bg-accent hover:bg-accent/90 text-accent-foreground rounded-full px-8 py-5 font-bold shadow-xl">
                        <Save className="w-4 h-4 mr-2" />Salva e condividi
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-20 text-muted-foreground text-sm">Pianificando...</div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>
          <TabsContent value="map" className="flex-1 min-h-0 mt-2">
            <div className="h-full">
              {currentItinerary ? <TripMap itinerary={currentItinerary} /> : (
                <div className="h-full flex items-center justify-center text-sm text-muted-foreground">In attesa dell'itinerario...</div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}