import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Layout, Logo } from "@/components/layout";
import { TravelBackdrop } from "@/components/travel-backdrop";
import { ItineraryTimeline } from "@/components/itinerary";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Send, Loader2, Sparkles, Heart, Save } from "lucide-react";
import {
  useListSuggestions,
  useChat,
  useSaveItinerary,
  ChatMessage,
  ItineraryData,
  Suggestion,
} from "@workspace/api-client-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

function SuggestionCard({
  suggestion,
  onClick,
}: {
  suggestion: Suggestion;
  onClick: () => void;
}) {
  return (
    <Card
      className="w-[280px] md:w-[320px] shrink-0 cursor-pointer overflow-hidden group hover:shadow-xl transition-all duration-300 border-transparent hover:border-primary/20 bg-background"
      onClick={onClick}
      style={
        {
          "--theme-accent": suggestion.accent,
        } as React.CSSProperties
      }
    >
      <CardContent className="p-0 relative h-full flex flex-col min-h-[220px]">
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--theme-accent)]/10 to-transparent opacity-50 group-hover:opacity-100 transition-opacity" />
        <div className="p-6 relative z-10 flex-1 flex flex-col">
          <div className="flex justify-between items-start mb-4">
            <span className="text-4xl drop-shadow-sm">{suggestion.heroEmoji}</span>
            <div className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-background/80 backdrop-blur shadow-sm text-foreground uppercase tracking-widest">
              {suggestion.budgetTier} budget
            </div>
          </div>
          <h3 className="font-serif text-2xl font-bold mb-1.5 group-hover:text-primary transition-colors leading-tight">
            {suggestion.title}
          </h3>
          <p className="text-sm font-medium text-accent mb-3">
            {suggestion.tagline}
          </p>
          <p className="text-sm text-muted-foreground line-clamp-2 mt-auto leading-relaxed">
            {suggestion.description}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Home() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [currentItinerary, setCurrentItinerary] = useState<ItineraryData | undefined>();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: suggestions } = useListSuggestions();
  const chatMutation = useChat();
  const saveMutation = useSaveItinerary();

  useEffect(() => {
    document.title = "Waydora — Travel simple, everywhere!";
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      const el = scrollRef.current;
      // Small timeout to allow DOM to update before scrolling
      setTimeout(() => {
        el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
      }, 50);
    }
  }, [messages, currentItinerary, chatMutation.isPending]);

  const handleSubmit = (overridePrompt?: string) => {
    const promptText = overridePrompt || input;
    if (!promptText.trim() || chatMutation.isPending) return;

    const newMessage: ChatMessage = { role: "user", content: promptText.trim() };
    const newMessages = [...messages, newMessage];
    
    setMessages(newMessages);
    if (!overridePrompt) {
      setInput("");
    }

    chatMutation.mutate(
      {
        data: {
          messages: newMessages,
          existingItinerary: currentItinerary,
        },
      },
      {
        onSuccess: (data) => {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: data.reply },
          ]);
          if (data.itinerary) {
            setCurrentItinerary(data.itinerary);
          }
        },
        onError: () => {
          toast({
            title: "Something went wrong",
            description: "Failed to get a response. Please try again.",
            variant: "destructive",
          });
        },
      }
    );
  };

  const handleSave = () => {
    if (!currentItinerary || saveMutation.isPending) return;

    saveMutation.mutate(
      { data: { itinerary: currentItinerary } },
      {
        onSuccess: (saved) => {
          toast({
            title: "Itinerary saved!",
            description: "You can now share this trip with friends.",
          });
          setLocation(`/trip/${saved.shareSlug}`);
        },
        onError: () => {
          toast({
            title: "Failed to save",
            description: "Please try again later.",
            variant: "destructive",
          });
        },
      }
    );
  };

  const isInitialState = messages.length === 0;

  return (
    <Layout>
      <div className="flex-1 flex flex-col w-full min-h-0">
        {isInitialState && (
          <div className="flex-1 relative overflow-y-auto">
            <TravelBackdrop />
            <div className="relative z-10 flex flex-col items-center justify-start min-h-full py-14 md:py-20 px-4 md:px-6 space-y-14 max-w-5xl mx-auto">
              <Logo />

              <div className="w-full max-w-3xl relative group">
                <div className="absolute -inset-1.5 bg-gradient-to-r from-accent/40 to-white/20 rounded-2xl blur-xl opacity-60 transition duration-1000" />
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
                    placeholder="Describe your dream trip — destination, dates, vibe, budget..."
                    className="min-h-[70px] max-h-[250px] border-0 focus-visible:ring-0 resize-none text-lg md:text-xl px-5 py-4 placeholder:text-muted-foreground/60 shadow-none bg-transparent text-foreground"
                  />
                  <Button
                    onClick={() => handleSubmit()}
                    disabled={!input.trim()}
                    className="h-auto sm:h-auto py-4 px-8 rounded-xl bg-accent hover:bg-accent/90 text-accent-foreground text-lg font-bold shadow-lg shrink-0 transition-all active:scale-95"
                  >
                    <Sparkles className="w-5 h-5 mr-2" />
                    Plan It
                  </Button>
                </div>
              </div>

              {suggestions && suggestions.length > 0 && (
                <div className="w-full space-y-5 overflow-hidden">
                  <div className="flex items-center gap-2 text-sm font-semibold tracking-[0.2em] text-white/80 px-2 uppercase">
                    <Heart className="w-4 h-4 text-accent" />
                    <span>Featured inspiration</span>
                  </div>
                  <div className="flex overflow-x-auto pb-8 -mx-4 px-4 md:mx-0 md:px-0 gap-6 snap-x snap-mandatory [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                    {suggestions.map((suggestion) => (
                      <div key={suggestion.slug} className="snap-start">
                        <SuggestionCard
                          suggestion={suggestion}
                          onClick={() => handleSubmit(suggestion.prompt)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {!isInitialState && (
          <div className="flex-1 flex flex-col min-h-0 relative">
            <ScrollArea className="flex-1 pr-4 -mr-4" ref={scrollRef}>
              <div className="space-y-8 pb-32 pt-4 max-w-4xl mx-auto">
                {messages.map((msg, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      "flex max-w-[85%]",
                      msg.role === "user" ? "ml-auto justify-end" : "mr-auto justify-start"
                    )}
                  >
                    <div
                      className={cn(
                        "rounded-2xl px-6 py-4 text-base leading-relaxed shadow-sm whitespace-pre-wrap",
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground rounded-tr-sm font-medium"
                          : "bg-secondary/50 text-foreground rounded-tl-sm border border-border/50"
                      )}
                    >
                      {msg.content}
                    </div>
                  </motion.div>
                ))}

                {chatMutation.isPending && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex max-w-[85%] mr-auto justify-start"
                  >
                    <div className="rounded-2xl rounded-tl-sm px-6 py-5 bg-secondary/50 border border-border/50 flex items-center gap-4 shadow-sm">
                      <div className="flex gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                        <div className="w-2.5 h-2.5 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                        <div className="w-2.5 h-2.5 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                      <span className="text-sm font-medium text-muted-foreground">Crafting your trip...</span>
                    </div>
                  </motion.div>
                )}

                {currentItinerary && !chatMutation.isPending && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-card rounded-3xl shadow-xl border border-border p-6 md:p-10 lg:p-12 my-12"
                  >
                    <ItineraryTimeline itinerary={currentItinerary} />
                    <div className="mt-16 flex justify-center border-t border-border/50 pt-10">
                      <Button 
                        size="lg" 
                        onClick={handleSave}
                        disabled={saveMutation.isPending}
                        className="bg-accent hover:bg-accent/90 text-accent-foreground rounded-full px-10 py-7 text-lg font-bold shadow-xl hover:shadow-2xl transition-all hover:-translate-y-0.5"
                      >
                        {saveMutation.isPending ? (
                          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        ) : (
                          <Save className="w-5 h-5 mr-3" />
                        )}
                        Save & Share Itinerary
                      </Button>
                    </div>
                  </motion.div>
                )}
              </div>
            </ScrollArea>

            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-background via-background/95 to-transparent pt-10 pb-4 shrink-0">
              <div className="relative flex flex-col sm:flex-row gap-2 bg-background rounded-2xl shadow-[0_-4px_24px_rgba(0,0,0,0.05)] border border-primary/10 p-2 max-w-4xl mx-auto">
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit();
                    }
                  }}
                  placeholder="Refine your trip... (e.g. 'Make it cheaper', 'Add more museums')"
                  className="min-h-[56px] max-h-[150px] border-0 focus-visible:ring-0 resize-none text-base px-4 py-3.5 placeholder:text-muted-foreground/60 shadow-none bg-transparent"
                />
                <Button
                  onClick={() => handleSubmit()}
                  disabled={!input.trim() || chatMutation.isPending}
                  size="icon"
                  className="h-14 w-14 sm:h-auto sm:w-auto sm:px-8 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-md shrink-0 self-end sm:self-stretch transition-all active:scale-95"
                >
                  {chatMutation.isPending ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Send className="w-5 h-5 sm:mr-2" />
                      <span className="hidden sm:inline">Send</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
