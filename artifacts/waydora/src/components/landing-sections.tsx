import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
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
    countries: 42
  }
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

export function HeroLanding() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % HERO_DESTINATIONS.length);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const currentDestination = HERO_DESTINATIONS[index];

  return (
    <section className="relative min-h-screen overflow-hidden bg-black text-white">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage:
            "url('https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=2070&auto=format&fit=crop')",
        }}
      />

      <div className="absolute inset-0 bg-black/45" />

      <header className="absolute top-0 left-0 right-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src={waydoraLogo}
              alt="Waydora"
              className="h-10 w-auto object-contain"
            />
          </div>

          <div className="flex items-center gap-3">
            <button className="px-5 py-2 rounded-full bg-white/10 backdrop-blur-xl border border-white/20 text-sm font-medium hover:bg-white/20 transition-all">
              Login
            </button>

            <button className="px-5 py-2 rounded-full bg-white text-black text-sm font-semibold hover:scale-105 transition-all">
              Registrati
            </button>
          </div>
        </div>
      </header>

      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="max-w-5xl"
        >
          <h1 className="text-5xl md:text-7xl font-bold leading-[0.95] tracking-tight mb-8">
            Ciao, sono Waydora.
            <br />
            <span className="text-white/80">
              Ti porto a {currentDestination}
            </span>
          </h1>

          <p className="text-lg md:text-2xl text-white/70 max-w-3xl mx-auto leading-relaxed mb-10">
            Il tuo assistente di viaggio AI personalizzato.
            Pianifica itinerari completi in pochi secondi.
          </p>

          <div className="max-w-4xl mx-auto bg-white/10 backdrop-blur-2xl border border-white/20 rounded-[32px] p-3 shadow-2xl">
            <div className="flex flex-col md:flex-row gap-3 items-center">
              <textarea
                placeholder="Descrivimi il tuo viaggio ideale! Inserisci luogo, numero di persone, durata e budget."
                className="flex-1 bg-transparent text-white placeholder:text-white/50 outline-none resize-none px-5 py-4 text-lg min-h-[70px]"
              />

              <button className="px-8 py-4 rounded-2xl bg-gradient-to-r from-orange-400 to-orange-500 text-white font-semibold hover:scale-105 transition-all shadow-xl whitespace-nowrap">
                Pianifica ✨
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

const HERO_DESTINATIONS = [
  "Tokyo",
  "Bali",
  "New York",
  "Lisbona",
  "Cefalù",
  "Parigi",
  "Marrakech",
  "Istanbul",
  "Santorini",
  "Madeira",
  "Seoul",
  "Dolomiti",
  "Londra",
  "Dubai",
  "Roma",
  "Napoli",
  "Tulum",
  "Budapest",
  "Vienna",
  "Thailandia",
];

export function HowItWorks() {
  return (
    <section className="py-20 md:py-28 px-4 max-w-6xl mx-auto">
      <div className="text-center mb-14 space-y-3">
        <span className="text-xs font-bold uppercase tracking-[0.25em] text-accent">
          Come funziona
        </span>
        <h2 className="font-bold tracking-tight text-3xl md:text-5xl font-bold text-foreground">
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
              className="relative"
            >
              <Card className="h-full border-border/60 bg-black/30 backdrop-blur-xl border border-white/10 hover:border-accent/40 transition-colors">
                <CardContent className="p-7 space-y-4">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-accent/15 text-accent">
                    <Icon className="w-6 h-6" />
                  </div>
                  <div className="text-xs font-bold tracking-widest text-accent">
                    STEP {String(i + 1).padStart(2, "0")}
                  </div>
                  <h3 className="font-bold tracking-tight text-2xl font-bold text-foreground">
                    {step.title}
                  </h3>
                  <p className="text-base text-muted-foreground leading-relaxed">
                    {step.text}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}

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
      const next = Math.round(fromRef.current + (target - fromRef.current) * eased);
      setValue(next);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  return value;
}

export function TripCounter() {
  const { data } = useGetStats({
    query: {
      refetchInterval: 12_000,
      refetchIntervalInBackground: false,
    } as never,
  });
  const target = data?.tripsPlanned ?? 12_847;
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
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent">
            in tempo reale
          </span>
        </div>
        <div className="text-6xl md:text-8xl font-bold tracking-tight font-bold text-accent tracking-tight tabular-nums">
          {formatted}
        </div>
        <p className="text-base md:text-lg uppercase tracking-[0.25em] font-bold text-muted-foreground">
          Viaggi pianificati con Waydora
        </p>
      </div>
    </section>
  );
}

export function Partners() {
  return (
    <section className="py-14 px-4 border-y border-border/40 bg-black/30 backdrop-blur-xl border border-white/10/40 backdrop-blur">
      <div className="max-w-6xl mx-auto">
        <p className="text-center text-xs font-bold uppercase tracking-[0.3em] text-muted-foreground mb-8">
          Prenoti con i migliori partner
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-6">
          {PARTNERS.map((p) => (
            <div
              key={p.name}
              className="text-xl md:text-2xl font-bold opacity-70 hover:opacity-100 transition-opacity"
              style={{ color: p.color }}
            >
              {p.name}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Reviews() {
  return (
    <section className="py-20 md:py-28 px-4 max-w-6xl mx-auto">
      <div className="text-center mb-14 space-y-3">
        <span className="text-xs font-bold uppercase tracking-[0.25em] text-accent">
          Cosa dicono i viaggiatori
        </span>
        <h2 className="font-bold tracking-tight text-3xl md:text-5xl font-bold text-foreground">
          Pianificato. Vissuto. Condiviso.
        </h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {REVIEWS.map((r, i) => (
          <motion.div
            key={r.name}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.08 }}
          >
            <Card className="h-full border-border/60 bg-black/30 backdrop-blur-xl border border-white/10">
              <CardContent className="p-6 space-y-4 flex flex-col h-full">
                <div className="flex gap-0.5">
                  {Array.from({ length: r.rating }).map((_, idx) => (
                    <Star key={idx} className="w-4 h-4 fill-accent text-accent" />
                  ))}
                </div>
                <p className="text-sm text-foreground leading-relaxed flex-1">
                  "{r.text}"
                </p>
                <div className="flex items-center gap-3 pt-2 border-t border-border/40">
                  <div className="w-10 h-10 rounded-full bg-accent/15 text-accent flex items-center justify-center font-bold text-sm">
                    {r.initials}
                  </div>
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

export function Faq() {
  return (
    <section className="py-20 md:py-28 px-4 max-w-3xl mx-auto">
      <div className="text-center mb-12 space-y-3">
        <span className="text-xs font-bold uppercase tracking-[0.25em] text-accent">
          FAQ
        </span>
        <h2 className="font-bold tracking-tight text-3xl md:text-5xl font-bold text-foreground">
          Domande frequenti
        </h2>
      </div>
      <Accordion type="single" collapsible className="space-y-3">
        {FAQ.map((item, i) => (
          <AccordionItem
            key={i}
            value={`item-${i}`}
            className="border border-border/60 rounded-2xl bg-black/30 backdrop-blur-xl border border-white/10 px-5 data-[state=open]:border-accent/40 transition-colors"
          >
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

export function SiteFooter() {
  return (
    <footer className="border-t border-border/40 bg-black/30 backdrop-blur-xl border border-white/10/40 backdrop-blur mt-12">
      <div className="max-w-6xl mx-auto px-4 py-12 grid grid-cols-2 md:grid-cols-4 gap-8 text-sm">
        <div className="col-span-2 md:col-span-2 space-y-4">
          <a href="/" className="inline-flex items-center">
            <img
              src={waydoraLogo}
              alt="Waydora"
              className="h-10 w-auto object-contain"
            />
          </a>
          <p className="text-muted-foreground max-w-sm leading-relaxed">
            Il tuo concierge di viaggio AI. Pianifica, prenota, parti — tutto in italiano.
          </p>
        </div>
        <div className="space-y-3">
          <div className="text-xs font-bold uppercase tracking-wider text-foreground">Legale</div>
          <ul className="space-y-2 text-muted-foreground">
            <li>
              <a href="/legale/privacy" className="inline-flex items-center gap-2 hover:text-accent transition-colors">
                <FileText className="w-3.5 h-3.5" />
                Privacy Policy
              </a>
            </li>
            <li>
              <a href="/legale/termini" className="inline-flex items-center gap-2 hover:text-accent transition-colors">
                <FileText className="w-3.5 h-3.5" />
                Termini e Condizioni
              </a>
            </li>
            <li>
              <a href="/legale/cookie" className="inline-flex items-center gap-2 hover:text-accent transition-colors">
                <FileText className="w-3.5 h-3.5" />
                Cookie Policy
              </a>
            </li>
          </ul>
        </div>
        <div className="space-y-3">
          <div className="text-xs font-bold uppercase tracking-wider text-foreground">Contatti</div>
          <ul className="space-y-2 text-muted-foreground">
            <li>
              <a href="mailto:waydora.ai@gmail.com" className="inline-flex items-center gap-2 hover:text-accent transition-colors">
                <Mail className="w-3.5 h-3.5" />
                waydora.ai@gmail.com
              </a>
            </li>
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
