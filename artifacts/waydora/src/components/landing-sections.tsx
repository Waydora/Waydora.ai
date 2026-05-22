import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare, Sparkles, PlaneTakeoff, Star,
  ChevronDown, Mail, FileText, Sun, Moon, Send,
} from "lucide-react";
import waydoraLogo from "@assets/LOGO1.png";
import { useTheme } from "@/lib/theme";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent } from "@/components/ui/card";
 
// ── Sfondo globale inferno applicato al body quando si è sulla landing ───
// (viene rimosso quando si va su altre pagine)
 
const useGetStats = () => ({ data: { trips: 1280, users: 540, countries: 42 } });
 
const STEPS = [
  { icon: MessageSquare, title: "Descrivi",  text: "Racconta a Waydora il tuo viaggio: dove, quando, con chi e con che vibe." },
  { icon: Sparkles,      title: "Pianifica", text: "L'AI genera un itinerario giornaliero su misura, con coordinate e meteo aggiornati." },
  { icon: PlaneTakeoff,  title: "Prenota",   text: "Voli, hotel, esperienze e ristoranti con un click tramite i nostri partner." },
];
 
const PARTNERS = [
  { name: "Booking.com",  color: "#ffffff" },
  { name: "GetYourGuide", color: "#ffffff" },
  { name: "TheFork",      color: "#ffffff" },
  { name: "Airbnb",       color: "#ffffff" },
  { name: "Skyscanner",   color: "#ffffff" },
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
  { q: "I link di prenotazione sono affidabili?",    a: "Usiamo solo partner ufficiali e affidabili come Booking.com, GetYourGuide, TheFork, Airbnb e Skyscanner. Le prenotazioni avvengono direttamente sui loro siti." },
  { q: "Posso condividere un itinerario con un amico?", a: "Sì, ogni itinerario salvato ha un link pubblico univoco che puoi condividere via WhatsApp, email o copiando l'URL. L'amico vede l'itinerario completo, mappa e lista bagaglio inclusi." },
  { q: "Funziona per viaggi di lavoro o solo per vacanze?", a: "Funziona per qualsiasi tipo di viaggio: business, weekend, luna di miele, viaggio di gruppo, viaggio con bambini. Più dettagli dai nella chat, più l'itinerario sarà su misura." },
];
 
// ── Foto fisse Unsplash ──────────────────────────────────────────────────
const DESTINATIONS = [
  { name: "Tokyo",     photo: "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=1600&q=80&auto=format&fit=crop" },
  { name: "Bali",      photo: "https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=1600&q=80&auto=format&fit=crop" },
  { name: "New York",  photo: "https://images.unsplash.com/photo-1485871981521-5b1fd3805eee?w=1600&q=80&auto=format&fit=crop" },
  { name: "Lisbona",   photo: "https://images.unsplash.com/photo-1585208798174-6cedd86e019a?q=80&w=1173&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D" },
  { name: "Cefalù",    photo: "https://images.unsplash.com/photo-1742216564155-952ff4743a7f?q=80&w=1332&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D" },
  { name: "Parigi",    photo: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=1600&q=80&auto=format&fit=crop" },
  { name: "Marrakech", photo: "https://images.unsplash.com/photo-1579283135011-0974a412341a?q=80&w=1170&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D" },
  { name: "Istanbul",  photo: "https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?w=1600&q=80&auto=format&fit=crop" },
  { name: "Santorini", photo: "https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?w=1600&q=80&auto=format&fit=crop" },
  { name: "Seoul",     photo: "https://images.unsplash.com/photo-1538485399081-7191377e8241?w=1600&q=80&auto=format&fit=crop" },
  { name: "Dolomiti",  photo: "https://images.unsplash.com/photo-1551632811-561732d1e306?w=1600&q=80&auto=format&fit=crop" },
  { name: "Londra",    photo: "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=1600&q=80&auto=format&fit=crop" },
  { name: "Dubai",     photo: "https://images.unsplash.com/photo-1518684079-3c830dcef090?w=1600&q=80&auto=format&fit=crop" },
  { name: "Budapest",  photo: "https://images.unsplash.com/photo-1565426873118-a17ed65d74b9?w=1600&q=80&auto=format&fit=crop" },
];

 
// ── Stili condivisi ──────────────────────────────────────────────────────
const glassCard = {
  background: "var(--wd-surface-5)",
  backdropFilter: "blur(20px) saturate(140%)",
  WebkitBackdropFilter: "blur(20px) saturate(140%)",
  border: "1px solid var(--wd-border-10)",
  borderRadius: "20px",
} as React.CSSProperties;

const gradientText = {
  background: "linear-gradient(135deg, #a78bfa 0%, #ec4899 100%)",
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
  backgroundClip: "text",
} as React.CSSProperties;
 
// ── Sfondo inferno comune a tutte le sezioni sotto l'hero ────────────────
function InfernoBackground() {
  return (
    <div className="fixed inset-0 -z-10 pointer-events-none" aria-hidden>
      <div style={{ position: "absolute", inset: 0, background: "var(--wd-bg)" }} />
      <div style={{
        position: "absolute", top: "-10%", right: "-5%",
        width: "55vw", height: "55vw", borderRadius: "50%",
        background: "radial-gradient(circle, var(--wd-blob-purple) 0%, transparent 70%)",
        filter: "blur(60px)",
      }} />
      <div style={{
        position: "absolute", top: "30%", left: "50%", transform: "translateX(-50%)",
        width: "70vw", height: "50vw", borderRadius: "50%",
        background: "radial-gradient(circle, var(--wd-blob-pink) 0%, transparent 65%)",
        filter: "blur(80px)",
      }} />
      <div style={{
        position: "absolute", bottom: "0", left: "-10%",
        width: "50vw", height: "50vw", borderRadius: "50%",
        background: "radial-gradient(circle, var(--wd-blob-indigo) 0%, transparent 70%)",
        filter: "blur(70px)",
      }} />
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
      <span className="text-white font-bold">{displayed}</span>
      {typing && (
        <span className="inline-block w-[3px] h-[0.85em] bg-white align-middle ml-0.5 rounded-sm"
          style={{ animation: "wd-blink 0.7s step-end infinite" }} />
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
  const [bgSrc, setBgSrc]         = useState(DESTINATIONS[0].photo);
  const [bgKey, setBgKey]         = useState(0);
  const [input, setInput]         = useState("");
  const textareaRef               = useRef<HTMLTextAreaElement>(null);
  const [, navigate]              = useLocation();
  const { theme, toggle: toggleTheme } = useTheme();
 
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
    ta.style.height = Math.min(ta.scrollHeight, 140) + "px";
  };
 
  const active = input.trim() && !isPending;
 
  return (
    <section className="relative min-h-screen flex flex-col overflow-hidden">
      <div className="absolute inset-0 bg-black">
        <AnimatePresence mode="sync">
          <motion.div
            key={bgKey}
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${bgSrc})` }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 1.4, ease: "easeInOut" }}
          />
        </AnimatePresence>
        <div className="absolute inset-0"
          style={{ background: "linear-gradient(to bottom,rgba(0,0,0,0.52) 0%,rgba(0,0,0,0.2) 45%,rgba(0,0,0,0.68) 100%)" }} />
      </div>
 
      {/* Logo + theme toggle */}
      <div className="relative z-20 px-6 pt-5 flex items-center justify-between">
        <a href="/" onClick={(e) => { e.preventDefault(); navigate("/"); }} aria-label="Home">
          <img src={waydoraLogo} alt="Waydora" className="h-10 w-auto object-contain"
            style={{ filter: "brightness(0) invert(1)" }} />
        </a>
        <button onClick={toggleTheme}
          title={theme === "dark" ? "Passa a modalità chiara" : "Passa a modalità scura"}
          style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 600, padding: "7px 14px", borderRadius: "9999px", background: "rgba(255,255,255,0.15)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.25)", color: "#fff", cursor: "pointer" }}>
          {theme === "dark" ? <Sun style={{ width: "14px", height: "14px" }} /> : <Moon style={{ width: "14px", height: "14px" }} />}
          {theme === "dark" ? "Chiara" : "Scura"}
        </button>
      </div>
 
      {/* Contenuto */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 pb-24 pt-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}
          className="text-center mb-10 max-w-3xl">
          <p className="text-white/55 text-xs font-semibold tracking-[0.3em] uppercase mb-6">La tua assistente di viaggio AI</p>
          <h1 className="text-white font-black leading-[1.05] mb-5"
            style={{ fontSize: "clamp(1.7rem, 4vw, 2.8rem)", letterSpacing: "-0.03em" }}>
            Ciao, sono Waydora:<br />la tua assistente di viaggio.
          </h1>
          <p className="text-white/65 font-light"
            style={{ fontSize: "clamp(1.3rem, 3vw, 2rem)", letterSpacing: "-0.01em" }}>
            Oggi ti porto a <TypewriterDestination text={currentDest.name} />
          </p>
        </motion.div>
 
        <motion.div initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 0.18 }}
          className="w-full max-w-2xl">
          <div className="flex items-center gap-2 px-3 py-2" style={{
            background: "rgba(255,255,255,0.13)",
            backdropFilter: "blur(28px) saturate(160%)",
            WebkitBackdropFilter: "blur(28px) saturate(160%)",
            border: "1px solid rgba(255,255,255,0.2)",
            borderRadius: "9999px",
            boxShadow: "0 4px 30px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.12)",
          }}>
            <textarea ref={textareaRef} value={input} onChange={handleChange} onKeyDown={handleKeyDown}
              placeholder="Dove vuoi andare? Descrivi il tuo viaggio..." rows={1}
              className="flex-1 bg-transparent resize-none outline-none border-none text-white placeholder:text-white/45 text-[15px] leading-relaxed"
              style={{ minHeight: "38px", maxHeight: "140px", paddingLeft: "14px", paddingTop: "9px", paddingBottom: "9px", minWidth: "0" }} />
            <button onClick={handleSubmit} disabled={!active}
              className="shrink-0 flex items-center gap-1.5 font-semibold text-sm text-white transition-all duration-200"
              style={{
                background: active ? "#000" : "rgba(0,0,0,0.38)", borderRadius: "9999px",
                padding: "10px 20px", border: "none", cursor: active ? "pointer" : "not-allowed",
                transform: active ? "scale(1)" : "scale(0.96)", whiteSpace: "nowrap",
              }}>
              {isPending
                ? <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full" style={{ animation: "wd-spin 0.8s linear infinite" }} />Pianificando...</>
                : <>Pianifica <span>✨</span></>}
            </button>
          </div>
          <p className="text-center text-white/30 text-xs mt-3">Premi Invio per pianificare — Shift+Invio per andare a capo</p>
        </motion.div>
 
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="flex gap-2 mt-8">
          {DESTINATIONS.map((_, i) => (
            <button key={i} onClick={() => setDestIndex(i)} aria-label={`Vai a ${DESTINATIONS[i].name}`}
              style={{
                width: i === destIndex ? "22px" : "6px", height: "6px", borderRadius: "9999px",
                background: i === destIndex ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.3)",
                border: "none", padding: 0, cursor: "pointer",
                transition: "width 0.35s ease, background 0.35s ease",
              }} />
          ))}
        </motion.div>
      </div>
 
      <style>{`
        @keyframes wd-blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes wd-spin  { to{transform:rotate(360deg)} }
      `}</style>
    </section>
  );
}
 
// ── Wrapper con sfondo inferno per tutto sotto l'hero ────────────────────
function InfernoSection({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ position: "relative", background: "var(--wd-bg)", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: "-15%", right: "-8%", width: "60vw", height: "60vw", borderRadius: "50%", background: "radial-gradient(circle, var(--wd-blob-purple) 0%, transparent 68%)", filter: "blur(70px)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", top: "35%", left: "40%", width: "65vw", height: "45vw", borderRadius: "50%", background: "radial-gradient(circle, var(--wd-blob-pink) 0%, transparent 65%)", filter: "blur(90px)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: "-10%", left: "-8%", width: "55vw", height: "55vw", borderRadius: "50%", background: "radial-gradient(circle, var(--wd-blob-indigo) 0%, transparent 68%)", filter: "blur(75px)", pointerEvents: "none" }} />
      <div style={{ position: "relative", zIndex: 1 }}>{children}</div>
    </div>
  );
}
 
// ── HowItWorks ───────────────────────────────────────────────────────────
export function HowItWorks() {
  return (
    <InfernoSection>
      <section className="py-24 md:py-32 px-4 max-w-6xl mx-auto">
 
        {/* Label */}
        <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="text-center mb-16">
          <span style={{
            display: "inline-block", padding: "6px 16px", borderRadius: "9999px",
            background: "rgba(167,139,250,0.12)", border: "1px solid rgba(167,139,250,0.3)",
            color: "#a78bfa", fontSize: "11px", fontWeight: 700, letterSpacing: "0.25em", textTransform: "uppercase", marginBottom: "24px",
          }}>
            ✦ Come funziona
          </span>
 
          <h2 className="font-black text-white leading-tight" style={{ fontSize: "clamp(2rem, 5vw, 3.5rem)", letterSpacing: "-0.025em" }}>
            Tre passi al tuo<br />
            <span style={gradientText}>prossimo viaggio.</span>
          </h2>
        </motion.div>
 
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            return (
              <motion.div key={step.title} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.12 }}>
                <div style={{ ...glassCard, padding: "32px", height: "100%" }}>
                  <div style={{
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    width: "48px", height: "48px", borderRadius: "14px", marginBottom: "20px",
                    background: "rgba(167,139,250,0.12)", border: "1px solid rgba(167,139,250,0.2)",
                  }}>
                    <Icon style={{ width: "22px", height: "22px", color: "#a78bfa" }} />
                  </div>
                  <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.2em", color: "#a78bfa", marginBottom: "12px" }}>
                    STEP {String(i + 1).padStart(2, "0")}
                  </div>
                  <h3 style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--wd-text)", marginBottom: "12px", letterSpacing: "-0.02em" }}>
                    {step.title}
                  </h3>
                  <p style={{ fontSize: "15px", color: "var(--wd-text-55)", lineHeight: 1.7 }}>{step.text}</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>
    </InfernoSection>
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
  const { data } = useGetStats();
  const target    = (data as any)?.tripsPlanned ?? 12_847;
  const animated  = useAnimatedNumber(target);
  const formatted = new Intl.NumberFormat("it-IT").format(animated);
 
  return (
    <InfernoSection>
      <section className="py-20 px-4">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="max-w-4xl mx-auto text-center">
 
          {/* Badge live */}
          <div style={{
            display: "inline-flex", alignItems: "center", gap: "8px",
            padding: "6px 14px", borderRadius: "9999px",
            background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.25)",
            marginBottom: "24px",
          }}>
            <span style={{ position: "relative", display: "flex", width: "8px", height: "8px" }}>
              <span style={{
                position: "absolute", inset: 0, borderRadius: "50%",
                background: "#a78bfa", animation: "wd-ping 1.2s cubic-bezier(0,0,0.2,1) infinite", opacity: 0.6,
              }} />
              <span style={{ position: "relative", borderRadius: "50%", width: "8px", height: "8px", background: "#a78bfa" }} />
            </span>
            <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "#a78bfa" }}>
              in tempo reale
            </span>
          </div>
 
          {/* Numero */}
          <div style={{ ...gradientText, fontSize: "clamp(4rem, 12vw, 8rem)", fontWeight: 900, lineHeight: 1, letterSpacing: "-0.04em", marginBottom: "16px" }}>
            {formatted}
          </div>
 
          <p style={{ fontSize: "clamp(0.85rem, 2vw, 1.1rem)", fontWeight: 700, letterSpacing: "0.25em", textTransform: "uppercase", color: "var(--wd-text-45)" }}>
            Viaggi pianificati con Waydora
          </p>
        </motion.div>
      </section>
 
      <style>{`@keyframes wd-ping{75%,100%{transform:scale(2);opacity:0}}`}</style>
    </InfernoSection>
  );
}
 
// ── Partners ─────────────────────────────────────────────────────────────
export function Partners() {
  return (
    <InfernoSection>
      <section className="py-14 px-4" style={{ borderTop: "1px solid var(--wd-border-7)", borderBottom: "1px solid var(--wd-border-7)" }}>
        <div className="max-w-6xl mx-auto">
          <p style={{ textAlign: "center", fontSize: "11px", fontWeight: 700, letterSpacing: "0.3em", textTransform: "uppercase", color: "var(--wd-text-35)", marginBottom: "32px" }}>
            Prenoti con i migliori partner
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-6">
            {PARTNERS.map((p) => (
              <div key={p.name}
                style={{ fontSize: "clamp(1rem, 2vw, 1.25rem)", fontWeight: 800, color: "rgba(255,255,255,0.3)", letterSpacing: "-0.01em", transition: "color 0.2s" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.85)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.3)")}>
                {p.name}
              </div>
            ))}
          </div>
        </div>
      </section>
    </InfernoSection>
  );
}
 
// ── Reviews ──────────────────────────────────────────────────────────────
export function Reviews() {
  return (
    <InfernoSection>
      <section className="py-24 md:py-32 px-4 max-w-6xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="text-center mb-16">
          <span style={{
            display: "inline-block", padding: "6px 16px", borderRadius: "9999px",
            background: "rgba(167,139,250,0.12)", border: "1px solid rgba(167,139,250,0.3)",
            color: "#a78bfa", fontSize: "11px", fontWeight: 700, letterSpacing: "0.25em", textTransform: "uppercase", marginBottom: "24px",
          }}>
            ✦ Cosa dicono i viaggiatori
          </span>
          <h2 className="font-black" style={{ fontSize: "clamp(2rem, 5vw, 3.2rem)", letterSpacing: "-0.025em", color: "var(--wd-text)" }}>
            Pianificato. Vissuto.<br />
            <span style={gradientText}>Condiviso.</span>
          </h2>
        </motion.div>
 
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {REVIEWS.map((r, i) => (
            <motion.div key={r.name} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ delay: i * 0.08 }}>
              <div style={{ ...glassCard, padding: "24px", height: "100%", display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ display: "flex", gap: "3px" }}>
                  {Array.from({ length: r.rating }).map((_, idx) => (
                    <Star key={idx} style={{ width: "14px", height: "14px", fill: "#a78bfa", color: "#a78bfa" }} />
                  ))}
                </div>
                <p style={{ fontSize: "14px", color: "var(--wd-text-75)", lineHeight: 1.65, flex: 1 }}>"{r.text}"</p>
                <div style={{ display: "flex", alignItems: "center", gap: "12px", paddingTop: "12px", borderTop: "1px solid var(--wd-border-8)" }}>
                  <div style={{
                    width: "38px", height: "38px", borderRadius: "50%", flexShrink: 0,
                    background: "rgba(167,139,250,0.15)", border: "1px solid rgba(167,139,250,0.25)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "#a78bfa", fontWeight: 700, fontSize: "13px",
                  }}>{r.initials}</div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "13px", color: "var(--wd-text)" }}>{r.name}</div>
                    <div style={{ fontSize: "12px", color: "var(--wd-text-40)" }}>{r.city}</div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>
    </InfernoSection>
  );
}
 
// ── FAQ ──────────────────────────────────────────────────────────────────
export function Faq() {
  return (
    <InfernoSection>
      <section className="py-24 md:py-32 px-4 max-w-3xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="text-center mb-14">
          <span style={{
            display: "inline-block", padding: "6px 16px", borderRadius: "9999px",
            background: "rgba(167,139,250,0.12)", border: "1px solid rgba(167,139,250,0.3)",
            color: "#a78bfa", fontSize: "11px", fontWeight: 700, letterSpacing: "0.25em", textTransform: "uppercase", marginBottom: "24px",
          }}>
            ✦ FAQ
          </span>
          <h2 className="font-black" style={{ fontSize: "clamp(2rem, 5vw, 3.2rem)", letterSpacing: "-0.025em", color: "var(--wd-text)" }}>
            Domande <span style={gradientText}>frequenti.</span>
          </h2>
        </motion.div>
 
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {FAQ.map((item, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ delay: i * 0.07 }}>
              <Accordion type="single" collapsible>
                <AccordionItem value={`item-${i}`} style={{ ...glassCard, border: "1px solid rgba(255,255,255,0.08)", overflow: "hidden" }}
                  className="transition-all data-[state=open]:border-[rgba(167,139,250,0.35)]">
                  <AccordionTrigger
                    style={{ padding: "20px 24px", fontWeight: 600, fontSize: "15px", color: "var(--wd-text)", textAlign: "left" }}
                    className="hover:no-underline [&>svg]:text-[#a78bfa]">
                    {item.q}
                  </AccordionTrigger>
                  <AccordionContent style={{ padding: "0 24px 20px", fontSize: "14px", color: "var(--wd-text-55)", lineHeight: 1.7 }}>
                    {item.a}
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </motion.div>
          ))}
        </div>
      </section>
    </InfernoSection>
  );
}
 
// ── SiteFooter ───────────────────────────────────────────────────────────
export function SiteFooter() {
  const { theme, toggle: toggleTheme } = useTheme();
  return (
    <InfernoSection>
      <footer style={{ borderTop: "1px solid var(--wd-border-7)" }}>
        <div className="max-w-6xl mx-auto px-4 py-14 grid grid-cols-2 md:grid-cols-4 gap-8">
          <div className="col-span-2 space-y-4">
            <a href="/">
              <img src={waydoraLogo} alt="Waydora" style={{ height: "36px", width: "auto", objectFit: "contain", filter: theme === "dark" ? "brightness(0) invert(1)" : "none" }} />
            </a>
            <p style={{ fontSize: "14px", color: "var(--wd-text-40)", maxWidth: "300px", lineHeight: 1.65 }}>
              Il tuo concierge di viaggio AI. Pianifica, prenota, parti — tutto in italiano.
            </p>
            {/* Toggle tema */}
            <button onClick={toggleTheme}
              style={{ display: "inline-flex", alignItems: "center", gap: "8px", fontSize: "13px", fontWeight: 600, padding: "7px 14px", borderRadius: "9999px", background: "var(--wd-surface-8)", border: "1px solid var(--wd-border-10)", color: "var(--wd-text-55)", cursor: "pointer" }}>
              {theme === "dark" ? <Sun style={{ width: "14px", height: "14px" }} /> : <Moon style={{ width: "14px", height: "14px" }} />}
              {theme === "dark" ? "Modalità chiara" : "Modalità scura"}
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--wd-text-45)" }}>Legale</div>
            {[["privacy", "Privacy Policy"], ["termini", "Termini e Condizioni"], ["cookie", "Cookie Policy"]].map(([slug, label]) => (
              <a key={slug} href={`/legale/${slug}`}
                style={{ display: "inline-flex", alignItems: "center", gap: "8px", fontSize: "14px", color: "var(--wd-text-40)", textDecoration: "none", transition: "color 0.2s" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#a78bfa")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--wd-text-40)")}>
                <FileText style={{ width: "13px", height: "13px" }} />{label}
              </a>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--wd-text-45)" }}>Contatti & Community</div>
            <a href="mailto:waydora.ai@gmail.com"
              style={{ display: "inline-flex", alignItems: "center", gap: "8px", fontSize: "14px", color: "var(--wd-text-40)", textDecoration: "none", transition: "color 0.2s" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#a78bfa")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--wd-text-40)")}>
              <Mail style={{ width: "13px", height: "13px" }} />waydora.ai@gmail.com
            </a>
            <a href="https://t.me/waydora" target="_blank" rel="noopener noreferrer"
              style={{ display: "inline-flex", alignItems: "center", gap: "8px", fontSize: "14px", color: "var(--wd-text-40)", textDecoration: "none", transition: "color 0.2s" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#2AABEE")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--wd-text-40)")}>
              <Send style={{ width: "13px", height: "13px" }} />Telegram
            </a>
          </div>
        </div>
        <div style={{ borderTop: "1px solid var(--wd-border-7)", padding: "20px", textAlign: "center", fontSize: "12px", color: "var(--wd-text-25)" }}>
          © {new Date().getFullYear()} Waydora — Travel simple, everywhere!
        </div>
      </footer>
    </InfernoSection>
  );
}
 
export function FaqChevron() {
  return <ChevronDown className="w-4 h-4" />;
}
 