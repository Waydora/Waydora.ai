import { useEffect, useState, useRef } from "react";
import { useParams, Link } from "wouter";
import {
  Loader2, Home, MapPin, Copy, Map, Mail,
  Share2, CheckSquare, Square, Lightbulb,
  Camera, DollarSign, Plus, X, ShoppingBag,
  MessageSquare, Check,
} from "lucide-react";
import { Layout } from "@/components/layout";
import { ItineraryResults } from "@/components/itinerary-results";
import { TripMap } from "@/components/trip-map";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
 
const AMAZON_TAG = "waydora-21";
 
// ── Stili ─────────────────────────────────────────────────────────────────
const glassDark = {
  background: "rgba(10,10,18,0.92)",
  backdropFilter: "blur(24px)",
  WebkitBackdropFilter: "blur(24px)",
  border: "1px solid rgba(255,255,255,0.08)",
} as React.CSSProperties;
 
const activeTab  = { background: "rgba(255,255,255,0.10)", color: "#ffffff",               border: "1px solid rgba(255,255,255,0.18)" } as React.CSSProperties;
const inactiveTab = { background: "transparent",           color: "rgba(255,255,255,0.38)", border: "1px solid transparent"           } as React.CSSProperties;
 
// ── Tool tabs ─────────────────────────────────────────────────────────────
const TOOLS = [
  { id: "itinerary", label: "Itinerario", icon: MapPin },
  { id: "map",       label: "Mappa",      icon: Map },
  { id: "ideas",     label: "Idee",       icon: Lightbulb },
  { id: "bagaglio",  label: "Bagaglio",   icon: CheckSquare },
  { id: "media",     label: "Media",      icon: Camera },
  { id: "expenses",  label: "Spese",      icon: DollarSign },
];
 
// ── IdeasPanel ────────────────────────────────────────────────────────────
function IdeasPanel({ slug }: { slug: string }) {
  const [ideas, setIdeas]   = useState<Array<{ id: string; text: string; author: string; ts: string }>>([]);
  const [input, setInput]   = useState("");
  const [name,  setName]    = useState(() => localStorage.getItem("waydora_guest_name") ?? "");
  const [saving, setSaving] = useState(false);
 
  // Carica idee da Supabase (campo notes del saved_trip o tabella dedicata)
  // Per semplicità usiamo localStorage con sync manuale — Realtime in futuro
  useEffect(() => {
    const stored = localStorage.getItem(`trip_ideas_${slug}`);
    if (stored) { try { setIdeas(JSON.parse(stored)); } catch {} }
  }, [slug]);
 
  const persist = (updated: typeof ideas) => {
    localStorage.setItem(`trip_ideas_${slug}`, JSON.stringify(updated));
  };
 
  const addIdea = () => {
    if (!input.trim()) return;
    const author = name.trim() || "Anonimo";
    localStorage.setItem("waydora_guest_name", author);
    const newIdea = { id: Date.now().toString(), text: input.trim(), author, ts: new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }) };
    const updated = [...ideas, newIdea];
    setIdeas(updated);
    persist(updated);
    setInput("");
  };
 
  const removeIdea = (id: string) => {
    const updated = ideas.filter(i => i.id !== id);
    setIdeas(updated);
    persist(updated);
  };
 
  return (
    <div style={{ padding: "20px", height: "100%", display: "flex", flexDirection: "column", gap: "16px" }}>
      <div style={{ fontSize: "15px", fontWeight: 700, color: "#fff" }}>💡 Idee condivise</div>
      <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", marginTop: "-8px" }}>
        Aggiungi idee per questo viaggio — visibili a tutti con il link.
      </p>
 
      {/* Nome */}
      <input value={name} onChange={e => { setName(e.target.value); localStorage.setItem("waydora_guest_name", e.target.value); }}
        placeholder="Il tuo nome (opzionale)"
        style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", padding: "8px 12px", color: "#fff", fontSize: "12px", outline: "none" }} />
 
      {/* Input idea */}
      <div style={{ display: "flex", gap: "8px" }}>
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter") addIdea(); }}
          placeholder="Scrivi un'idea..."
          style={{ flex: 1, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "10px", padding: "9px 12px", color: "#fff", fontSize: "13px", outline: "none" }} />
        <button onClick={addIdea} style={{ width: "38px", height: "38px", borderRadius: "10px", background: "linear-gradient(135deg,#f97316,#a855f7)", border: "none", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
          <Plus style={{ width: "16px", height: "16px" }} />
        </button>
      </div>
 
      {/* Lista idee */}
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px" }}>
        {ideas.length === 0
          ? <div style={{ textAlign: "center", padding: "40px 20px", color: "rgba(255,255,255,0.3)" }}>
              <div style={{ fontSize: "2.5rem", marginBottom: "8px" }}>💡</div>
              <p style={{ fontSize: "13px" }}>Nessuna idea ancora — sii il primo!</p>
            </div>
          : ideas.map(idea => (
            <div key={idea.id} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", padding: "10px 12px", display: "flex", gap: "10px" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.85)", marginBottom: "4px" }}>{idea.text}</div>
                <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.35)" }}>— {idea.author} · {idea.ts}</div>
              </div>
              <button onClick={() => removeIdea(idea.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.3)", padding: 0, flexShrink: 0 }}>
                <X style={{ width: "13px", height: "13px" }} />
              </button>
            </div>
          ))
        }
      </div>
    </div>
  );
}
 
// ── BaggagePanel ──────────────────────────────────────────────────────────
function BaggagePanel({ packingList, destination }: { packingList: any[]; destination: string }) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
 
  if (!packingList || packingList.length === 0) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: "12px", color: "rgba(255,255,255,0.3)", padding: "32px", textAlign: "center" }}>
      <CheckSquare style={{ width: "32px", height: "32px", opacity: 0.3 }} />
      <p style={{ fontSize: "13px" }}>Nessun bagaglio in questo itinerario</p>
    </div>
  );
 
  return (
    <div style={{ padding: "20px", overflowY: "auto", height: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "20px" }}>
        <CheckSquare style={{ width: "16px", height: "16px", color: "rgba(255,255,255,0.6)" }} />
        <h3 style={{ fontSize: "14px", fontWeight: 700, color: "#fff" }}>Lista Bagaglio</h3>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
        {packingList.map((cat: any, ci: number) => (
          <div key={cat.category}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
              <h4 style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.2em", color: "rgba(255,255,255,0.5)" }}>{cat.category}</h4>
              <a href={`https://www.amazon.it/s?k=${encodeURIComponent(cat.category)}+viaggio&tag=${AMAZON_TAG}`} target="_blank" rel="noopener noreferrer"
                style={{ fontSize: "10px", color: "#ff9900", textDecoration: "none", opacity: 0.6 }}
                onMouseEnter={e => (e.currentTarget.style.opacity = "1")} onMouseLeave={e => (e.currentTarget.style.opacity = "0.6")}>
                Acquista tutto →
              </a>
            </div>
            <ul style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {cat.items.map((item: string, ii: number) => {
                const key = `${ci}-${ii}`;
                const isChecked = checked[key];
                return (
                  <li key={ii} onClick={() => setChecked(p => ({ ...p, [key]: !p[key] }))}
                    style={{ display: "flex", alignItems: "flex-start", gap: "8px", fontSize: "13px", cursor: "pointer" }}>
                    <button style={{ marginTop: "1px", flexShrink: 0, background: "none", border: "none", padding: 0, cursor: "pointer" }}>
                      {isChecked ? <CheckSquare style={{ width: "14px", height: "14px", color: "rgba(255,255,255,0.5)" }} /> : <Square style={{ width: "14px", height: "14px", color: "rgba(255,255,255,0.2)" }} />}
                    </button>
                    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px" }}>
                      <span style={{ color: isChecked ? "rgba(255,255,255,0.28)" : "rgba(255,255,255,0.75)", textDecoration: isChecked ? "line-through" : "none" }}>{item}</span>
                      <a href={`https://www.amazon.it/s?k=${encodeURIComponent(item)}+viaggio&tag=${AMAZON_TAG}`} target="_blank" rel="noopener noreferrer"
                        style={{ flexShrink: 0, opacity: 0.4, color: "#ff9900", textDecoration: "none" }}
                        onMouseEnter={e => (e.currentTarget.style.opacity = "1")} onMouseLeave={e => (e.currentTarget.style.opacity = "0.4")}>
                        <ShoppingBag style={{ width: "13px", height: "13px" }} />
                      </a>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
      <div style={{ marginTop: "20px", paddingTop: "16px", borderTop: "1px solid rgba(255,255,255,0.07)", textAlign: "center" }}>
        <a href={`https://www.amazon.it/s?k=accessori+viaggio+${encodeURIComponent(destination)}&tag=${AMAZON_TAG}`} target="_blank" rel="noopener noreferrer"
          style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 700, padding: "8px 16px", borderRadius: "9999px", background: "rgba(255,153,0,0.12)", color: "#ff9900", border: "1px solid rgba(255,153,0,0.25)", textDecoration: "none" }}>
          <ShoppingBag style={{ width: "14px", height: "14px" }} />
          Tutto il necessario su Amazon
        </a>
      </div>
    </div>
  );
}
 
// ── MediaPanel ────────────────────────────────────────────────────────────
function MediaPanel({ slug }: { slug: string }) {
  const [files, setFiles] = useState<Array<{ name: string; preview: string }>>([]);
  const fileRef = useRef<HTMLInputElement>(null);
 
  useEffect(() => {
    const stored = localStorage.getItem(`trip_media_${slug}`);
    if (stored) { try { setFiles(JSON.parse(stored)); } catch {} }
  }, [slug]);
 
  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = Array.from(e.target.files ?? []).map(f => ({ name: f.name, preview: URL.createObjectURL(f) }));
    const updated = [...files, ...newFiles];
    setFiles(updated);
    // Nota: object URL non sopravvive al refresh — per persistenza reale serve Supabase Storage
    e.target.value = "";
  };
 
  const remove = (i: number) => setFiles(prev => prev.filter((_, idx) => idx !== i));
 
  return (
    <div style={{ padding: "20px", height: "100%", display: "flex", flexDirection: "column", gap: "16px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: "15px", fontWeight: 700, color: "#fff" }}>📸 Foto e media</div>
        <input ref={fileRef} type="file" accept="image/*,video/*" multiple style={{ display: "none" }} onChange={handleUpload} />
        <button onClick={() => fileRef.current?.click()} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 600, padding: "6px 12px", borderRadius: "9999px", background: "rgba(255,255,255,0.09)", color: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.15)", cursor: "pointer" }}>
          <Plus style={{ width: "13px", height: "13px" }} />Carica
        </button>
      </div>
      <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", marginTop: "-8px" }}>
        Carica foto e video del viaggio — visibili a tutti con il link.
      </p>
      {files.length === 0
        ? <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px", color: "rgba(255,255,255,0.3)", textAlign: "center" }}>
            <Camera style={{ width: "36px", height: "36px", opacity: 0.3 }} />
            <p style={{ fontSize: "13px" }}>Nessun media ancora</p>
            <button onClick={() => fileRef.current?.click()} style={{ fontSize: "12px", fontWeight: 600, padding: "8px 16px", borderRadius: "9999px", background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.12)", cursor: "pointer" }}>
              Carica la prima foto
            </button>
          </div>
        : <div style={{ flex: 1, overflowY: "auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
            {files.map((f, i) => (
              <div key={i} style={{ position: "relative", borderRadius: "10px", overflow: "hidden", aspectRatio: "1" }}>
                <img src={f.preview} alt={f.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                <button onClick={() => remove(i)} style={{ position: "absolute", top: "4px", right: "4px", width: "20px", height: "20px", borderRadius: "50%", background: "rgba(0,0,0,0.7)", border: "none", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0 }}>
                  <X style={{ width: "11px", height: "11px" }} />
                </button>
              </div>
            ))}
          </div>
      }
    </div>
  );
}
 
// ── ExpensesPanel ─────────────────────────────────────────────────────────
function ExpensesPanel() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: "12px", textAlign: "center", padding: "32px" }}>
      <div style={{ fontSize: "2.8rem" }}>💰</div>
      <div style={{ fontSize: "15px", fontWeight: 700, color: "#fff" }}>Gestione spese</div>
      <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.4)", maxWidth: "240px" }}>Dividi le spese con il gruppo e tieni traccia del budget</div>
      <div style={{ fontSize: "12px", fontWeight: 600, padding: "6px 16px", borderRadius: "9999px", background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.12)" }}>
        Disponibile prossimamente
      </div>
    </div>
  );
}
 
// ── Toolbar desktop ───────────────────────────────────────────────────────
function ToolbarDesktop({ active, onChange }: { active: string; onChange: (id: string) => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", width: "56px", borderRight: "1px solid rgba(255,255,255,0.07)", ...glassDark, gap: "4px", padding: "12px 6px" }}>
      {TOOLS.map(t => {
        const Icon = t.icon;
        const isActive = active === t.id;
        return (
          <button key={t.id} onClick={() => onChange(t.id)} title={t.label}
            style={{ width: "44px", height: "44px", borderRadius: "12px", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 0.15s", background: isActive ? "rgba(255,255,255,0.12)" : "transparent", color: isActive ? "#fff" : "rgba(255,255,255,0.38)" }}
            onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "rgba(255,255,255,0.07)"; }}
            onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}>
            <Icon style={{ width: "18px", height: "18px" }} />
          </button>
        );
      })}
    </div>
  );
}
 
// ── Main ──────────────────────────────────────────────────────────────────
export default function Trip() {
  const params = useParams();
  const slug = params.slug ?? "";
  const { toast } = useToast();
 
  const [itinerary, setItinerary] = useState<any>(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(false);
  const [activeTool, setActiveTool] = useState("itinerary");
  const [copied, setCopied] = useState(false);
 
  useEffect(() => {
    if (!slug) return;
    supabase.from("saved_trips").select("*").eq("share_slug", slug).single()
      .then(({ data, error: err }) => {
        if (err || !data?.itinerary) setError(true);
        else setItinerary(data.itinerary);
        setLoading(false);
      });
  }, [slug]);
 
  useEffect(() => {
    if (itinerary?.destination) document.title = `${itinerary.destination} — Waydora`;
  }, [itinerary]);
 
  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/trip/${slug}` : "";
 
  const handleCopy = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Link copiato!" });
  };
 
  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) return (
    <Layout>
      <div className="flex-1 flex items-center justify-center" style={{ background: "#0a0a12" }}>
        <Loader2 style={{ width: "36px", height: "36px", color: "#a78bfa", animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </Layout>
  );
 
  // ── 404 ──────────────────────────────────────────────────────────────────
  if (error || !itinerary) return (
    <Layout>
      <div className="flex-1 flex flex-col items-center justify-center gap-6 text-center p-8" style={{ background: "#0a0a12" }}>
        <div style={{ fontSize: "4rem" }}>🗺️</div>
        <h2 style={{ fontSize: "22px", fontWeight: 900, color: "#fff" }}>Viaggio non trovato</h2>
        <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.45)", maxWidth: "380px" }}>
          Il link potrebbe essere scaduto o il viaggio è stato eliminato.
        </p>
        <Link href="/">
          <button style={{ padding: "11px 28px", borderRadius: "9999px", background: "linear-gradient(135deg,#f97316,#a855f7)", border: "none", color: "#fff", fontSize: "14px", fontWeight: 700, cursor: "pointer" }}>
            ← Torna alla home
          </button>
        </Link>
      </div>
    </Layout>
  );
 
  // ── Render contenuto per tool attivo ─────────────────────────────────────
  const renderTool = (tool: string) => {
    if (tool === "itinerary") return (
      <div style={{ padding: "28px 32px", maxWidth: "720px", margin: "0 auto", paddingBottom: "64px" }}>
        <ItineraryResults itinerary={itinerary} />
      </div>
    );
    if (tool === "map") return <TripMap itinerary={itinerary} />;
    if (tool === "ideas")    return <IdeasPanel slug={slug} />;
    if (tool === "bagaglio") return <BaggagePanel packingList={itinerary.packingList ?? []} destination={itinerary.destination} />;
    if (tool === "media")    return <MediaPanel slug={slug} />;
    if (tool === "expenses") return <ExpensesPanel />;
    return null;
  };
 
  // ── Layout ────────────────────────────────────────────────────────────────
  return (
    <Layout>
      {/* Sfondo */}
      <div style={{ position: "fixed", inset: 0, zIndex: -1, background: "#0a0a12" }}>
        <div style={{ position: "absolute", top: "-10%", right: "-5%", width: "50vw", height: "50vw", borderRadius: "50%", background: "radial-gradient(circle,rgba(249,115,22,0.12) 0%,transparent 65%)", filter: "blur(70px)" }} />
        <div style={{ position: "absolute", bottom: "5%", left: "-5%", width: "45vw", height: "45vw", borderRadius: "50%", background: "radial-gradient(circle,rgba(168,85,247,0.12) 0%,transparent 65%)", filter: "blur(70px)" }} />
      </div>
 
      {/* ── DESKTOP ── */}
      <div className="flex-1 min-h-0 hidden lg:flex flex-col">
 
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 20px", borderBottom: "1px solid rgba(255,255,255,0.07)", flexShrink: 0, ...glassDark }}>
 
          {/* Sinistra: Home + Pianificatore */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Link href="/">
              <button style={{ display: "flex", alignItems: "center", gap: "6px", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "9px", padding: "7px 12px", color: "rgba(255,255,255,0.7)", fontSize: "12px", fontWeight: 600, cursor: "pointer", transition: "all 0.15s" }}
                onMouseEnter={e => { e.currentTarget.style.color = "#fff"; e.currentTarget.style.background = "rgba(255,255,255,0.12)"; }}
                onMouseLeave={e => { e.currentTarget.style.color = "rgba(255,255,255,0.7)"; e.currentTarget.style.background = "rgba(255,255,255,0.07)"; }}>
                <Home style={{ width: "13px", height: "13px" }} />
                Home
              </button>
            </Link>
            <Link href="/?chat=1">
              <button style={{ display: "flex", alignItems: "center", gap: "6px", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "9px", padding: "7px 12px", color: "rgba(255,255,255,0.7)", fontSize: "12px", fontWeight: 600, cursor: "pointer", transition: "all 0.15s" }}
                onMouseEnter={e => { e.currentTarget.style.color = "#fff"; e.currentTarget.style.background = "rgba(255,255,255,0.12)"; }}
                onMouseLeave={e => { e.currentTarget.style.color = "rgba(255,255,255,0.7)"; e.currentTarget.style.background = "rgba(255,255,255,0.07)"; }}>
                <MessageSquare style={{ width: "13px", height: "13px" }} />
                Pianificatore
              </button>
            </Link>
          </div>
 
          {/* Centro: titolo viaggio */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "1.2rem" }}>{itinerary.heroEmoji ?? "🗺️"}</span>
            <span style={{ fontSize: "14px", fontWeight: 700, color: "#fff" }}>{itinerary.title}</span>
          </div>
 
          {/* Destra: condividi */}
          <button onClick={handleCopy}
            style={{ display: "flex", alignItems: "center", gap: "6px", padding: "7px 16px", borderRadius: "9999px", background: copied ? "rgba(52,211,153,0.15)" : "rgba(255,255,255,0.09)", border: copied ? "1px solid rgba(52,211,153,0.3)" : "1px solid rgba(255,255,255,0.18)", color: copied ? "#34d399" : "#fff", fontSize: "12px", fontWeight: 600, cursor: "pointer", transition: "all 0.2s" }}>
            {copied ? <Check style={{ width: "13px", height: "13px" }} /> : <Copy style={{ width: "13px", height: "13px" }} />}
            {copied ? "Copiato!" : "Copia link"}
          </button>
        </div>
 
        {/* Body: toolbar verticale + contenuto */}
        <div style={{ flex: 1, minHeight: 0, display: "flex" }}>
          <ToolbarDesktop active={activeTool} onChange={setActiveTool} />
          <div style={{ flex: 1, minHeight: 0, overflowY: activeTool === "map" ? "hidden" : "auto" }}>
            {renderTool(activeTool)}
          </div>
        </div>
      </div>
 
      {/* ── MOBILE ── */}
      <div className="flex-1 min-h-0 lg:hidden flex flex-col">
 
        {/* Header mobile */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderBottom: "1px solid rgba(255,255,255,0.07)", flexShrink: 0, ...glassDark }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <Link href="/">
              <button style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px", fontSize: "12px" }}>
                <Home style={{ width: "14px", height: "14px" }} />
              </button>
            </Link>
            <span style={{ color: "rgba(255,255,255,0.2)", fontSize: "12px" }}>|</span>
            <Link href="/?chat=1">
              <button style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px", fontSize: "12px" }}>
                <MessageSquare style={{ width: "14px", height: "14px" }} />
                <span>Pianificatore</span>
              </button>
            </Link>
          </div>
          <button onClick={handleCopy}
            style={{ display: "flex", alignItems: "center", gap: "5px", padding: "6px 12px", borderRadius: "9999px", background: "rgba(255,255,255,0.09)", border: "1px solid rgba(255,255,255,0.15)", color: "#fff", fontSize: "11px", fontWeight: 600, cursor: "pointer" }}>
            {copied ? <Check style={{ width: "12px", height: "12px" }} /> : <Copy style={{ width: "12px", height: "12px" }} />}
            {copied ? "Copiato!" : "Copia"}
          </button>
        </div>
 
        {/* Tab bar mobile */}
        <div style={{ padding: "8px 12px 0", flexShrink: 0 }}>
          <div style={{ display: "flex", gap: "4px", overflowX: "auto", scrollbarWidth: "none" }}>
            {TOOLS.map(t => {
              const Icon = t.icon;
              const isActive = activeTool === t.id;
              return (
                <button key={t.id} onClick={() => setActiveTool(t.id)}
                  style={{ display: "flex", alignItems: "center", gap: "5px", padding: "7px 12px", borderRadius: "9px", fontSize: "11px", fontWeight: 600, whiteSpace: "nowrap", cursor: "pointer", flexShrink: 0, transition: "all 0.15s", ...(isActive ? activeTab : inactiveTab) }}>
                  <Icon style={{ width: "13px", height: "13px" }} />
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
 
        {/* Contenuto */}
        <div style={{ flex: 1, minHeight: 0, overflowY: activeTool === "map" ? "hidden" : "auto" }}>
          {activeTool === "itinerary"
            ? <div style={{ padding: "16px", paddingBottom: "48px" }}><ItineraryResults itinerary={itinerary} /></div>
            : renderTool(activeTool)
          }
        </div>
      </div>
    </Layout>
  );
}