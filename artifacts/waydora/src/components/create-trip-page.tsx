// src/components/create-trip-page.tsx
import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Plus, X, MapPin, Clock, DollarSign, Save,
  Globe, Upload, ChevronDown, ChevronUp, Loader2,
} from "lucide-react";
import { fetchPhoto } from "@/lib/photos";
import { TripMap } from "@/components/trip-map";

const FALLBACK = "https://images.pexels.com/photos/346885/pexels-photo-346885.jpeg";

const CATEGORIES = [
  { id: "sightseeing", label: "Visita",      emoji: "🏛️" },
  { id: "food",        label: "Cibo",        emoji: "🍽️" },
  { id: "experience",  label: "Esperienza",  emoji: "🎯" },
  { id: "stay",        label: "Soggiorno",   emoji: "🏨" },
  { id: "transport",   label: "Trasporto",   emoji: "🚌" },
  { id: "nightlife",   label: "Nightlife",   emoji: "🌙" },
];

type Activity = {
  id: string;
  time: string;
  title: string;
  description: string;
  category: string;
  estimatedCost: string;
  coordinates?: { lat: number; lng: number };
};

type TripDay = {
  id: string;
  title: string;
  summary: string;
  activities: Activity[];
};

type TripDraft = {
  title: string;
  destination: string;
  description: string;
  days: TripDay[];
  coverPhoto: string;
  budget: string;
  bestSeason: string;
  heroEmoji: string;
};

function newActivity(): Activity {
  return { id: Date.now().toString(), time: "09:00-11:00", title: "", description: "", category: "sightseeing", estimatedCost: "" };
}

function newDay(index: number): TripDay {
  return { id: Date.now().toString(), title: `Giorno ${index + 1}`, summary: "", activities: [newActivity()] };
}

// ── ActivityEditor ────────────────────────────────────────────────────────
function ActivityEditor({ activity, onChange, onRemove }: {
  activity: Activity;
  onChange: (updated: Activity) => void;
  onRemove: () => void;
}) {
  const cat = CATEGORIES.find(c => c.id === activity.category) ?? CATEGORIES[0];

  return (
    <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", padding: "14px", marginBottom: "10px" }}>
      <div style={{ display: "flex", gap: "8px", marginBottom: "10px" }}>
        {/* Orario */}
        <input value={activity.time} onChange={(e) => onChange({ ...activity, time: e.target.value })}
          placeholder="09:00-11:00" style={{ width: "110px", flexShrink: 0, ...inputStyle }} />

        {/* Categoria */}
        <select value={activity.category} onChange={(e) => onChange({ ...activity, category: e.target.value })}
          style={{ ...inputStyle, flex: 1, cursor: "pointer" }}>
          {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>)}
        </select>

        {/* Costo */}
        <input value={activity.estimatedCost} onChange={(e) => onChange({ ...activity, estimatedCost: e.target.value })}
          placeholder="€15" style={{ width: "70px", flexShrink: 0, ...inputStyle }} />

        {/* Rimuovi */}
        <button onClick={onRemove} style={{ width: "32px", height: "32px", borderRadius: "8px", background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.25)", color: "#f87171", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
          <X style={{ width: "13px", height: "13px" }} />
        </button>
      </div>

      <input value={activity.title} onChange={(e) => onChange({ ...activity, title: e.target.value })}
        placeholder="Nome del posto o attività" style={{ ...inputStyle, width: "100%", marginBottom: "8px", fontWeight: 600 }} />

      <textarea value={activity.description} onChange={(e) => onChange({ ...activity, description: e.target.value })}
        placeholder="Descrizione breve..."
        style={{ ...inputStyle, width: "100%", minHeight: "60px", resize: "vertical" }} />
    </div>
  );
}

// ── DayEditor ─────────────────────────────────────────────────────────────
function DayEditor({ day, dayIndex, onChange, onRemove }: {
  day: TripDay; dayIndex: number; onChange: (updated: TripDay) => void; onRemove: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  const updateActivity = (actId: string, updated: Activity) => {
    onChange({ ...day, activities: day.activities.map(a => a.id === actId ? updated : a) });
  };

  const removeActivity = (actId: string) => {
    onChange({ ...day, activities: day.activities.filter(a => a.id !== actId) });
  };

  const addActivity = () => {
    onChange({ ...day, activities: [...day.activities, newActivity()] });
  };

  return (
    <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "16px", marginBottom: "14px", overflow: "hidden" }}>
      {/* Header giorno */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "14px 16px", cursor: "pointer", borderBottom: collapsed ? "none" : "1px solid rgba(255,255,255,0.06)" }}
        onClick={() => setCollapsed(!collapsed)}>
        <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: "linear-gradient(135deg,#f97316,#a855f7)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: 900, color: "#fff", flexShrink: 0 }}>
          {dayIndex + 1}
        </div>
        <input value={day.title} onChange={(e) => { e.stopPropagation(); onChange({ ...day, title: e.target.value }); }}
          onClick={(e) => e.stopPropagation()}
          placeholder={`Giorno ${dayIndex + 1}`}
          style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "#fff", fontSize: "14px", fontWeight: 700 }} />
        <div style={{ display: "flex", gap: "6px" }}>
          <button onClick={(e) => { e.stopPropagation(); onRemove(); }}
            style={{ width: "28px", height: "28px", borderRadius: "8px", background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <X style={{ width: "12px", height: "12px" }} />
          </button>
          <div style={{ width: "28px", height: "28px", borderRadius: "8px", background: "rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.4)" }}>
            {collapsed ? <ChevronDown style={{ width: "14px", height: "14px" }} /> : <ChevronUp style={{ width: "14px", height: "14px" }} />}
          </div>
        </div>
      </div>

      {/* Contenuto giorno */}
      {!collapsed && (
        <div style={{ padding: "14px 16px" }}>
          <input value={day.summary} onChange={(e) => onChange({ ...day, summary: e.target.value })}
            placeholder="Descrizione breve del giorno (es. Esploriamo il centro storico...)"
            style={{ ...inputStyle, width: "100%", marginBottom: "14px" }} />

          {day.activities.map((act) => (
            <ActivityEditor key={act.id} activity={act}
              onChange={(updated) => updateActivity(act.id, updated)}
              onRemove={() => removeActivity(act.id)} />
          ))}

          <button onClick={addActivity}
            style={{ width: "100%", padding: "8px", borderRadius: "10px", background: "rgba(255,255,255,0.05)", border: "1px dashed rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.5)", fontSize: "12px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", transition: "all 0.15s" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.09)"; e.currentTarget.style.color = "#fff"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.color = "rgba(255,255,255,0.5)"; }}>
            <Plus style={{ width: "14px", height: "14px" }} />
            Aggiungi attività
          </button>
        </div>
      )}
    </div>
  );
}

// ── Stile input condiviso ─────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: "10px",
  padding: "8px 12px",
  color: "#fff",
  fontSize: "13px",
  outline: "none",
  fontFamily: "inherit",
};

// ── CreateTripPage ────────────────────────────────────────────────────────
interface CreateTripPageProps {
  onPublish?: (trip: any) => void;
}

export function CreateTripPage({ onPublish }: CreateTripPageProps) {
  const [draft, setDraft] = useState<TripDraft>({
    title: "",
    destination: "",
    description: "",
    days: [newDay(0)],
    coverPhoto: FALLBACK,
    budget: "",
    bestSeason: "",
    heroEmoji: "🗺️",
  });
  const [coverLoading, setCoverLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Aggiorna cover photo quando cambia la destinazione
  useEffect(() => {
    if (!draft.destination || draft.destination.length < 3) return;
    const timer = setTimeout(() => {
      setCoverLoading(true);
      fetchPhoto(`${draft.destination} landmark travel`)
        .then((url) => setDraft(d => ({ ...d, coverPhoto: url })))
        .catch(() => {})
        .finally(() => setCoverLoading(false));
    }, 800); // debounce
    return () => clearTimeout(timer);
  }, [draft.destination]);

  // Costruisce un oggetto itinerary compatibile con TripMap
  const previewItinerary = draft.destination ? {
    title: draft.title || "Il mio viaggio",
    destination: draft.destination,
    durationDays: draft.days.length,
    vibe: draft.description,
    totalBudget: draft.budget,
    bestSeason: draft.bestSeason,
    heroEmoji: draft.heroEmoji,
    days: draft.days.map((d, i) => ({
      day: i + 1,
      title: d.title,
      summary: d.summary,
      activities: d.activities
        .filter(a => a.title)
        .map(a => ({ ...a, photoQuery: draft.destination })),
    })),
    packingList: [],
  } : null;

  const updateDay = (dayId: string, updated: TripDay) => {
    setDraft(d => ({ ...d, days: d.days.map(day => day.id === dayId ? updated : day) }));
  };

  const removeDay = (dayId: string) => {
    setDraft(d => ({ ...d, days: d.days.filter(day => day.id !== dayId) }));
  };

  const addDay = () => {
    setDraft(d => ({ ...d, days: [...d.days, newDay(d.days.length)] }));
  };

  const handleCoverUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setDraft(d => ({ ...d, coverPhoto: url }));
    e.target.value = "";
  };

  const handlePublish = async () => {
    if (!draft.title || !draft.destination) return;
    setPublishing(true);
    await new Promise(r => setTimeout(r, 1200)); // simula upload
    setPublishing(false);
    setPublished(true);
    onPublish?.(draft);
  };

  if (published) return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "16px", textAlign: "center", padding: "32px", background: "#0a0a12" }}>
      <div style={{ fontSize: "4rem" }}>🎉</div>
      <h2 style={{ fontSize: "22px", fontWeight: 900, color: "#fff" }}>Viaggio pubblicato!</h2>
      <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.5)", maxWidth: "320px" }}>
        Il tuo viaggio è ora visibile nella sezione "Lasciati Ispirare" della community Waydora.
      </p>
      <button onClick={() => { setPublished(false); setDraft({ title: "", destination: "", description: "", days: [newDay(0)], coverPhoto: FALLBACK, budget: "", bestSeason: "", heroEmoji: "🗺️" }); }}
        style={{ padding: "10px 24px", borderRadius: "9999px", background: "linear-gradient(135deg,#f97316,#a855f7)", border: "none", color: "#fff", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
        Crea un altro viaggio
      </button>
    </div>
  );

  return (
    <div style={{ height: "100%", display: "flex", overflow: "hidden", background: "#0a0a12" }}>

      {/* ── Editor (sinistra) ── */}
      <div style={{ flex: "0 0 50%", overflowY: "auto", borderRight: "1px solid rgba(255,255,255,0.07)", padding: "24px" }}>

        {/* Header */}
        <div style={{ marginBottom: "24px" }}>
          <h1 style={{ fontSize: "20px", fontWeight: 900, color: "#fff", marginBottom: "4px" }}>✏️ Crea un viaggio</h1>
          <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.4)" }}>Crea il tuo itinerario e condividilo con la community</p>
        </div>

        {/* Cover photo */}
        <div style={{ position: "relative", height: "160px", borderRadius: "14px", overflow: "hidden", marginBottom: "20px", background: "rgba(255,255,255,0.05)" }}>
          <img src={draft.coverPhoto} alt="cover" style={{ width: "100%", height: "100%", objectFit: "cover", opacity: coverLoading ? 0.5 : 1, transition: "opacity 0.3s" }} />
          {coverLoading && (
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Loader2 style={{ width: "24px", height: "24px", color: "#fff", animation: "wd-spin 0.8s linear infinite" }} />
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleCoverUpload} />
          <button onClick={() => fileRef.current?.click()}
            style={{ position: "absolute", bottom: "10px", right: "10px", display: "flex", alignItems: "center", gap: "6px", padding: "6px 12px", borderRadius: "8px", background: "rgba(0,0,0,0.6)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", fontSize: "11px", fontWeight: 600, cursor: "pointer" }}>
            <Upload style={{ width: "12px", height: "12px" }} />
            Cambia foto
          </button>
          <div style={{ position: "absolute", bottom: "10px", left: "10px", fontSize: "11px", color: "rgba(255,255,255,0.5)", background: "rgba(0,0,0,0.5)", padding: "4px 8px", borderRadius: "6px" }}>
            {draft.destination ? `Auto: ${draft.destination}` : "Inserisci destinazione per foto auto"}
          </div>
        </div>

        {/* Info base */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px" }}>
          <div style={{ display: "flex", gap: "8px" }}>
            <input value={draft.heroEmoji} onChange={(e) => setDraft(d => ({ ...d, heroEmoji: e.target.value }))}
              placeholder="🗺️" style={{ ...inputStyle, width: "52px", textAlign: "center", fontSize: "20px" }} />
            <input value={draft.title} onChange={(e) => setDraft(d => ({ ...d, title: e.target.value }))}
              placeholder="Titolo del viaggio *" style={{ ...inputStyle, flex: 1 }} />
          </div>

          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <MapPin style={{ width: "16px", height: "16px", color: "rgba(255,255,255,0.35)", flexShrink: 0 }} />
            <input value={draft.destination} onChange={(e) => setDraft(d => ({ ...d, destination: e.target.value }))}
              placeholder="Destinazione * (es. Tokyo, Giappone)" style={{ ...inputStyle, flex: 1 }} />
          </div>

          <textarea value={draft.description} onChange={(e) => setDraft(d => ({ ...d, description: e.target.value }))}
            placeholder="Descrizione breve del viaggio..."
            style={{ ...inputStyle, minHeight: "72px", resize: "vertical" }} />

          <div style={{ display: "flex", gap: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", flex: 1 }}>
              <DollarSign style={{ width: "14px", height: "14px", color: "rgba(255,255,255,0.35)", flexShrink: 0 }} />
              <input value={draft.budget} onChange={(e) => setDraft(d => ({ ...d, budget: e.target.value }))}
                placeholder="Budget (es. €800)" style={{ ...inputStyle, flex: 1 }} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", flex: 1 }}>
              <Globe style={{ width: "14px", height: "14px", color: "rgba(255,255,255,0.35)", flexShrink: 0 }} />
              <input value={draft.bestSeason} onChange={(e) => setDraft(d => ({ ...d, bestSeason: e.target.value }))}
                placeholder="Periodo (es. Apr-Ott)" style={{ ...inputStyle, flex: 1 }} />
            </div>
          </div>
        </div>

        {/* Giorni */}
        <div style={{ marginBottom: "16px" }}>
          <div style={{ fontSize: "13px", fontWeight: 700, color: "rgba(255,255,255,0.6)", marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.1em" }}>
            📅 Itinerario — {draft.days.length} {draft.days.length === 1 ? "giorno" : "giorni"}
          </div>
          {draft.days.map((day, i) => (
            <DayEditor key={day.id} day={day} dayIndex={i}
              onChange={(updated) => updateDay(day.id, updated)}
              onRemove={() => removeDay(day.id)} />
          ))}
          <button onClick={addDay}
            style={{ width: "100%", padding: "10px", borderRadius: "12px", background: "rgba(255,255,255,0.04)", border: "1px dashed rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.5)", fontSize: "13px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", transition: "all 0.15s" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "#fff"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.color = "rgba(255,255,255,0.5)"; }}>
            <Plus style={{ width: "16px", height: "16px" }} />
            Aggiungi giorno
          </button>
        </div>

        {/* Pulsanti */}
        <div style={{ display: "flex", gap: "10px", paddingBottom: "24px" }}>
          <button
            style={{ flex: 1, padding: "12px", borderRadius: "12px", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.7)", fontSize: "13px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
            <Save style={{ width: "14px", height: "14px" }} />
            Salva bozza
          </button>
          <button onClick={handlePublish} disabled={!draft.title || !draft.destination || publishing}
            style={{ flex: 2, padding: "12px", borderRadius: "12px", background: draft.title && draft.destination ? "linear-gradient(135deg,#f97316,#a855f7)" : "rgba(255,255,255,0.08)", border: "none", color: "#fff", fontSize: "13px", fontWeight: 700, cursor: draft.title && draft.destination ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", opacity: publishing ? 0.8 : 1 }}>
            {publishing ? <Loader2 style={{ width: "15px", height: "15px", animation: "wd-spin 0.8s linear infinite" }} /> : <Globe style={{ width: "15px", height: "15px" }} />}
            {publishing ? "Pubblicazione..." : "Pubblica viaggio"}
          </button>
        </div>

        <style>{`@keyframes wd-spin{to{transform:rotate(360deg)}}`}</style>
      </div>

      {/* ── Preview mappa (destra) ── */}
      <div style={{ flex: "0 0 50%", display: "flex", flexDirection: "column" }}>
        {previewItinerary ? (
          <TripMap itinerary={previewItinerary} />
        ) : (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px", color: "rgba(255,255,255,0.3)", textAlign: "center", padding: "32px" }}>
            <MapPin style={{ width: "40px", height: "40px", opacity: 0.3 }} />
            <p style={{ fontSize: "14px" }}>Inserisci una destinazione per vedere la mappa</p>
          </div>
        )}
      </div>
    </div>
  );
}