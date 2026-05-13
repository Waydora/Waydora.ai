import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare,
  Sparkles,
  PlaneTakeoff,
  Star,
  ChevronDown,
  Mail,
  FileText,
} from "lucide-react";
import waydoraLogo from "@assets/Travel_simple,_everywhere!_(2)_1777134832372.png";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent } from "@/components/ui/card";

const useGetStats = () => ({
  data: {
    trips: 1280,
    users: 540,
    countries: 42,
  },
});

const STEPS = [
  {
    icon: MessageSquare,
    title: "Descrivi",
    text: "Racconta a Waydora il tuo viaggio: dove, quando, con chi e con che vibe.",
  },
  {
    icon: Sparkles,
    title: "Pianifica",
    text: "L'AI costruisce il tuo itinerario giornaliero su misura, con coordinate e meteo.",
  },
  {
    icon: PlaneTakeoff,
    title: "Prenota",
    text: "Voli, hotel, esperienze e ristoranti con un click tramite i nostri partner.",
  },
];

const PARTNERS = [
  { name: "Booking.com", color: "#003580" },
  { name: "GetYourGuide", color: "#FF5533" },
  { name: "TheFork", color: "#34E0A1" },
  { name: "Airbnb", color: "#FF385C" },
  { name: "Skyscanner", color: "#0770E3" },
];

const REVIEWS = [
  {
    name: "Giulia M.",
    city: "Padova",
    rating: 4,
    text: "In 30 secondi avevo l'itinerario di 5 giorni in Marocco perfetto. Ho prenotato tutto direttamente dai link, niente da limare.",
    initials: "GM",
  },
  {
    name: "Marco R.",
    city: "Roma",
    rating: 5,
    text: "Volevo fuggire da Roma per un weekend a basso prezzo. Mi ha proposto Lubiana, l'ho amata. La mappa con le tappe è oro.",
    initials: "MR",
  },
  {
    name: "Sara B.",
    city: "Pescara",
    rating: 5,
    text: "Ho aggiustato l'itinerario chattando come con un'amica esperta. Mi ha messo i ristoranti giusti e una cena vista mare a Cefalù.",
    initials: "SB",
  },
  {
    name: "Luca D.",
    city: "Napoli",
    rating: 5,
    text: "Lista bagaglio, link Booking, mappa interattiva: tutto in un posto. Lo uso prima di ogni partenza.",
    initials: "LD",
  },
];

const FAQ = [
  {
    q: "Waydora è gratuito?",
    a: "Sì, pianificare un itinerario con Waydora è completamente gratuito. Quando prenoti hotel o esperienze tramite i nostri link partner riceviamo una piccola commissione, senza nessun sovrapprezzo per te.",
  },
  {
    q: "Posso modificare l'itinerario dopo averlo creato?",
    a: "Certo. Continua a chattare con Waydora per aggiungere giorni, cambiare destinazioni, ridurre il budget, aggiungere musei o ristoranti specifici. L'itinerario si aggiorna in tempo reale.",
  },
  {
    q: "I link di prenotazione sono affidabili?",
    a: "Usiamo solo partner ufficiali e affidabili come Booking.com, GetYourGuide, TheFork, Airbnb e Skyscanner. Le prenotazioni avvengono direttamente sui loro siti.",
  },
  {
    q: "Posso condividere un itinerario con un amico?",
    a: "Sì, ogni itinerario salvato ha un link pubblico univoco che puoi condividere via WhatsApp, email o copiando l'URL. L'amico vede l'itinerario completo, mappa e lista bagaglio inclusi.",
  },
  {
    q: "Funziona per viaggi di lavoro o solo per vacanze?",
    a: "Funziona per qualsiasi tipo di viaggio: business, weekend, luna di miele, viaggio di gruppo, viaggio con bambini. Più dettagli dai nella chat, più l'itinerario sarà su misura.",
  },
];

// ── Lista destinazioni ───────────────────────────────────────────────────
const DESTINATIONS = [
  { name: "Tokyo",     query: "tokyo japan city night" },
  { name: "Bali",      query: "bali rice terraces tropical" },
  { name: "New York",  query: "new york city manhattan skyline" },
  { name: "Lisbona",   query: "lisbon portugal colorful buildings" },
  { name: "Cefalù",    query: "cefalu sicily sea" },
  { name: "Parigi",    query: "paris eiffel tower" },
  { name: "Marrakech", query: "marrakech morocco medina" },
  { name: "Istanbul",  query: "istanbul turkey bosphorus" },
  { name: "Santorini", query: "santorini greece white buildings" },
  { name: "Madeira",   query: "madeira portugal cliffs ocean" },
  { name: "Seoul",     query: "seoul south korea city" },
  { name: "Dolomiti",  query: "dolomites italy mountains" },
  { name: "Londra",    query: "london uk tower bridge" },
  { name: "Dubai",     query: "dubai skyline desert" },
  { name: "Tulum",     query: "tulum mexico beach ruins" },
  { name: "Budapest",  query: "budapest hungary parliament night" },
];

function getPhotoUrl(query: string) {
  return `https://source.unsplash.com/1600x900/?${encodeURIComponent(query)}`;
}

// ── Typewriter ───────────────────────────────────────────────────────────
function TypewriterDestination({ text }: { text: string }) {
  const [displayed, setDisplayed] = useState("");
  const [phase, setPhase] = useState<"typing" | "waiting">("typing");

  useEffect(() => {
    setDisplayed("");
    setPhase("typing");
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(interval);
        setPhase("waiting");
      }
    }, 60);
    return () => clearInterval(interval);
  }, [text]);

  return (
    <span className="relative inline-block">
      <span className="text-white font-bold">{displayed}</span>
      {phase === "typing" && (
        <span
          className="inline-block w-[2px] h-[0.85em] bg-white align-middle ml-0.5"
          style={{ animation: "blink 0.7s step-end infinite" }}
        />
      )}
    </span>
  );
}

// ── HeroLanding ──────────────────────────────────────────────────────────
interface HeroLandingProps {
  onSubmit: (prompt: string) => void;
  isPending?: boolean;
}

export function HeroLanding({ onSubmit, isPending }: HeroLandingProps) {
  const [destIndex, setDestIndex] = useState(0);
  const [bgLoaded, setBgLoaded] = useState(false);
  const [bgSrc, setBgSrc] = useState("");
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [, navigate] = useLocation();

  const currentDest = DESTINATIONS[destIndex];

  // Carica la foto della destinazione corrente
  useEffect(() => {
    setBgLoaded(false);
    const img = new Image();
    img.src = getPhotoUrl(currentDest.query);
    img.onload = () => {
      setBgSrc(img.src);
      setBgLoaded(true);
    };
    if (img.complete) {
      setBgSrc(img.src);
      setBgLoaded(true);
    }
  }, [currentDest.query]);

  // Cambia destinazione ogni 4 secondi
  useEffect(() => {
    const timer = setInterval(() => {
      setDestIndex((prev) => (prev + 1) % DESTINATIONS.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  const handleSubmit = useCallback(() => {
    if (!input.trim() || isPending) return;
    onSubmit(input.trim());
  }, [input, isPending, onSubmit]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const ta = e.target;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 160) + "px";
  };

  return (
    <section className="relative min-h-screen flex flex-col overflow-hidden">

      {/* Sfondo animato */}
      <div className="absolute inset-0 bg-black">
        <AnimatePresence mode="sync">
          {bgLoaded && (
            <motion.div
              key={bgSrc}
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url(${bgSrc})` }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.2, ease: "easeInOut" }}
            />
          )}
        </AnimatePresence>
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/30 to-black/70" />
      </div>

      {/* Logo in alto a sinistra */}
      <div className="relative z-20 px-6 pt-6">
        <a
          href="/"
          onClick={(e) => { e.preventDefault(); navigate("/"); }}
          className="inline-block"
          aria-label="Torna alla home"
        >
          <span
            className="text-white font-black tracking-tight select-none"
            style={{ fontSize: "1.75rem", letterSpacing: "-0.03em" }}
          >
            Waydora
          </span>
        </a>
      </div>

      {/* Contenuto centrale */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 pb-20 pt-10">

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="text-center mb-10 max-w-3xl"
        >
          <p className="text-white/60 text-sm font-medium tracking-widest uppercase mb-5">
            Il tuo assistente di viaggio AI
          </p>
          <h1
            className="text-white font-black leading-tight"
            style={{ fontSize: "clamp(2rem, 5vw, 3.5rem)", letterSpacing: "-0.02em" }}
          >
            Ciao, sono Waydora,
            <br />
            il tuo assistente di viaggio.
            <br />
            <span className="text-white/70 font-light text-[0.8em]">
              Oggi ti porto a{" "}
              <TypewriterDestination text={currentDest.name} />
            </span>
          </h1>
        </motion.div>

        {/* Search box stile iOS */}
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.15, ease: "easeOut" }}
          className="w-full max-w-2xl"
        >
          <div
            className="flex items-end gap-3 rounded-2xl p-3"
            style={{
              background: "rgba(255,255,255,0.15)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              border: "1px solid rgba(255,255,255,0.25)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.25)",
            }}
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              placeholder="Dove vuoi andare? Descrivi il tuo viaggio..."
              rows={1}
              className="flex-1 bg-transparent resize-none outline-none border-none text-white placeholder:text-white/50 text-base leading-relaxed px-2 py-1"
              style={{ minHeight: "36px", maxHeight: "160px" }}
            />
            <button
              onClick={handleSubmit}
              disabled={!input.trim() || isPending}
              className="shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm text-white transition-all duration-200"
              style={{
                background: input.trim() && !isPending ? "#000" : "rgba(0,0,0,0.4)",
                cursor: input.trim() && !isPending ? "pointer" : "not-allowed",
              }}
            >
              {isPending ? (
                <>
                  <span
                    className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                    style={{ animation: "spin 0.8s linear infinite" }}
                  />
                  <span>Pianificando...</span>
                </>
              ) : (
                <><span>Pianifica</span><span>✨</span></>
              )}
            </button>
          </div>
          <p className="text-center text-white/35 text-xs mt-3">
            Premi Invio per pianificare — Shift+Invio per andare a capo
          </p>
        </motion.div>

        {/* Pallini destinazione */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="flex gap-1.5 mt-8"
        >
          {DESTINATIONS.map((_, i) => (
            <button
              key={i}
              onClick={() => setDestIndex(i)}
              className="rounded-full transition-all duration-300"
              style={{
                width: i === destIndex ? "20px" : "6px",
                height: "6px",
                background: i === destIndex ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.35)",
              }}
              aria-label={`Vai a ${DESTINATIONS[i].name}`}
            />
          ))}
        </motion.div>
      </div>

      <style>{`
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </section>
  );
}

// ── HowItWorks ───────────────────────────────────────────────────────────
export function HowItWorks() {
  return (
    <section className="py-20 md:py-28 px-4 max-w-6xl mx-auto">
      <div className="text-center mb-14 space-y-3">
        <span className="text-xs font-bold uppercase tracking-[0.25em] text-accent">
          Come funziona
        </span>
        <h2 className="font-bold tracking-tight text-3xl md:text-5xl text-foreground">
          Tre passi al tuo prossimo viaggio
        </h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {STEPS.map((step, i) => {
          const Icon = step.icon;
          return (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
            >
              <Card className="h-full border-border/60 bg-black/30 backdrop-blur-xl border border-white/10 hover:border-accent/40 transition-colors">
                <CardContent className="p-7 space-y-4">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-accent/15 text-accent">
                    <Icon className="w-6 h-6" />
                  </div>
                  <div className="text-xs font-bold tracking-widest text-accent">
                    STEP {String(i + 1).padStart(2, "0")}
                  </div>
                  <h3 className="font-bold text-2xl text-foreground">{step.title}</h3>
                  <p className="text-base text-muted-foreground leading-relaxed">{step.text}</p>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}

// ── TripCounter ──────────────────────────────────────────────────────────
function useAnimatedNumber(target: number, durationMs: number = 1400) {
  const [value, setValue] = useState(target);
  const fromRef = useRef(target);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (target === value) return;
    fromRef.current = value;
    startRef.current = null;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const tick = (now: number) => {
      if (startRef.current === null) startRef.current = now;
      const t = Math.min(1, (now - startRef.current) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(fromRef.current + (target - fromRef.current) * eased));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [target]);

  return value;
}

export function TripCounter() {
  const { data } = useGetStats();
  const target = (data as any)?.tripsPlanned ?? 12_847;
  const animated = useAnimatedNumber(target);
  const formatted = new Intl.NumberFormat("it-IT").format(animated);

  return (
    <section className="py-16 px-4">
      <div className="max-w-4xl mx-auto text-center space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/10 border border-accent/30">
          <span className="relative flex w-2 h-2">
            <span className="absolute inset-0 rounded-full bg-accent animate-ping opacity-75" />
            <span className="relative rounded-full bg-accent w-2 h-2" />
          </span>
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent">in tempo reale</span>
        </div>
        <div className="text-6xl md:text-8xl font-bold text-accent tabular-nums">{formatted}</div>
        <p className="text-base md:text-lg uppercase tracking-[0.25em] font-bold text-muted-foreground">
          Viaggi pianificati con Waydora
        </p>
      </div>
    </section>
  );
}

// ── Partners ─────────────────────────────────────────────────────────────
export function Partners() {
  return (
    <section className="py-14 px-4 border-y border-border/40 bg-black/30 backdrop-blur">
      <div className="max-w-6xl mx-auto">
        <p className="text-center text-xs font-bold uppercase tracking-[0.3em] text-muted-foreground mb-8">
          Prenoti con i migliori partner
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-6">
          {PARTNERS.map((p) => (
            <div key={p.name} className="text-xl md:text-2xl font-bold opacity-70 hover:opacity-100 transition-opacity" style={{ color: p.color }}>
              {p.name}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Reviews ──────────────────────────────────────────────────────────────
export function Reviews() {
  return (
    <section className="py-20 md:py-28 px-4 max-w-6xl mx-auto">
      <div className="text-center mb-14 space-y-3">
        <span className="text-xs font-bold uppercase tracking-[0.25em] text-accent">Cosa dicono i viaggiatori</span>
        <h2 className="font-bold text-3xl md:text-5xl text-foreground">Pianificato. Vissuto. Condiviso.</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {REVIEWS.map((r, i) => (
          <motion.div key={r.name} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}>
            <Card className="h-full border-border/60 bg-black/30 backdrop-blur-xl border border-white/10">
              <CardContent className="p-6 space-y-4 flex flex-col h-full">
                <div className="flex gap-0.5">
                  {Array.from({ length: r.rating }).map((_, idx) => (
                    <Star key={idx} className="w-4 h-4 fill-accent text-accent" />
                  ))}
                </div>
                <p className="text-sm text-foreground leading-relaxed flex-1">"{r.text}"</p>
                <div className="flex items-center gap-3 pt-2 border-t border-border/40">
                  <div className="w-10 h-10 rounded-full bg-accent/15 text-accent flex items-center justify-center font-bold text-sm">{r.initials}</div>
                  <div>
                    <div className="font-semibold text-sm text-foreground">{r.name}</div>
                    <div className="text-xs text-muted-foreground">{r.city}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

// ── FAQ ──────────────────────────────────────────────────────────────────
export function Faq() {
  return (
    <section className="py-20 md:py-28 px-4 max-w-3xl mx-auto">
      <div className="text-center mb-12 space-y-3">
        <span className="text-xs font-bold uppercase tracking-[0.25em] text-accent">FAQ</span>
        <h2 className="font-bold text-3xl md:text-5xl text-foreground">Domande frequenti</h2>
      </div>
      <Accordion type="single" collapsible className="space-y-3">
        {FAQ.map((item, i) => (
          <AccordionItem key={i} value={`item-${i}`} className="border border-border/60 rounded-2xl bg-black/30 backdrop-blur-xl border border-white/10 px-5 data-[state=open]:border-accent/40 transition-colors">
            <AccordionTrigger className="text-left font-semibold text-base text-foreground hover:no-underline py-5 [&>svg]:text-accent">
              {item.q}
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground text-base leading-relaxed pb-5">
              {item.a}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}

// ── SiteFooter ───────────────────────────────────────────────────────────
export function SiteFooter() {
  return (
    <footer className="border-t border-border/40 bg-black/30 backdrop-blur mt-12">
      <div className="max-w-6xl mx-auto px-4 py-12 grid grid-cols-2 md:grid-cols-4 gap-8 text-sm">
        <div className="col-span-2 space-y-4">
          <a href="/"><img src={waydoraLogo} alt="Waydora" className="h-10 w-auto object-contain" /></a>
          <p className="text-muted-foreground max-w-sm leading-relaxed">
            Il tuo concierge di viaggio AI. Pianifica, prenota, parti — tutto in italiano.
          </p>
        </div>
        <div className="space-y-3">
          <div className="text-xs font-bold uppercase tracking-wider text-foreground">Legale</div>
          <ul className="space-y-2 text-muted-foreground">
            <li><a href="/legale/privacy" className="inline-flex items-center gap-2 hover:text-accent transition-colors"><FileText className="w-3.5 h-3.5" />Privacy Policy</a></li>
            <li><a href="/legale/termini" className="inline-flex items-center gap-2 hover:text-accent transition-colors"><FileText className="w-3.5 h-3.5" />Termini e Condizioni</a></li>
            <li><a href="/legale/cookie" className="inline-flex items-center gap-2 hover:text-accent transition-colors"><FileText className="w-3.5 h-3.5" />Cookie Policy</a></li>
          </ul>
        </div>
        <div className="space-y-3">
          <div className="text-xs font-bold uppercase tracking-wider text-foreground">Contatti</div>
          <ul className="space-y-2 text-muted-foreground">
            <li><a href="mailto:waydora.ai@gmail.com" className="inline-flex items-center gap-2 hover:text-accent transition-colors"><Mail className="w-3.5 h-3.5" />waydora.ai@gmail.com</a></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border/40 py-5 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Waydora — Travel simple, everywhere!
      </div>
    </footer>
  );
}

export function FaqChevron() {
  return <ChevronDown className="w-4 h-4" />;
}