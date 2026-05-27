import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare, Sparkles, PlaneTakeoff, Star,
  ChevronDown, Mail, FileText, Send,
  Compass, MapPin, Search, Wand2, Camera, Wallet,

} from "lucide-react";
import waydoraLogo from "@assets/LOGO1.png";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";

// ── Costanti ────────────────────────────────────────────────────────────

const STEPS = [
  { icon: MessageSquare, title: "Descrivi",  text: "Racconta a Waydora il tuo viaggio: dove, quando, con chi e con che vibe." },
  { icon: Sparkles,      title: "Pianifica", text: "L'AI genera un itinerario giornaliero su misura, con coordinate e meteo aggiornati." },
  { icon: PlaneTakeoff,  title: "Prenota",   text: "Voli, hotel, esperienze e ristoranti con un click tramite i nostri partner." },
];

const PARTNERS = [
  "Booking.com", "GetYourGuide", "Skyscanner", "Kiwi", "Stay22", "Go City", "Yesim", "Amazon",
];

const REVIEWS = [
  { name: "Giulia M.", city: "Padova",  rating: 4, text: "In 30 secondi avevo l'itinerario di 5 giorni in Marocco perfetto. Ho prenotato tutto direttamente dai link, niente da limare.", initials: "GM" },
  { name: "Marco R.",  city: "Roma",    rating: 5, text: "Volevo fuggire da Roma per un weekend a basso prezzo. Mi ha proposto Lubiana, l'ho amata. La mappa con le tappe è oro.", initials: "MR" },
  { name: "Sara B.",   city: "Pescara", rating: 5, text: "Ho aggiustato l'itinerario chattando come con un'amica esperta. Mi ha messo i ristoranti giusti e una cena vista mare a Cefalù.", initials: "SB" },
  { name: "Luca D.",   city: "Napoli",  rating: 5, text: "Lista bagaglio, link Booking, mappa interattiva: tutto in un posto. Lo uso prima di ogni partenza.", initials: "LD" },
];

const FAQ = [
  { q: "Waydora è gratuito?",                        a: "Sì, pianificare un itinerario con Waydora è completamente gratuito. Quando prenoti hotel o esperienze tramite i nostri link partner riceviamo una piccola commissione, senza nessun sovrapprezzo per te." },
  { q: "Posso modificare l'itinerario dopo averlo creato?", a: "Certo. Continua a chattare con Waydora per aggiungere giorni, cambiare destinazioni, ridurre il budget, aggiungere musei o ristoranti specifici. L'itinerario si aggiorna in tempo reale." },
  { q: "I link di prenotazione sono affidabili?",    a: "Usiamo solo partner ufficiali e affidabili come Booking.com, GetYourGuide, Skyscanner, Kiwi, Stay22, Go City, Yesim e Amazon. Le prenotazioni avvengono direttamente sui loro siti." },
  { q: "Posso condividere un itinerario con un amico?", a: "Sì, ogni itinerario salvato ha un link pubblico univoco che puoi condividere via WhatsApp, email o copiando l'URL. L'amico vede l'itinerario completo, mappa e lista bagaglio inclusi." },
  { q: "Funziona per viaggi di lavoro o solo per vacanze?", a: "Funziona per qualsiasi tipo di viaggio: business, weekend, luna di miele, viaggio di gruppo, viaggio con bambini. Più dettagli dai nella chat, più l'itinerario sarà su misura." },
];

const DESTINATIONS = [
  { name: "Tokyo",     photo: "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=1600&q=80&auto=format&fit=crop" },
  { name: "Bali",      photo: "https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=1600&q=80&auto=format&fit=crop" },
  { name: "New York",  photo: "https://images.unsplash.com/photo-1485871981521-5b1fd3805eee?w=1600&q=80&auto=format&fit=crop" },
  { name: "Lisbona",   photo: "https://images.unsplash.com/photo-1585208798174-6cedd86e019a?w=1600&q=80&auto=format&fit=crop" },
  { name: "Cefalù",    photo: "https://images.unsplash.com/photo-1742216564155-952ff4743a7f?w=1600&q=80&auto=format&fit=crop" },
  { name: "Parigi",    photo: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=1600&q=80&auto=format&fit=crop" },
  { name: "Marrakech", photo: "https://images.unsplash.com/photo-1579283135011-0974a412341a?w=1600&q=80&auto=format&fit=crop" },
  { name: "Istanbul",  photo: "https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?w=1600&q=80&auto=format&fit=crop" },
  { name: "Santorini", photo: "https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?w=1600&q=80&auto=format&fit=crop" },
  { name: "Seoul",     photo: "https://images.unsplash.com/photo-1538485399081-7191377e8241?w=1600&q=80&auto=format&fit=crop" },
  { name: "Dolomiti",  photo: "https://images.unsplash.com/photo-1551632811-561732d1e306?w=1600&q=80&auto=format&fit=crop" },
  { name: "Londra",    photo: "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=1600&q=80&auto=format&fit=crop" },
];

// ── Viaggi suggeriti (cliccabili → submit prompt) ────────────────────────
const SUGGESTED_TRIPS = [
  { dest: "Lisbona",  days: 4, vibe: "Vibe: Atlantico, tram e pastelli",   prompt: "Pianificami 4 giorni a Lisbona tra Belém, Alfama e una gita a Sintra",
    photo: "https://images.unsplash.com/photo-1585208798174-6cedd86e019a?w=1200&q=80&auto=format&fit=crop", tint: "warm" },
  { dest: "Tokyo",    days: 7, vibe: "Vibe: neon, ramen e ciliegi",        prompt: "Pianificami 7 giorni a Tokyo con un giorno a Kyoto",
    photo: "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=1200&q=80&auto=format&fit=crop", tint: "cool" },
  { dest: "Marrakech",days: 5, vibe: "Vibe: souk, deserto e tè alla menta", prompt: "Pianificami 5 giorni a Marrakech con un'escursione nel deserto",
    photo: "https://images.unsplash.com/photo-1579283135011-0974a412341a?w=1200&q=80&auto=format&fit=crop", tint: "warm" },
  { dest: "Santorini",days: 3, vibe: "Vibe: tramonti, cupole blu e Egeo",   prompt: "Pianificami 3 giorni a Santorini tra Oia, Fira e una crociera al tramonto",
    photo: "https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?w=1200&q=80&auto=format&fit=crop", tint: "cool" },
  { dest: "Dolomiti", days: 4, vibe: "Vibe: trekking, rifugi e laghi alpini",prompt: "Pianificami 4 giorni di trekking nelle Dolomiti con rifugi e laghi",
    photo: "https://images.unsplash.com/photo-1551632811-561732d1e306?w=1200&q=80&auto=format&fit=crop", tint: "cool" },
  { dest: "Bali",     days: 8, vibe: "Vibe: surf, riso e templi",           prompt: "Pianificami 8 giorni a Bali tra Ubud, Canggu e le Gili",
    photo: "https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=1200&q=80&auto=format&fit=crop", tint: "warm" },
];

// ── Roadmap "Come Waydora crea il tuo viaggio" ───────────────────────────
const ROADMAP = [
  { icon: MessageSquare, title: "1 · Tu racconti",        text: "Scrivi destinazione, durata, persone e budget. Anche in linguaggio naturale." },
  { icon: Search,        title: "2 · L'AI ricerca",       text: "Cerco i migliori spot, ristoranti, hotel e voli per la tua vibe." },
  { icon: Wand2,         title: "3 · Compongo l'itinerario", text: "Genero un piano giornaliero con orari, mappa e link di prenotazione." },
  { icon: Sparkles,      title: "4 · Tu personalizzi",    text: "Chatta con Waydora per modificare giorni, budget o stile fino a perfezione." },
];

// ── Stili condivisi ──────────────────────────────────────────────────────
// Glass più "delicato" — stesso look del bottone profilo nella header
const glassCard: React.CSSProperties = {
  background: "rgba(255,255,255,0.07)",
  backdropFilter: "blur(16px) saturate(140%)",
  WebkitBackdropFilter: "blur(16px) saturate(140%)",
  border: "1px solid rgba(255,255,255,0.14)",
  borderRadius: "22px",
  boxShadow: "0 6px 22px rgba(0,0,0,0.18)",
};

// ── Sfondo "Aurora Travel": blob di palette in movimento ─────────────────
function TravelBackground({ variant = "warm" }: { variant?: "warm" | "cool" | "mix" }) {
  // posizioni e colori cambiano in base al "tema" della sezione
  const blobs = variant === "warm"
    ? [
      { x: "-10%", y: "-15%", c: "var(--wd-blob-pink)",   s: "65vw" },
      { x: "60%",  y: "10%",  c: "var(--wd-blob-purple)", s: "55vw" },
      { x: "30%",  y: "70%",  c: "var(--wd-blob-indigo)", s: "60vw" },
    ]
    : variant === "cool"
    ? [
      { x: "70%",  y: "-10%", c: "var(--wd-blob-indigo)", s: "65vw" },
      { x: "-5%",  y: "30%",  c: "var(--wd-blob-purple)", s: "55vw" },
      { x: "40%",  y: "75%",  c: "var(--wd-blob-pink)",   s: "55vw" },
    ]
    : [
      { x: "-10%", y: "5%",  c: "var(--wd-blob-pink)",   s: "55vw" },
      { x: "65%",  y: "20%", c: "var(--wd-blob-indigo)", s: "55vw" },
      { x: "30%",  y: "75%", c: "var(--wd-blob-purple)", s: "60vw" },
    ];
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 0 }} aria-hidden>
      <div style={{ position: "absolute", inset: 0, background: "var(--wd-bg)" }} />
      {blobs.map((b, i) => (
        <div key={i} style={{
          position: "absolute", left: b.x, top: b.y, width: b.s, height: b.s,
          borderRadius: "50%", background: `radial-gradient(circle, ${b.c} 0%, transparent 68%)`,
          filter: "blur(70px)",
          animation: `wd-aurora-pan ${14 + i * 3}s ease-in-out infinite`,
          animationDelay: `${i * 1.5}s`,
        }} />
      ))}
    </div>
  );
}

function SectionWrapper({ children, variant = "mix", className }: { children: React.ReactNode; variant?: "warm" | "cool" | "mix"; className?: string }) {
  return (
    <div style={{ position: "relative", overflow: "hidden" }} className={className}>
      <TravelBackground variant={variant} />
      <div style={{ position: "relative", zIndex: 1 }}>{children}</div>
    </div>
  );
}

// ── Typewriter ───────────────────────────────────────────────────────────
function TypewriterDestination({ text }: { text: string }) {
  const [displayed, setDisplayed] = useState("");
  const [typing, setTyping] = useState(true);
  useEffect(() => {
    setDisplayed(""); setTyping(true);
    let i = 0;
    const iv = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) { clearInterval(iv); setTyping(false); }
    }, 70);
    return () => clearInterval(iv);
  }, [text]);
  return (
    <span className="inline-block">
      <span className="font-bold" style={{ color: "#ffffff" }}>{displayed}</span>
      {typing && (
        <span className="inline-block w-[3px] h-[0.85em] align-middle ml-0.5 rounded-sm"
          style={{ background: "#fff", animation: "wd-blink 0.7s step-end infinite" }} />
      )}
    </span>
  );
}

// ── HeroLanding (con parallax) ───────────────────────────────────────────
interface HeroLandingProps {
  onSubmit: (prompt: string) => void;
  isPending?: boolean;
}

export function HeroLanding({ onSubmit, isPending }: HeroLandingProps) {
  const [destIndex, setDestIndex] = useState(0);
  const [bgSrc, setBgSrc]         = useState(DESTINATIONS[0].photo);
  const [bgKey, setBgKey]         = useState(0);
  const [input, setInput]         = useState("");
  const [isMultiline, setIsMultiline] = useState(false);
  const [parallaxY, setParallaxY] = useState(0);
  const textareaRef               = useRef<HTMLTextAreaElement>(null);

  const currentDest = DESTINATIONS[destIndex];

  useEffect(() => {
    const img = new Image();
    img.src = currentDest.photo;
    const apply = () => { setBgSrc(currentDest.photo); setBgKey((k) => k + 1); };
    if (img.complete) apply(); else { img.onload = apply; img.onerror = apply; }
  }, [currentDest.photo]);

  useEffect(() => {
    const t = setInterval(() => setDestIndex((p) => (p + 1) % DESTINATIONS.length), 4500);
    return () => clearInterval(t);
  }, []);

  // Parallax: muove l'immagine hero a velocità ridotta sullo scroll.
  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        setParallaxY(Math.min(window.scrollY * 0.35, 240));
        raf = 0;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); if (raf) cancelAnimationFrame(raf); };
  }, []);

  const handleSubmit = useCallback(() => {
    if (!input.trim() || isPending) return;
    onSubmit(input.trim());
  }, [input, isPending, onSubmit]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const ta = e.target;
    ta.style.height = "auto";
    const next = Math.min(ta.scrollHeight, 120);
    ta.style.height = next + "px";
    setIsMultiline(next > 46);
  };

  const active = input.trim() && !isPending;

  return (
    <section className="relative min-h-screen flex flex-col overflow-hidden">
      <div className="absolute inset-0" style={{ background: "#0a0a12" }}>
        <AnimatePresence mode="sync">
          <motion.div
            key={bgKey}
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${bgSrc})`, transform: `translate3d(0, ${parallaxY}px, 0) scale(1.08)`, transformOrigin: "center" }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 1.4, ease: "easeInOut" }}
          />
        </AnimatePresence>
        {/* Overlay caldo: gradient travel tinge tutta l'immagine */}
        <div className="absolute inset-0" style={{
          background: "linear-gradient(160deg, rgba(255,95,109,0.45) 0%, rgba(255,126,95,0.25) 35%, rgba(78,168,222,0.30) 75%, rgba(8,12,32,0.65) 100%)",
        }} />
        <div className="absolute inset-0" style={{
          background: "linear-gradient(to bottom,rgba(0,0,0,0.18) 0%,rgba(0,0,0,0.05) 40%,rgba(0,0,0,0.55) 100%)",
        }} />
      </div>

      {/* Spacer per header sticky */}
      <div className="relative z-10" style={{ minHeight: "64px" }} aria-hidden />

      {/* Contenuto */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 pb-24 pt-2">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}
          className="text-center mb-10 max-w-3xl">
          <p style={{ color: "rgba(255,255,255,0.7)", fontSize: "11px", fontWeight: 700, letterSpacing: "0.32em", textTransform: "uppercase", marginBottom: "20px" }}>
            ✦ La tua assistente di viaggio AI
          </p>
          <h1 className="font-black leading-[1.05] mb-5"
            style={{ color: "#fff", fontSize: "clamp(1.9rem, 4.4vw, 3rem)", letterSpacing: "-0.03em", textShadow: "0 4px 28px rgba(0,0,0,0.35)" }}>
            Ciao, sono Waydora:<br />la tua assistente di viaggio.
          </h1>
          <p className="font-light"
            style={{ color: "rgba(255,255,255,0.78)", fontSize: "clamp(1.25rem, 2.8vw, 1.9rem)", letterSpacing: "-0.01em", textShadow: "0 2px 12px rgba(0,0,0,0.3)" }}>
            Oggi ti porto a <TypewriterDestination text={currentDest.name} />
          </p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 0.18 }}
          className="w-full max-w-2xl">
          <div className="flex items-end gap-2 px-3 py-2" style={{
            background: "rgba(255,255,255,0.18)",
            backdropFilter: "blur(28px) saturate(160%)",
            WebkitBackdropFilter: "blur(28px) saturate(160%)",
            border: "1px solid rgba(255,255,255,0.28)",
            borderRadius: isMultiline ? "22px" : "9999px",
            boxShadow: "0 8px 40px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.18)",
            transition: "border-radius 0.18s ease",
          }}>
            <textarea ref={textareaRef} value={input} onChange={handleChange} onKeyDown={handleKeyDown}
              placeholder="Dove vuoi andare? Descrivi il tuo viaggio..." rows={1}
              className="flex-1 bg-transparent resize-none outline-none border-none text-white placeholder:text-white/55 text-[15px] leading-relaxed"
              style={{ minHeight: "38px", maxHeight: "120px", paddingLeft: "14px", paddingTop: "9px", paddingBottom: "9px", minWidth: "0", overflowY: "auto" }} />
            <button onClick={handleSubmit} disabled={!active}
              className={active ? "wd-travel-btn" : ""}
              style={{
                flexShrink: 0, display: "inline-flex", alignItems: "center", gap: "6px",
                fontWeight: 700, fontSize: "14px", color: "#fff",
                background: active ? undefined : "rgba(0,0,0,0.42)",
                borderRadius: "9999px", padding: "10px 20px", border: "none",
                cursor: active ? "pointer" : "not-allowed",
                transform: active ? "scale(1)" : "scale(0.96)", whiteSpace: "nowrap",
                transition: "transform 0.18s ease",
              } as React.CSSProperties}>
              {isPending
                ? <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full" style={{ animation: "wd-spin 0.8s linear infinite" }} />Pianificando...</>
                : <>Pianifica <span>✨</span></>}
            </button>
          </div>
          <p className="text-center text-xs mt-3" style={{ color: "rgba(255,255,255,0.55)" }}>
            Premi Invio per pianificare — Shift+Invio per andare a capo
          </p>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="flex gap-2 mt-8">
          {DESTINATIONS.map((_, i) => (
            <button key={i} onClick={() => setDestIndex(i)} aria-label={`Vai a ${DESTINATIONS[i].name}`}
              style={{
                width: i === destIndex ? "22px" : "6px", height: "6px", borderRadius: "9999px",
                background: i === destIndex ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.42)",
                border: "none", padding: 0, cursor: "pointer",
                transition: "width 0.35s ease, background 0.35s ease",
              }} />
          ))}
        </motion.div>

        {/* Indicatore scroll */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }}
          style={{ position: "absolute", bottom: "18px", left: "50%", transform: "translateX(-50%)", display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", color: "rgba(255,255,255,0.55)" }}>
          <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.25em", textTransform: "uppercase" }}>Scorri</span>
          <ChevronDown style={{ width: "16px", height: "16px", animation: "wd-float 2s ease-in-out infinite" }} />
        </motion.div>
      </div>

      <style>{`
        @keyframes wd-blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes wd-spin  { to{transform:rotate(360deg)} }
      `}</style>
    </section>
  );
}

// ── Sezione: WorldGallery — marquee infinito di foto destinazioni ────────
const WORLD_PHOTOS = [
  { src: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=900&q=70&auto=format&fit=crop",      label: "Parigi"     },
  { src: "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=900&q=70&auto=format&fit=crop",      label: "Tokyo"      },
  { src: "https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?w=900&q=70&auto=format&fit=crop",      label: "Santorini"  },
  { src: "https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=900&q=70&auto=format&fit=crop",      label: "Bali"       },
  { src: "https://images.unsplash.com/photo-1485871981521-5b1fd3805eee?w=900&q=70&auto=format&fit=crop",      label: "New York"   },
  { src: "https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?w=900&q=70&auto=format&fit=crop",      label: "Istanbul"   },
  { src: "https://images.unsplash.com/photo-1579283135011-0974a412341a?w=900&q=70&auto=format&fit=crop",      label: "Marrakech"  },
  { src: "https://images.unsplash.com/photo-1518684079-3c830dcef090?w=900&q=70&auto=format&fit=crop",        label: "Dubai"      },
  { src: "https://images.unsplash.com/photo-1551632811-561732d1e306?w=900&q=70&auto=format&fit=crop",        label: "Dolomiti"   },
  { src: "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=900&q=70&auto=format&fit=crop",      label: "Londra"     },
  { src: "https://images.unsplash.com/photo-1742216564155-952ff4743a7f?w=900&q=70&auto=format&fit=crop",      label: "Cefalù"     },
  { src: "https://images.unsplash.com/photo-1585208798174-6cedd86e019a?w=900&q=70&auto=format&fit=crop",      label: "Lisbona"    },
  { src: "https://images.unsplash.com/photo-1538485399081-7191377e8241?w=900&q=70&auto=format&fit=crop",      label: "Seoul"      },
  { src: "https://images.unsplash.com/photo-1565426873118-a17ed65d74b9?w=900&q=70&auto=format&fit=crop",      label: "Budapest"   },
];

function MarqueeRow({ items, direction = "left", speed = 50 }: { items: typeof WORLD_PHOTOS; direction?: "left" | "right"; speed?: number }) {
  // Render del doppio set per ottenere loop senza salti
  const doubled = [...items, ...items];
  return (
    <div style={{ overflow: "hidden", width: "100%", maskImage: "linear-gradient(to right, transparent 0%, black 6%, black 94%, transparent 100%)", WebkitMaskImage: "linear-gradient(to right, transparent 0%, black 6%, black 94%, transparent 100%)" }}>
      <div style={{
        display: "flex", gap: "16px", width: "max-content",
        animation: `${direction === "left" ? "wd-marquee-left" : "wd-marquee-right"} ${speed}s linear infinite`,
      }}>
        {doubled.map((p, i) => (
          <div key={i} style={{
            position: "relative", width: "220px", height: "280px", flexShrink: 0,
            borderRadius: "18px", overflow: "hidden",
            boxShadow: "var(--wd-shadow-card)",
            border: "1px solid var(--wd-border-10)",
          }}>
            <img src={p.src} alt={p.label} loading="lazy"
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, transparent 50%, rgba(8,12,32,0.78) 100%)" }} />
            <div style={{ position: "absolute", left: "14px", bottom: "12px", display: "inline-flex", alignItems: "center", gap: "6px", padding: "5px 12px", borderRadius: "9999px", background: "rgba(255,255,255,0.18)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: "1px solid rgba(255,255,255,0.28)", color: "#fff", fontSize: "12px", fontWeight: 700, letterSpacing: "0.04em" }}>
              <MapPin style={{ width: "11px", height: "11px" }} />{p.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function WorldGallery() {
  return (
    <SectionWrapper variant="mix">
      <section className="py-20 md:py-28">
        <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="text-center mb-12 px-4">
          <span style={{
            display: "inline-flex", alignItems: "center", gap: "6px",
            padding: "6px 14px", borderRadius: "9999px",
            background: "rgba(var(--wd-sky-rgb),0.12)", border: "1px solid rgba(var(--wd-sky-rgb),0.32)",
            color: "var(--wd-sky)", fontSize: "11px", fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", marginBottom: "20px",
          }}>
            ✈️ Il mondo in un battito
          </span>
          <h2 className="font-black leading-tight" style={{ fontSize: "clamp(2rem, 5vw, 3.2rem)", letterSpacing: "-0.025em", color: "var(--wd-text)" }}>
            Da Tokyo a Lisbona,<br /><span className="wd-travel-text">tutto in una chat.</span>
          </h2>
          <p style={{ marginTop: "12px", color: "var(--wd-text-55)", fontSize: "15px", maxWidth: "560px", marginInline: "auto", lineHeight: 1.65 }}>
            Più di 200 destinazioni, una sola assistente. Lasciati cullare da queste foto e scegli la prossima.
          </p>
        </motion.div>

        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <MarqueeRow items={WORLD_PHOTOS}            direction="left"  speed={55} />
          <MarqueeRow items={[...WORLD_PHOTOS].reverse()} direction="right" speed={68} />
        </div>

        <style>{`
          @keyframes wd-marquee-left  { from { transform: translateX(0); } to { transform: translateX(-50%); } }
          @keyframes wd-marquee-right { from { transform: translateX(-50%); } to { transform: translateX(0); } }
          @media (prefers-reduced-motion: reduce) {
            [style*="wd-marquee-left"], [style*="wd-marquee-right"] { animation-play-state: paused !important; }
          }
        `}</style>
      </section>
    </SectionWrapper>
  );
}

// ── Sezione: AppShowcase — funzionalità webapp su sfondi di luoghi reali ─
const SHOWCASE_FEATURES = [
  {
    icon: MapPin,
    title: "Mappa interattiva",
    text: "Tutte le tappe del viaggio in una mappa Google con percorsi e pin colorati.",
    bg: "https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?w=1400&q=80&auto=format&fit=crop",
    mockup: "map",
    accent: "var(--wd-sky)",
    accent2: "var(--wd-sea)",
  },
  {
    icon: Wand2,
    title: "Itinerario giornaliero",
    text: "Orari, attività, ristoranti e budget — un giorno alla volta, con un clic puoi modificare tutto.",
    bg: "https://images.unsplash.com/photo-1485871981521-5b1fd3805eee?w=1400&q=80&auto=format&fit=crop",
    mockup: "itinerary",
    accent: "var(--wd-coral)",
    accent2: "var(--wd-sun)",
  },
  {
    icon: Camera,
    title: "Lista bagaglio smart",
    text: "Genera la lista perfetta in base a meteo e attività. Link Amazon integrati per ciò che ti manca.",
    bg: "https://images.unsplash.com/photo-1551632811-561732d1e306?w=1400&q=80&auto=format&fit=crop",
    mockup: "packing",
    accent: "var(--wd-sun)",
    accent2: "var(--wd-coral)",
  },
  {
    icon: Wallet,
    title: "Prenotazioni in un clic",
    text: "Hotel, voli, esperienze, pass turistici e bagaglio — link diretti per Booking, Skyscanner, GetYourGuide, Go City e Amazon dentro ogni attività dell'itinerario.",
    bg: "https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?w=1400&q=80&auto=format&fit=crop",
    mockup: "booking",
    accent: "var(--wd-pink)",
    accent2: "var(--wd-sky)",
  },
];

function ShowcaseMockup({ kind, accent }: { kind: string; accent: string }) {
  // Mini-mockup HTML stilizzato, in stile "wireframe" — niente screenshot reali
  if (kind === "map") {
    return (
      <div style={{ position: "relative", borderRadius: "12px", height: "100%", overflow: "hidden", background: "linear-gradient(135deg, #0c1330, #1a2654)" }}>
        {/* Pin route */}
        <svg viewBox="0 0 200 130" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
          <path d="M20 100 Q 60 50, 100 80 T 180 35" stroke={accent} strokeWidth="2.4" fill="none" strokeDasharray="5,5" />
          {[ [20,100], [70,60], [110,80], [150,55], [180,35] ].map(([x,y], i) => (
            <g key={i}>
              <circle cx={x} cy={y} r="6" fill={accent} />
              <circle cx={x} cy={y} r="11" fill={accent} opacity="0.25" />
            </g>
          ))}
        </svg>
        <div style={{ position: "absolute", left: "10px", bottom: "10px", padding: "5px 10px", borderRadius: "9999px", background: "rgba(255,255,255,0.18)", backdropFilter: "blur(8px)", color: "#fff", fontSize: "10px", fontWeight: 700 }}>5 tappe · 12 km</div>
      </div>
    );
  }
  if (kind === "itinerary") {
    return (
      <div style={{ padding: "12px", display: "flex", flexDirection: "column", gap: "8px", height: "100%", background: "rgba(255,255,255,0.06)" }}>
        {["09:00 Colosseo", "12:30 Trattoria Da Enzo", "15:00 Galleria Borghese", "20:00 Aperitivo Trastevere"].map((line, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "11px", color: "#fff" }}>
            <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: accent, flexShrink: 0 }} />
            <span style={{ background: "rgba(255,255,255,0.08)", padding: "5px 10px", borderRadius: "8px", flex: 1 }}>{line}</span>
          </div>
        ))}
      </div>
    );
  }
  if (kind === "packing") {
    return (
      <div style={{ padding: "12px", display: "flex", flexDirection: "column", gap: "6px", height: "100%", background: "rgba(255,255,255,0.06)" }}>
        {["✓ Scarpe da trekking", "✓ Crema solare SPF 50", "○ Power bank 20.000mAh", "○ Borraccia termica", "○ Giacca antipioggia"].map((line, i) => (
          <div key={i} style={{ fontSize: "11px", color: i < 2 ? "rgba(255,255,255,0.5)" : "#fff", textDecoration: i < 2 ? "line-through" : "none" }}>
            {line}
          </div>
        ))}
      </div>
    );
  }
  // booking — mockup di una card attività reale (come appare nella chat)
  const items = [
    { icon: "🏨", label: "Hotel a Roma",         provider: "Booking",      cta: "Prenota" },
    { icon: "✈️", label: "Voli Milano → Lisbona", provider: "Skyscanner",   cta: "Cerca" },
    { icon: "🎟️", label: "Tour Colosseo skip-line", provider: "GetYourGuide", cta: "Prenota" },
  ];
  return (
    <div style={{ padding: "10px", display: "flex", flexDirection: "column", gap: "6px", height: "100%", background: "rgba(255,255,255,0.06)" }}>
      {items.map((it, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px", background: "rgba(255,255,255,0.09)", borderRadius: "8px", padding: "7px 9px" }}>
          <span style={{ fontSize: "14px" }}>{it.icon}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: "10px", fontWeight: 700, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.label}</div>
            <div style={{ fontSize: "8px", color: "rgba(255,255,255,0.55)", textTransform: "uppercase", letterSpacing: "0.05em" }}>via {it.provider}</div>
          </div>
          <span style={{ fontSize: "9px", fontWeight: 800, padding: "3px 8px", borderRadius: "9999px", background: accent, color: "#fff", flexShrink: 0 }}>{it.cta}</span>
        </div>
      ))}
    </div>
  );
}

export function AppShowcase() {
  return (
    <SectionWrapper variant="warm">
      <section className="py-20 md:py-28 px-4 max-w-6xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="text-center mb-14">
          <span style={{
            display: "inline-flex", alignItems: "center", gap: "6px",
            padding: "6px 14px", borderRadius: "9999px",
            background: "rgba(var(--wd-pink-rgb),0.12)", border: "1px solid rgba(var(--wd-pink-rgb),0.32)",
            color: "var(--wd-pink)", fontSize: "11px", fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", marginBottom: "20px",
          }}>
            ✦ Dentro la webapp
          </span>
          <h2 className="font-black leading-tight" style={{ fontSize: "clamp(2rem, 5vw, 3.2rem)", letterSpacing: "-0.025em", color: "var(--wd-text)" }}>
            Tutto quello che ti serve<br /><span className="wd-travel-text">per viaggiare spensierato.</span>
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {SHOWCASE_FEATURES.map((f, i) => {
            const Icon = f.icon;
            return (
              <motion.div key={f.title} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                whileHover={{ y: -6 }}
                style={{
                  position: "relative", borderRadius: "22px", overflow: "hidden",
                  border: "1px solid var(--wd-border-10)",
                  boxShadow: "var(--wd-shadow-card)",
                  minHeight: "340px",
                  display: "flex", flexDirection: "column",
                }}>
                {/* sfondo foto */}
                <div style={{
                  position: "absolute", inset: 0,
                  backgroundImage: `url(${f.bg})`, backgroundSize: "cover", backgroundPosition: "center",
                }} />
                <div style={{ position: "absolute", inset: 0, background: `linear-gradient(160deg, rgba(8,12,32,0.45) 0%, rgba(8,12,32,0.75) 100%)` }} />

                {/* contenuto */}
                <div style={{ position: "relative", padding: "22px", display: "flex", flexDirection: "column", gap: "16px", flex: 1, color: "#fff" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{
                      width: "44px", height: "44px", borderRadius: "14px",
                      background: `linear-gradient(135deg, ${f.accent}, ${f.accent2})`,
                      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                      boxShadow: `0 8px 24px ${f.accent}55, 0 2px 8px ${f.accent2}33`,
                    }}>
                      <Icon style={{ width: "20px", height: "20px", color: "#fff" }} />
                    </div>
                    <h3 style={{ fontSize: "1.25rem", fontWeight: 800, letterSpacing: "-0.015em" }}>{f.title}</h3>
                  </div>
                  <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.85)", lineHeight: 1.6 }}>{f.text}</p>
                  {/* mini mockup */}
                  <div style={{
                    marginTop: "auto",
                    background: "rgba(8,12,32,0.78)",
                    backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: "14px", overflow: "hidden",
                    height: "130px",
                  }}>
                    <ShowcaseMockup kind={f.mockup} accent={f.accent} />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>
    </SectionWrapper>
  );
}

// ── Sezione: Viaggi suggeriti ────────────────────────────────────────────
export function SuggestedTrips({ onSelect }: { onSelect: (prompt: string) => void }) {
  return (
    <SectionWrapper variant="warm">
      <section className="py-20 md:py-28 px-4 max-w-6xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="text-center mb-12">
          <span style={{
            display: "inline-flex", alignItems: "center", gap: "6px",
            padding: "6px 14px", borderRadius: "9999px",
            background: "rgba(var(--wd-coral-rgb),0.12)", border: "1px solid rgba(var(--wd-coral-rgb),0.32)",
            color: "var(--wd-coral)", fontSize: "11px", fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", marginBottom: "20px",
          }}>
            <Compass style={{ width: "12px", height: "12px" }} /> Lasciati ispirare
          </span>
          <h2 className="font-black leading-tight" style={{ fontSize: "clamp(2rem, 5vw, 3.2rem)", letterSpacing: "-0.025em", color: "var(--wd-text)" }}>
            Viaggi pronti<br /><span className="wd-travel-text">da prenotare.</span>
          </h2>
          <p style={{ marginTop: "14px", color: "var(--wd-text-55)", fontSize: "15px", maxWidth: "520px", marginInline: "auto", lineHeight: 1.65 }}>
            Tocca un viaggio: Waydora apre la chat e prepara l'itinerario in pochi secondi.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {SUGGESTED_TRIPS.map((t, i) => (
            <motion.button key={t.dest} type="button" onClick={() => onSelect(t.prompt)}
              initial={{ opacity: 0, y: 22 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              transition={{ delay: i * 0.07 }}
              whileHover={{ y: -6 }}
              style={{
                position: "relative", overflow: "hidden", borderRadius: "22px",
                border: "1px solid var(--wd-border-10)",
                aspectRatio: "4/5", cursor: "pointer", padding: 0,
                background: "var(--wd-bg2)",
                boxShadow: "var(--wd-shadow-card)",
                textAlign: "left",
              }}>
              <div style={{
                position: "absolute", inset: 0,
                backgroundImage: `url(${t.photo})`, backgroundSize: "cover", backgroundPosition: "center",
                transition: "transform 0.6s ease",
              }} className="trip-photo" />
              <div style={{
                position: "absolute", inset: 0,
                background: t.tint === "warm"
                  ? "linear-gradient(180deg, rgba(0,0,0,0.05) 0%, rgba(255,95,109,0.20) 55%, rgba(8,12,32,0.78) 100%)"
                  : "linear-gradient(180deg, rgba(0,0,0,0.05) 0%, rgba(78,168,222,0.22) 55%, rgba(8,12,32,0.80) 100%)",
              }} />
              <div style={{ position: "relative", height: "100%", display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: "22px 22px 20px", color: "#fff" }}>
                <div style={{ display: "inline-flex", alignSelf: "flex-start", alignItems: "center", gap: "5px", fontSize: "11px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", padding: "5px 11px", borderRadius: "9999px", background: "rgba(255,255,255,0.18)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: "1px solid rgba(255,255,255,0.28)", marginBottom: "12px" }}>
                  <MapPin style={{ width: "11px", height: "11px" }} />{t.days} giorni
                </div>
                <h3 style={{ fontSize: "26px", fontWeight: 900, letterSpacing: "-0.02em", lineHeight: 1.1, marginBottom: "6px" }}>{t.dest}</h3>
                <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.85)", fontWeight: 500 }}>{t.vibe}</p>
                <span style={{ marginTop: "14px", display: "inline-flex", alignSelf: "flex-start", alignItems: "center", gap: "5px", fontSize: "12px", fontWeight: 700, padding: "8px 14px", borderRadius: "9999px", background: "rgba(255,255,255,0.95)", color: "#15263d" }}>
                  Pianifica con AI <Sparkles style={{ width: "12px", height: "12px" }} />
                </span>
              </div>
            </motion.button>
          ))}
        </div>

        <style>{`
          button:hover .trip-photo { transform: scale(1.06); }
        `}</style>
      </section>
    </SectionWrapper>
  );
}

// ── Sezione: Roadmap AI animata su scroll ────────────────────────────────
export function AnimatedRoadmap() {
  return (
    <SectionWrapper variant="cool">
      <section className="py-20 md:py-28 px-4 max-w-5xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="text-center mb-14">
          <span style={{
            display: "inline-flex", alignItems: "center", gap: "6px",
            padding: "6px 14px", borderRadius: "9999px",
            background: "rgba(var(--wd-sky-rgb),0.12)", border: "1px solid rgba(var(--wd-sky-rgb),0.32)",
            color: "var(--wd-sky)", fontSize: "11px", fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", marginBottom: "20px",
          }}>
            <Wand2 style={{ width: "12px", height: "12px" }} /> Come funziona l'AI
          </span>
          <h2 className="font-black leading-tight" style={{ fontSize: "clamp(2rem, 5vw, 3.2rem)", letterSpacing: "-0.025em", color: "var(--wd-text)" }}>
            Il tuo viaggio,<br /><span className="wd-travel-text">passo dopo passo.</span>
          </h2>
        </motion.div>

        {/* Timeline verticale con linea gradient */}
        <div style={{ position: "relative" }}>
          <div style={{
            position: "absolute", left: "28px", top: "10px", bottom: "10px", width: "3px",
            background: "var(--wd-grad-travel)", backgroundSize: "100% 200%",
            borderRadius: "9999px", opacity: 0.55,
            animation: "wd-grad-shift 10s ease infinite",
          }} aria-hidden />
          <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
            {ROADMAP.map((step, i) => {
              const Icon = step.icon;
              return (
                <motion.div key={step.title}
                  initial={{ opacity: 0, x: -28 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, margin: "-80px" }}
                  transition={{ duration: 0.55, delay: i * 0.08 }}
                  style={{ position: "relative", paddingLeft: "78px" }}>
                  <div style={{
                    position: "absolute", left: 0, top: "6px",
                    width: "58px", height: "58px", borderRadius: "50%",
                    background: "var(--wd-grad-warm)", backgroundSize: "200% 200%",
                    animation: "wd-grad-shift 8s ease infinite",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "#fff",
                    boxShadow: "var(--wd-shadow-strong)",
                    border: "3px solid var(--wd-bg)",
                  }}>
                    <Icon style={{ width: "22px", height: "22px" }} />
                  </div>
                  <div style={{ ...glassCard, padding: "22px 24px" }}>
                    <h3 style={{ fontSize: "1.2rem", fontWeight: 800, color: "var(--wd-text)", marginBottom: "6px", letterSpacing: "-0.015em" }}>{step.title}</h3>
                    <p style={{ fontSize: "14.5px", color: "var(--wd-text-65)", lineHeight: 1.65 }}>{step.text}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>
    </SectionWrapper>
  );
}

// ── HowItWorks (restyle palette travel) ──────────────────────────────────
export function HowItWorks() {
  return (
    <SectionWrapper variant="warm">
      <section className="py-24 md:py-32 px-4 max-w-6xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="text-center mb-16">
          <span style={{
            display: "inline-block", padding: "6px 16px", borderRadius: "9999px",
            background: "rgba(var(--wd-coral-rgb),0.12)", border: "1px solid rgba(var(--wd-coral-rgb),0.32)",
            color: "var(--wd-coral)", fontSize: "11px", fontWeight: 700, letterSpacing: "0.25em", textTransform: "uppercase", marginBottom: "24px",
          }}>
            ✦ In 3 mosse
          </span>
          <h2 className="font-black text-center leading-tight" style={{ fontSize: "clamp(2rem, 5vw, 3.5rem)", letterSpacing: "-0.025em", color: "var(--wd-text)" }}>
            Tre passi al tuo<br /><span className="wd-travel-text">prossimo viaggio.</span>
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            const accent = ["var(--wd-coral)", "var(--wd-sun)", "var(--wd-sky)"][i] ?? "var(--wd-coral)";
            return (
              <motion.div key={step.title} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.12 }}>
                <div style={{ ...glassCard, padding: "32px", height: "100%" }}>
                  <div style={{
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    width: "52px", height: "52px", borderRadius: "16px", marginBottom: "20px",
                    background: `linear-gradient(135deg, ${accent}, var(--wd-pink))`,
                    color: "#fff",
                    boxShadow: "var(--wd-shadow-strong)",
                  }}>
                    <Icon style={{ width: "22px", height: "22px" }} />
                  </div>
                  <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.2em", color: accent, marginBottom: "12px" }}>
                    STEP {String(i + 1).padStart(2, "0")}
                  </div>
                  <h3 style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--wd-text)", marginBottom: "12px", letterSpacing: "-0.02em" }}>
                    {step.title}
                  </h3>
                  <p style={{ fontSize: "15px", color: "var(--wd-text-65)", lineHeight: 1.7 }}>{step.text}</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>
    </SectionWrapper>
  );
}

// ── TripCounter ──────────────────────────────────────────────────────────
function useAnimatedNumber(target: number, durationMs = 1400) {
  const [value, setValue] = useState(target);
  const fromRef  = useRef(target);
  const startRef = useRef<number | null>(null);
  const rafRef   = useRef<number | null>(null);
  useEffect(() => {
    if (target === value) return;
    fromRef.current = value; startRef.current = null;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const tick = (now: number) => {
      if (!startRef.current) startRef.current = now;
      const t = Math.min(1, (now - startRef.current) / durationMs);
      setValue(Math.round(fromRef.current + (target - fromRef.current) * (1 - Math.pow(1 - t, 3))));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [target]);
  return value;
}

export function TripCounter() {
  const target    = 12_847;
  const animated  = useAnimatedNumber(target);
  const formatted = new Intl.NumberFormat("it-IT").format(animated);

  return (
    <SectionWrapper variant="mix">
      <section className="py-20 px-4">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="max-w-4xl mx-auto text-center">
          <div style={{
            display: "inline-flex", alignItems: "center", gap: "8px",
            padding: "6px 14px", borderRadius: "9999px",
            background: "rgba(var(--wd-sea-rgb),0.12)", border: "1px solid rgba(var(--wd-sea-rgb),0.30)",
            marginBottom: "24px",
          }}>
            <span style={{ position: "relative", display: "flex", width: "8px", height: "8px" }}>
              <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "var(--wd-sea)", animation: "wd-ping 1.2s cubic-bezier(0,0,0.2,1) infinite", opacity: 0.6 }} />
              <span style={{ position: "relative", borderRadius: "50%", width: "8px", height: "8px", background: "var(--wd-sea)" }} />
            </span>
            <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--wd-sea)" }}>
              in tempo reale
            </span>
          </div>

          <div className="wd-travel-text" style={{ fontSize: "clamp(4rem, 12vw, 8rem)", fontWeight: 900, lineHeight: 1, letterSpacing: "-0.04em", marginBottom: "16px" }}>
            {formatted}
          </div>

          <p style={{ fontSize: "clamp(0.85rem, 2vw, 1.1rem)", fontWeight: 700, letterSpacing: "0.25em", textTransform: "uppercase", color: "var(--wd-text-45)" }}>
            Viaggi pianificati con Waydora
          </p>
        </motion.div>
      </section>

      <style>{`@keyframes wd-ping{75%,100%{transform:scale(2);opacity:0}}`}</style>
    </SectionWrapper>
  );
}

// ── Partners ─────────────────────────────────────────────────────────────
export function Partners() {
  return (
    <SectionWrapper variant="warm">
      <section className="py-14 px-4" style={{ borderTop: "1px solid var(--wd-border-7)", borderBottom: "1px solid var(--wd-border-7)" }}>
        <div className="max-w-6xl mx-auto">
          <p style={{ textAlign: "center", fontSize: "11px", fontWeight: 700, letterSpacing: "0.3em", textTransform: "uppercase", color: "var(--wd-text-45)", marginBottom: "32px" }}>
            Prenoti con i migliori partner
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-6">
            {PARTNERS.map((name) => (
              <div key={name}
                style={{ fontSize: "clamp(1rem, 2vw, 1.25rem)", fontWeight: 800, color: "var(--wd-text-35)", letterSpacing: "-0.01em", transition: "color 0.2s" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--wd-text)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--wd-text-35)")}>
                {name}
              </div>
            ))}
          </div>
        </div>
      </section>
    </SectionWrapper>
  );
}

// ── Reviews ──────────────────────────────────────────────────────────────
export function Reviews() {
  return (
    <SectionWrapper variant="mix">
      <section className="py-24 md:py-32 px-4 max-w-6xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="text-center mb-16">
          <span style={{
            display: "inline-block", padding: "6px 16px", borderRadius: "9999px",
            background: "rgba(var(--wd-pink-rgb),0.12)", border: "1px solid rgba(var(--wd-pink-rgb),0.32)",
            color: "var(--wd-pink)", fontSize: "11px", fontWeight: 700, letterSpacing: "0.25em", textTransform: "uppercase", marginBottom: "24px",
          }}>
            ✦ Cosa dicono i viaggiatori
          </span>
          <h2 className="font-black" style={{ fontSize: "clamp(2rem, 5vw, 3.2rem)", letterSpacing: "-0.025em", color: "var(--wd-text)" }}>
            Pianificato. Vissuto.<br /><span className="wd-travel-text">Condiviso.</span>
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {REVIEWS.map((r, i) => (
            <motion.div key={r.name} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ delay: i * 0.08 }}>
              <div style={{ ...glassCard, padding: "24px", height: "100%", display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ display: "flex", gap: "3px" }}>
                  {Array.from({ length: r.rating }).map((_, idx) => (
                    <Star key={idx} style={{ width: "14px", height: "14px", fill: "var(--wd-sun)", color: "var(--wd-sun)" }} />
                  ))}
                </div>
                <p style={{ fontSize: "14px", color: "var(--wd-text-75)", lineHeight: 1.65, flex: 1 }}>"{r.text}"</p>
                <div style={{ display: "flex", alignItems: "center", gap: "12px", paddingTop: "12px", borderTop: "1px solid var(--wd-border-8)" }}>
                  <div style={{
                    width: "38px", height: "38px", borderRadius: "50%", flexShrink: 0,
                    background: "var(--wd-grad-warm)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "#fff", fontWeight: 700, fontSize: "13px",
                  }}>{r.initials}</div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "13px", color: "var(--wd-text)" }}>{r.name}</div>
                    <div style={{ fontSize: "12px", color: "var(--wd-text-45)" }}>{r.city}</div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>
    </SectionWrapper>
  );
}

// ── FAQ ──────────────────────────────────────────────────────────────────
export function Faq() {
  return (
    <SectionWrapper variant="cool">
      <section className="py-24 md:py-32 px-4 max-w-3xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="text-center mb-14">
          <span style={{
            display: "inline-block", padding: "6px 16px", borderRadius: "9999px",
            background: "rgba(var(--wd-sky-rgb),0.12)", border: "1px solid rgba(var(--wd-sky-rgb),0.32)",
            color: "var(--wd-sky)", fontSize: "11px", fontWeight: 700, letterSpacing: "0.25em", textTransform: "uppercase", marginBottom: "24px",
          }}>
            ✦ FAQ
          </span>
          <h2 className="font-black" style={{ fontSize: "clamp(2rem, 5vw, 3.2rem)", letterSpacing: "-0.025em", color: "var(--wd-text)" }}>
            Domande <span className="wd-travel-text">frequenti.</span>
          </h2>
        </motion.div>

        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {FAQ.map((item, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ delay: i * 0.07 }}>
              <Accordion type="single" collapsible>
                <AccordionItem value={`item-${i}`} style={{ ...glassCard, overflow: "hidden" }}
                  className="transition-all">
                  <AccordionTrigger
                    style={{ padding: "20px 24px", fontWeight: 600, fontSize: "15px", color: "var(--wd-text)", textAlign: "left" }}
                    className="hover:no-underline">
                    {item.q}
                  </AccordionTrigger>
                  <AccordionContent style={{ padding: "0 24px 20px", fontSize: "14px", color: "var(--wd-text-65)", lineHeight: 1.7 }}>
                    {item.a}
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </motion.div>
          ))}
        </div>
      </section>
    </SectionWrapper>
  );
}

// ── SiteFooter ───────────────────────────────────────────────────────────
export function SiteFooter() {
  return (
    <SectionWrapper variant="warm">
      <footer style={{ borderTop: "1px solid var(--wd-border-7)" }}>
        <div className="max-w-6xl mx-auto px-4 py-14 grid grid-cols-2 md:grid-cols-4 gap-8">
          <div className="col-span-2 space-y-4">
            <a href="/">
              <img src={waydoraLogo} alt="Waydora" style={{ height: "44px", width: "auto", objectFit: "contain", filter: "brightness(0) invert(1)" }} />
            </a>
            <p style={{ fontSize: "14px", color: "var(--wd-text-55)", maxWidth: "320px", lineHeight: 1.65 }}>
              Il tuo concierge di viaggio AI. Pianifica, prenota, parti — tutto in italiano.
            </p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--wd-text-55)" }}>Legale</div>
            {[["privacy", "Privacy Policy"], ["termini", "Termini e Condizioni"], ["cookie", "Cookie Policy"]].map(([slug, label]) => (
              <a key={slug} href={`/legale/${slug}`}
                style={{ display: "inline-flex", alignItems: "center", gap: "8px", fontSize: "14px", color: "var(--wd-text-55)", textDecoration: "none", transition: "color 0.2s" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--wd-coral)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--wd-text-55)")}>
                <FileText style={{ width: "13px", height: "13px" }} />{label}
              </a>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--wd-text-55)" }}>Contatti & Community</div>
            <a href="mailto:waydora.ai@gmail.com"
              style={{ display: "inline-flex", alignItems: "center", gap: "8px", fontSize: "14px", color: "var(--wd-text-55)", textDecoration: "none", transition: "color 0.2s" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--wd-coral)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--wd-text-55)")}>
              <Mail style={{ width: "13px", height: "13px" }} />waydora.ai@gmail.com
            </a>
            <a href="https://t.me/waydora" target="_blank" rel="noopener noreferrer"
              style={{ display: "inline-flex", alignItems: "center", gap: "8px", fontSize: "14px", color: "var(--wd-text-55)", textDecoration: "none", transition: "color 0.2s" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#2AABEE")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--wd-text-55)")}>
              <Send style={{ width: "13px", height: "13px" }} />Telegram
            </a>
          </div>
        </div>
        <div style={{ borderTop: "1px solid var(--wd-border-7)", padding: "20px", textAlign: "center", fontSize: "12px", color: "var(--wd-text-40)" }}>
          © {new Date().getFullYear()} Waydora — Travel simple, everywhere!
        </div>
      </footer>
    </SectionWrapper>
  );
}

export function FaqChevron() {
  return <ChevronDown className="w-4 h-4" />;
}

// ── StickyLandingHeader (logo + slot azioni, glass blur su scroll) ──────
export function StickyLandingHeader({ right }: { right?: React.ReactNode }) {
  const [, navigate] = useLocation();
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <header
      style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 40,
        padding: "10px 20px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: scrolled ? "var(--wd-glass)" : "transparent",
        backdropFilter: scrolled ? "blur(18px) saturate(160%)" : "none",
        WebkitBackdropFilter: scrolled ? "blur(18px) saturate(160%)" : "none",
        borderBottom: scrolled ? "1px solid var(--wd-border-10)" : "1px solid transparent",
        transition: "background 0.25s ease, backdrop-filter 0.25s ease, border-color 0.25s ease",
      }}
    >
      <a href="/" onClick={(e) => { e.preventDefault(); navigate("/"); }} aria-label="Home" style={{ display: "flex", alignItems: "center" }}>
        <img src={waydoraLogo} alt="Waydora" style={{
          height: "44px", width: "auto", objectFit: "contain",
          // Logo bianco quando si è sopra l'hero (no scroll, hero scuro). Quando scroll → si adatta al tema.
          filter: scrolled ? "none" : "brightness(0) invert(1)",
          transition: "filter 0.25s ease",
        }} />
      </a>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>{right}</div>
    </header>
  );
}
