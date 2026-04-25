import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  Send,
  Loader2,
  Sparkles,
  Save,
  Heart,
  PlusCircle,
  MessageSquare,
} from "lucide-react";
import {
  useListSuggestions,
  useChat,
  useSaveItinerary,
  type ChatMessage,
  type ItineraryData,
  type Suggestion,
} from "@workspace/api-client-react";
import { Layout, Logo } from "@/components/layout";
import { TravelBackdrop } from "@/components/travel-backdrop";
import { ItineraryResults, PackingList } from "@/components/itinerary-results";
import { TripMap } from "@/components/trip-map";
import {
  FilterBar,
  EMPTY_FILTERS,
  filtersToPromptPrefix,
  type TripFilters,
} from "@/components/filter-bar";
import {
  HowItWorks,
  TripCounter,
  Partners,
  Reviews,
  Faq,
  SiteFooter,
} from "@/components/landing-sections";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { pickPhoto } from "@/lib/photos";

function SuggestionCard({
  suggestion,
  onClick,
}: {
  suggestion: Suggestion;
  onClick: () => void;
}) {
  const photo = pickPhoto(suggestion.title);
  return (
    <Card
      className="w-[280px] md:w-[320px] shrink-0 cursor-pointer overflow-hidden group hover:shadow-2xl transition-all duration-300 border-white/10 bg-card/90 backdrop-blur"
      onClick={onClick}
    >
      <div className="relative h-32 bg-cover bg-center" style={{ backgroundImage: `url(${photo.src})` }}>
        <div className="absolute inset-0 bg-gradient-to-t from-card via-card/40 to-transparent" />
        <div className="absolute top-3 right-3 text-[10px] font-bold px-2.5 py-1 rounded-full bg-card/80 backdrop-blur text-foreground uppercase tracking-widest">
          {suggestion.budgetTier === "low" ? "Basso" : suggestion.budgetTier === "mid" ? "Medio" : "Alto"} budget
        </div>
        <div className="absolute bottom-2 left-3 text-3xl drop-shadow-lg">{suggestion.heroEmoji}</div>
      </div>
      <CardContent className="p-5 space-y-2">
        <h3 className="font-serif text-xl font-bold text-foreground leading-tight group-hover:text-accent transition-colors">
          {suggestion.title}
        </h3>
        <p className="text-sm font-medium text-accent">{suggestion.tagline}</p>
        <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
          {suggestion.description}
        </p>
      </CardContent>
    </Card>
  );
}

function ChatThread({
  messages,
  isPending,
}: {
  messages: ChatMessage[];
  isPending: boolean;
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
          <div
            className={
              m.role === "user"
                ? "max-w-[88%] rounded-2xl rounded-tr-sm px-4 py-3 bg-accent text-accent-foreground text-sm font-medium whitespace-pre-wrap"
                : "max-w-[88%] rounded-2xl rounded-tl-sm px-4 py-3 bg-secondary text-foreground text-sm whitespace-pre-wrap border border-border/40"
            }
          >
            {m.content}
          </div>
        </motion.div>
      ))}
      {isPending && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex justify-start"
        >
          <div className="rounded-2xl rounded-tl-sm px-4 py-3 bg-secondary border border-border/40 flex items-center gap-2">
            <div className="flex gap-1.5">
              <div className="w-2 h-2 rounded-full bg-accent animate-bounce" style={{ animationDelay: "0ms" }} />
              <div className="w-2 h-2 rounded-full bg-accent animate-bounce" style={{ animationDelay: "150ms" }} />
              <div className="w-2 h-2 rounded-full bg-accent animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
            <span className="text-xs font-medium text-muted-foreground">Pianificando...</span>
          </div>
        </motion.div>
      )}
    </div>
  );
}

export default function Home() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [filters, setFilters] = useState<TripFilters>(EMPTY_FILTERS);
  const [currentItinerary, setCurrentItinerary] = useState<ItineraryData | undefined>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const resultsScrollRef = useRef<HTMLDivElement>(null);

  const { data: suggestions } = useListSuggestions();
  const chatMutation = useChat();
  const saveMutation = useSaveItinerary();

  useEffect(() => {
    document.title = "Waydora — Travel simple, everywhere!";
  }, []);

  useEffect(() => {
    chatScrollRef.current?.scrollTo({ top: chatScrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, chatMutation.isPending]);

  useEffect(() => {
    resultsScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [currentItinerary?.title]);

  const handleSubmit = (overridePrompt?: string) => {
    const promptText = overridePrompt ?? input;
    if (!promptText.trim() || chatMutation.isPending) return;

    const prefix = messages.length === 0 ? filtersToPromptPrefix(filters) : "";
    const fullPrompt = `${prefix}${promptText.trim()}`;
    const newMessage: ChatMessage = { role: "user", content: fullPrompt };
    const newMessages = [...messages, newMessage];
    setMessages(newMessages);
    if (!overridePrompt) setInput("");

    chatMutation.mutate(
      {
        data: {
          messages: newMessages,
          existingItinerary: currentItinerary,
        },
      },
      {
        onSuccess: (data) => {
          setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
          if (data.itinerary) setCurrentItinerary(data.itinerary);
        },
        onError: () => {
          toast({
            title: "Qualcosa è andato storto",
            description: "Non sono riuscito a rispondere. Riprova.",
            variant: "destructive",
          });
        },
      },
    );
  };

  const handleSave = () => {
    if (!currentItinerary || saveMutation.isPending) return;
    saveMutation.mutate(
      { data: { itinerary: currentItinerary } },
      {
        onSuccess: (saved) => {
          toast({
            title: "Itinerario salvato!",
            description: "Ora puoi condividerlo con i tuoi amici.",
          });
          setLocation(`/trip/${saved.shareSlug}`);
        },
        onError: () => {
          toast({
            title: "Errore di salvataggio",
            description: "Riprova più tardi.",
            variant: "destructive",
          });
        },
      },
    );
  };

  const handleNewTrip = () => {
    setMessages([]);
    setCurrentItinerary(undefined);
    setInput("");
  };

  const isInitialState = messages.length === 0;

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
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSubmit();
                        }
                      }}
                      placeholder="Descrivi il tuo viaggio dei sogni — destinazione, vibe, durata..."
                      className="min-h-[64px] max-h-[200px] border-0 focus-visible:ring-0 resize-none text-base md:text-lg px-4 py-3 placeholder:text-slate-400 shadow-none bg-transparent text-slate-900"
                    />
                    <Button
                      onClick={() => handleSubmit()}
                      disabled={!input.trim()}
                      className="h-auto py-3 px-7 rounded-xl bg-accent hover:bg-accent/90 text-accent-foreground text-base font-bold shadow-lg shrink-0"
                    >
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
                  <div className="flex overflow-x-auto pb-6 -mx-4 px-4 gap-5 snap-x snap-mandatory [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                    {suggestions.map((s) => (
                      <div key={s.slug} className="snap-start">
                        <SuggestionCard
                          suggestion={s}
                          onClick={() => handleSubmit(s.prompt)}
                        />
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

  return (
    <Layout>
      <div className="flex-1 min-h-0 hidden lg:grid lg:grid-cols-[380px_minmax(0,1fr)_400px] xl:grid-cols-[420px_minmax(0,1fr)_460px]">
        <aside className="border-r border-border/40 bg-card/40 backdrop-blur flex flex-col min-h-0">
          <div className="px-5 py-4 border-b border-border/40 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-accent" />
              <span className="text-sm font-bold uppercase tracking-wider">Chat</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs gap-1.5 text-muted-foreground hover:text-foreground"
              onClick={handleNewTrip}
            >
              <PlusCircle className="w-3.5 h-3.5" />
              Nuovo
            </Button>
          </div>
          <ScrollArea className="flex-1" ref={chatScrollRef}>
            <div className="p-4">
              <ChatThread messages={messages} isPending={chatMutation.isPending} />
            </div>
          </ScrollArea>
          <div className="p-3 border-t border-border/40 bg-background/60">
            <div className="relative flex flex-col gap-2 bg-secondary/50 rounded-xl border border-border/60 p-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
                placeholder="Aggiungi un giorno, cambia città, riduci budget..."
                className="min-h-[56px] max-h-[140px] border-0 focus-visible:ring-0 resize-none text-sm px-2 py-1.5 placeholder:text-muted-foreground/70 shadow-none bg-transparent"
              />
              <Button
                onClick={() => handleSubmit()}
                disabled={!input.trim() || chatMutation.isPending}
                size="sm"
                className="self-end bg-accent hover:bg-accent/90 text-accent-foreground rounded-lg font-semibold"
              >
                {chatMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-1.5" />
                    Invia
                  </>
                )}
              </Button>
            </div>
          </div>
        </aside>

        <section className="min-h-0 flex flex-col">
          <ScrollArea className="flex-1" ref={resultsScrollRef}>
            <div className="p-6 lg:p-8 max-w-3xl mx-auto">
              {currentItinerary ? (
                <div className="space-y-10">
                  <ItineraryResults itinerary={currentItinerary} />
                  <PackingList list={currentItinerary.packingList} />
                  <div className="flex justify-center pt-4 pb-12">
                    <Button
                      size="lg"
                      onClick={handleSave}
                      disabled={saveMutation.isPending}
                      className="bg-accent hover:bg-accent/90 text-accent-foreground rounded-full px-10 py-6 text-base font-bold shadow-xl"
                    >
                      {saveMutation.isPending ? (
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      ) : (
                        <Save className="w-5 h-5 mr-2" />
                      )}
                      Salva e condividi
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-32 text-center text-muted-foreground gap-3">
                  <Sparkles className="w-10 h-10 text-accent/50" />
                  <p className="font-medium">Sto preparando il tuo itinerario...</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </section>

        <aside className="border-l border-border/40 min-h-0 flex flex-col">
          <div className="px-5 py-4 border-b border-border/40 bg-card/40 backdrop-blur">
            <span className="text-sm font-bold uppercase tracking-wider">Mappa</span>
          </div>
          <div className="flex-1 min-h-0">
            {currentItinerary ? (
              <TripMap itinerary={currentItinerary} />
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                In attesa dell'itinerario...
              </div>
            )}
          </div>
        </aside>
      </div>

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
              <div className="relative flex gap-2 bg-secondary/50 rounded-xl border border-border/60 p-2">
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit();
                    }
                  }}
                  placeholder="Continua la conversazione..."
                  className="min-h-[56px] max-h-[120px] border-0 focus-visible:ring-0 resize-none text-sm shadow-none bg-transparent"
                />
                <Button
                  onClick={() => handleSubmit()}
                  disabled={!input.trim() || chatMutation.isPending}
                  size="icon"
                  className="self-end bg-accent hover:bg-accent/90 text-accent-foreground rounded-lg"
                >
                  {chatMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
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
                      <Button
                        onClick={handleSave}
                        disabled={saveMutation.isPending}
                        className="bg-accent hover:bg-accent/90 text-accent-foreground rounded-full px-8 py-5 font-bold shadow-xl"
                      >
                        {saveMutation.isPending ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Save className="w-4 h-4 mr-2" />
                        )}
                        Salva e condividi
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-20 text-muted-foreground text-sm">
                    Pianificando...
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="map" className="flex-1 min-h-0 mt-2">
            <div className="h-full">
              {currentItinerary ? (
                <TripMap itinerary={currentItinerary} />
              ) : (
                <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
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
