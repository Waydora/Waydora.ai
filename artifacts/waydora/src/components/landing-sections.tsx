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
import { useGetStats } from "@workspace/api-client-react";

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
    city: "Milano",
    rating: 5,
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
    city: "Torino",
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

export function HowItWorks() {
  return (
    <section className="py-20 md:py-28 px-4 max-w-6xl mx-auto">
      <div className="text-center mb-14 space-y-3">
        <span className="text-xs font-bold uppercase tracking-[0.25em] text-accent">
          Come funziona
        </span>
        <h2 className="font-serif text-3xl md:text-5xl font-bold text-foreground">
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
              <Card className="h-full border-border/60 bg-card hover:border-accent/40 transition-colors">
                <CardContent className="p-7 space-y-4">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-accent/15 text-accent">
                    <Icon className="w-6 h-6" />
                  </div>
                  <div className="text-xs font-bold tracking-widest text-accent">
                    STEP {String(i + 1).padStart(2, "0")}
                  </div>
                  <h3 className="font-serif text-2xl font-bold text-foreground">
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

export function TripCounter() {
  const { data } = useGetStats();
  const count = data?.tripsPlanned ?? 12_847;
  const formatted = new Intl.NumberFormat("it-IT").format(count);

  return (
    <section className="py-16 px-4">
      <div className="max-w-4xl mx-auto text-center space-y-3">
        <div className="text-6xl md:text-8xl font-serif font-bold text-accent tracking-tight">
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
    <section className="py-14 px-4 border-y border-border/40 bg-card/40 backdrop-blur">
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
        <h2 className="font-serif text-3xl md:text-5xl font-bold text-foreground">
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
            <Card className="h-full border-border/60 bg-card">
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
        <h2 className="font-serif text-3xl md:text-5xl font-bold text-foreground">
          Domande frequenti
        </h2>
      </div>
      <Accordion type="single" collapsible className="space-y-3">
        {FAQ.map((item, i) => (
          <AccordionItem
            key={i}
            value={`item-${i}`}
            className="border border-border/60 rounded-2xl bg-card px-5 data-[state=open]:border-accent/40 transition-colors"
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
    <footer className="border-t border-border/40 bg-card/40 backdrop-blur mt-12">
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
