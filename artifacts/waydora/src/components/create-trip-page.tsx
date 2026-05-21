// src/components/create-trip-page.tsx
import { useState, useRef, useEffect } from "react";
import {
  Plus, X, MapPin, Save,
  Globe, Upload, ChevronDown, ChevronUp, Loader2,
  Edit3, Trash2, Eye, CheckCircle,
} from "lucide-react";
import { fetchPhoto } from "@/lib/photos";
import { TripMap } from "@/components/trip-map";
import type { UserTripRow } from "@/hooks/trips";

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
  id: string; time: string; title: string;
  description: string; category: string; estimatedCost: string;
  coordinates?: { lat: number; lng: number };
};
type TripDay = { id: string; title: string; summary: string; activities: Activity[] };
type TripDraft = {
  id?: string;
  title: string; destination: string; description: string;
  days: TripDay[]; coverPhoto: string; budget: string;
  bestSeason: string; heroEmoji: string; status: "draft" | "published";
};

function newActivity(): Activity {
  return { id: Date.now().toString(), time: "09:00-11:00", title: "", description: "", category: "sightseeing", estimatedCost: "" };
}
function newDay(index: number): TripDay {
  return { id: Date.now().toString(), title: `Giorno ${index + 1}`, summary: "", activities: [newActivity()] };
}

const inp: React.CSSProperties = {
  background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: "10px", padding: "8px 12px", color: "#fff", fontSize: "13px",
  outline: "none", fontFamily: "inherit", width: "100%", boxSizing: "border-box",
};

// ── ActivityEditor ────────────────────────────────────────────────────────
function ActivityEditor({ activity, onChange, onRemove }: {
  activity: Activity; onChange: (u: Activity) => void; onRemove: () => void;
}) {
  return (
    <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", padding: "12px", marginBottom: "8px" }}>
      {/* Riga 1: orario + categoria — su mobile vanno a capo, X sempre visibile */}
      <div style={{ display: "flex", gap: "6px", marginBottom: "8px", alignItems: "center", flexWrap: "wrap" }}>
        <input value={activity.time} onChange={e => onChange({ ...activity, time: e.target.value })} placeholder="09:00-11:00"
          style={{ ...inp, width: "105px", flexShrink: 0 }} />
        <select value={activity.category} onChange={e => onChange({ ...activity, category: e.target.value })}
          style={{ ...inp, flex: 1, minWidth: "100px", cursor: "pointer" }}>
          {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>)}
        </select>
        <input value={activity.estimatedCost} onChange={e => onChange({ ...activity, estimatedCost: e.target.value })} placeholder="€15"
          style={{ ...inp, width: "60px", flexShrink: 0 }} />
        {/* X sempre visibile, fuori dal flex-wrap per non sparire */}
        <button onClick={onRemove}
          style={{ width: "32px", height: "32px", borderRadius: "8px", background: "rgba(239,68,68,0.18)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
          <X style={{ width: "14px", height: "14px" }} />
        </button>
      </div>
      <input value={activity.title} onChange={e => onChange({ ...activity, title: e.target.value })} placeholder="Nome del posto o attività"
        style={{ ...inp, marginBottom: "6px", fontWeight: 600 }} />
      <textarea value={activity.description} onChange={e => onChange({ ...activity, description: e.target.value })} placeholder="Descrizione breve..."
        style={{ ...inp, minHeight: "52px", resize: "vertical" }} />
    </div>
  );
}

// ── DayEditor ─────────────────────────────────────────────────────────────
function DayEditor({ day, dayIndex, onChange, onRemove }: {
  day: TripDay; dayIndex: number; onChange: (u: TripDay) => void; onRemove: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "14px", marginBottom: "12px", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "12px 14px", cursor: "pointer", borderBottom: collapsed ? "none" : "1px solid rgba(255,255,255,0.06)" }} onClick={() => setCollapsed(!collapsed)}>
        <div style={{ width: "26px", height: "26px", borderRadius: "50%", background: "linear-gradient(135deg,#f97316,#a855f7)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 900, color: "#fff", flexShrink: 0 }}>{dayIndex + 1}</div>
        <input value={day.title} onChange={e => { e.stopPropagation(); onChange({ ...day, title: e.target.value }); }} onClick={e => e.stopPropagation()}
          placeholder={`Giorno ${dayIndex + 1}`}
          style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "#fff", fontSize: "13px", fontWeight: 700, minWidth: 0 }} />
        <button onClick={e => { e.stopPropagation(); onRemove(); }}
          style={{ width: "26px", height: "26px", borderRadius: "6px", background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
          <X style={{ width: "12px", height: "12px" }} />
        </button>
        <div style={{ color: "rgba(255,255,255,0.4)", flexShrink: 0 }}>
          {collapsed ? <ChevronDown style={{ width: "14px", height: "14px" }} /> : <ChevronUp style={{ width: "14px", height: "14px" }} />}
        </div>
      </div>
      {!collapsed && (
        <div style={{ padding: "12px 14px" }}>
          <input value={day.summary} onChange={e => onChange({ ...day, summary: e.target.value })} placeholder="Descrizione breve del giorno..."
            style={{ ...inp, marginBottom: "12px" }} />
          {day.activities.map(act => (
            <ActivityEditor key={act.id} activity={act}
              onChange={u => onChange({ ...day, activities: day.activities.map(a => a.id === act.id ? u : a) })}
              onRemove={() => onChange({ ...day, activities: day.activities.filter(a => a.id !== act.id) })} />
          ))}
          <button onClick={() => onChange({ ...day, activities: [...day.activities, newActivity()] })}
            style={{ width: "100%", padding: "7px", borderRadius: "9px", background: "rgba(255,255,255,0.04)", border: "1px dashed rgba(255,255,255,0.14)", color: "rgba(255,255,255,0.45)", fontSize: "12px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "5px" }}>
            <Plus style={{ width: "13px", height: "13px" }} />Aggiungi attività
          </button>
        </div>
      )}
    </div>
  );
}

// ── TripListItem ──────────────────────────────────────────────────────────
function TripListItem({ trip, onEdit, onDelete, onTogglePublish }: {
  trip: UserTripRow; onEdit: () => void; onDelete: () => void; onTogglePublish: () => void;
}) {
  const isDraft = trip.status === "draft";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 14px", background: isDraft ? "rgba(255,255,255,0.04)" : "rgba(52,211,153,0.06)", border: isDraft ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(52,211,153,0.2)", borderRadius: "12px", marginBottom: "8px" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "13px", fontWeight: 700, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{trip.hero_emoji} {trip.title}</div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "2px" }}>
          <span style={{ fontSize: "10px", fontWeight: 700, padding: "2px 8px", borderRadius: "9999px", background: isDraft ? "rgba(255,255,255,0.08)" : "rgba(52,211,153,0.15)", color: isDraft ? "rgba(255,255,255,0.45)" : "#34d399" }}>
            {isDraft ? "Bozza" : "✓ Pubblicato"}
          </span>
          {trip.destination && <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)" }}>{trip.destination}</span>}
        </div>
      </div>
      <div style={{ display: "flex", gap: "5px", flexShrink: 0 }}>
        <button onClick={onEdit} style={{ width: "28px", height: "28px", borderRadius: "7px", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <Edit3 style={{ width: "12px", height: "12px" }} />
        </button>
        <button onClick={onTogglePublish} style={{ width: "28px", height: "28px", borderRadius: "7px", background: isDraft ? "rgba(52,211,153,0.12)" : "rgba(255,255,255,0.06)", border: isDraft ? "1px solid rgba(52,211,153,0.25)" : "1px solid rgba(255,255,255,0.08)", color: isDraft ? "#34d399" : "rgba(255,255,255,0.4)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          {isDraft ? <Globe style={{ width: "12px", height: "12px" }} /> : <Eye style={{ width: "12px", height: "12px" }} />}
        </button>
        <button onClick={onDelete} style={{ width: "28px", height: "28px", borderRadius: "7px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <Trash2 style={{ width: "12px", height: "12px" }} />
        </button>
      </div>
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────
interface CreateTripPageProps {
  userId?: string;
  trips: UserTripRow[];
  onSaveDraft: (draft: Partial<UserTripRow> & { title: string }) => Promise<UserTripRow | null>;
  onPublish: (id: string) => Promise<UserTripRow | null>;
  onDelete: (id: string) => void;
  mobileOnly?: boolean;
}

export function CreateTripPage({ userId, trips, onSaveDraft, onPublish, onDelete, mobileOnly = false }: CreateTripPageProps) {
  const emptyDraft = (): TripDraft => ({
    title: "", destination: "", description: "", days: [newDay(0)],
    coverPhoto: FALLBACK, budget: "", bestSeason: "", heroEmoji: "🗺️", status: "draft",
  });

  const [draft,        setDraft]        = useState<TripDraft>(emptyDraft());
  const [coverLoading, setCoverLoading] = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [publishing,   setPublishing]   = useState(false);
  const [saved,        setSaved]        = useState(false);
  const [showMobileMap,setShowMobileMap]= useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!draft.destination || draft.destination.length < 3) return;
    const timer = setTimeout(() => {
      setCoverLoading(true);
      fetchPhoto(`${draft.destination} landmark travel`)
        .then(url => setDraft(d => ({ ...d, coverPhoto: url })))
        .catch(() => {})
        .finally(() => setCoverLoading(false));
    }, 800);
    return () => clearTimeout(timer);
  }, [draft.destination]);

  const loadTrip = (trip: UserTripRow) => {
    setDraft({ id: trip.id, title: trip.title, destination: trip.destination, description: trip.description, days: trip.days ?? [newDay(0)], coverPhoto: trip.cover_photo || FALLBACK, budget: trip.budget, bestSeason: trip.best_season, heroEmoji: trip.hero_emoji, status: trip.status });
    setSaved(false);
  };

  const handleSaveDraft = async () => {
    if (!draft.title || !userId) return;
    setSaving(true);
    const result = await onSaveDraft({ id: draft.id, title: draft.title, destination: draft.destination, description: draft.description, cover_photo: draft.coverPhoto, budget: draft.budget, best_season: draft.bestSeason, hero_emoji: draft.heroEmoji, status: "draft", days: draft.days });
    if (result) { setDraft(d => ({ ...d, id: result.id, status: "draft" })); setSaved(true); setTimeout(() => setSaved(false), 2000); }
    setSaving(false);
  };

  const handlePublish = async () => {
    if (!draft.title || !userId) return;
    setPublishing(true);
    const savedResult = await onSaveDraft({ id: draft.id, title: draft.title, destination: draft.destination, description: draft.description, cover_photo: draft.coverPhoto, budget: draft.budget, best_season: draft.bestSeason, hero_emoji: draft.heroEmoji, status: "published", days: draft.days });
    if (savedResult) { await onPublish(savedResult.id); setDraft(d => ({ ...d, id: savedResult.id, status: "published" })); }
    setPublishing(false);
  };

  const previewItinerary = draft.destination ? {
    title: draft.title || "Anteprima", destination: draft.destination, durationDays: draft.days.length,
    vibe: draft.description, totalBudget: draft.budget, bestSeason: draft.bestSeason,
    heroEmoji: draft.heroEmoji, tripPhotos: [],
    days: draft.days.map((d, i) => ({ day: i + 1, title: d.title, summary: d.summary, activities: d.activities.filter(a => a.title).map(a => ({ ...a })) })),
    packingList: [],
  } : null;

  const drafts    = trips.filter(t => t.status === "draft");
  const published = trips.filter(t => t.status === "published");

  const editor = (
    <div style={{ padding: "20px", boxSizing: "border-box" }}>
      <div style={{ marginBottom: "20px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "10px" }}>
        <div>
          <h1 style={{ fontSize: "18px", fontWeight: 900, color: "#fff", marginBottom: "2px" }}>✏️ Crea un viaggio</h1>
          <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)" }}>Crea e condividi itinerari con la community Waydora</p>
        </div>
        {mobileOnly && previewItinerary && (
          <button onClick={() => setShowMobileMap(true)}
            style={{ display: "flex", alignItems: "center", gap: "6px", padding: "7px 12px", borderRadius: "9999px", background: "rgba(66,133,244,0.15)", color: "#4285f4", border: "1px solid rgba(66,133,244,0.3)", fontSize: "12px", fontWeight: 600, cursor: "pointer", flexShrink: 0 }}>
            <MapPin style={{ width: "13px", height: "13px" }} />Mappa
          </button>
        )}
      </div>

      {/* Cover */}
      <div style={{ position: "relative", height: "140px", borderRadius: "12px", overflow: "hidden", marginBottom: "16px", background: "rgba(255,255,255,0.05)" }}>
        <img src={draft.coverPhoto} alt="cover" style={{ width: "100%", height: "100%", objectFit: "cover", opacity: coverLoading ? 0.5 : 1, transition: "opacity 0.3s" }} />
        {coverLoading && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}><Loader2 style={{ width: "22px", height: "22px", color: "#fff", animation: "wd-spin 0.8s linear infinite" }} /></div>}
        <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) setDraft(d => ({ ...d, coverPhoto: URL.createObjectURL(f) })); e.target.value = ""; }} />
        <button onClick={() => fileRef.current?.click()} style={{ position: "absolute", bottom: "8px", right: "8px", display: "flex", alignItems: "center", gap: "5px", padding: "5px 10px", borderRadius: "7px", background: "rgba(0,0,0,0.6)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", fontSize: "11px", fontWeight: 600, cursor: "pointer" }}>
          <Upload style={{ width: "11px", height: "11px" }} />Cambia
        </button>
      </div>

      {/* Campi */}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "16px" }}>
        <div style={{ display: "flex", gap: "8px" }}>
          <input value={draft.heroEmoji} onChange={e => setDraft(d => ({ ...d, heroEmoji: e.target.value }))} placeholder="🗺️"
            style={{ ...inp, width: "48px", textAlign: "center", fontSize: "18px", flexShrink: 0 }} />
          <input value={draft.title} onChange={e => setDraft(d => ({ ...d, title: e.target.value }))} placeholder="Titolo del viaggio *"
            style={{ ...inp }} />
        </div>
        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
          <MapPin style={{ width: "14px", height: "14px", color: "rgba(255,255,255,0.35)", flexShrink: 0 }} />
          <input value={draft.destination} onChange={e => setDraft(d => ({ ...d, destination: e.target.value }))} placeholder="Destinazione * (es. Tokyo, Giappone)"
            style={{ ...inp }} />
        </div>
        <textarea value={draft.description} onChange={e => setDraft(d => ({ ...d, description: e.target.value }))} placeholder="Descrizione breve..."
          style={{ ...inp, minHeight: "64px", resize: "vertical" }} />
        <div style={{ display: "flex", gap: "8px" }}>
          <input value={draft.budget} onChange={e => setDraft(d => ({ ...d, budget: e.target.value }))} placeholder="💰 Budget (es. €800)" style={{ ...inp }} />
          <input value={draft.bestSeason} onChange={e => setDraft(d => ({ ...d, bestSeason: e.target.value }))} placeholder="🌤 Periodo" style={{ ...inp }} />
        </div>
      </div>

      {/* Giorni */}
      <div style={{ marginBottom: "14px" }}>
        <div style={{ fontSize: "11px", fontWeight: 700, color: "rgba(255,255,255,0.5)", marginBottom: "10px", textTransform: "uppercase", letterSpacing: "0.1em" }}>
          📅 Itinerario — {draft.days.length} {draft.days.length === 1 ? "giorno" : "giorni"}
        </div>
        {draft.days.map((day, i) => (
          <DayEditor key={day.id} day={day} dayIndex={i}
            onChange={u => setDraft(d => ({ ...d, days: d.days.map(dd => dd.id === day.id ? u : dd) }))}
            onRemove={() => setDraft(d => ({ ...d, days: d.days.filter(dd => dd.id !== day.id) }))} />
        ))}
        <button onClick={() => setDraft(d => ({ ...d, days: [...d.days, newDay(d.days.length)] }))}
          style={{ width: "100%", padding: "8px", borderRadius: "10px", background: "rgba(255,255,255,0.04)", border: "1px dashed rgba(255,255,255,0.14)", color: "rgba(255,255,255,0.45)", fontSize: "12px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", boxSizing: "border-box" }}>
          <Plus style={{ width: "14px", height: "14px" }} />Aggiungi giorno
        </button>
      </div>

      {/* Azioni */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "24px" }}>
        <button onClick={handleSaveDraft} disabled={!draft.title || saving}
          style={{ flex: 1, padding: "11px", borderRadius: "11px", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", color: saved ? "#34d399" : "rgba(255,255,255,0.75)", fontSize: "13px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
          {saving ? <Loader2 style={{ width: "14px", height: "14px", animation: "wd-spin 0.8s linear infinite" }} /> : saved ? <CheckCircle style={{ width: "14px", height: "14px" }} /> : <Save style={{ width: "14px", height: "14px" }} />}
          {saving ? "Salvataggio..." : saved ? "Salvato!" : "Salva bozza"}
        </button>
        <button onClick={handlePublish} disabled={!draft.title || !draft.destination || publishing}
          style={{ flex: 2, padding: "11px", borderRadius: "11px", background: draft.title && draft.destination ? "linear-gradient(135deg,#f97316,#a855f7)" : "rgba(255,255,255,0.07)", border: "none", color: "#fff", fontSize: "13px", fontWeight: 700, cursor: draft.title && draft.destination ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", opacity: publishing ? 0.8 : 1 }}>
          {publishing ? <Loader2 style={{ width: "14px", height: "14px", animation: "wd-spin 0.8s linear infinite" }} /> : <Globe style={{ width: "14px", height: "14px" }} />}
          {draft.status === "published" ? "Aggiorna viaggio" : "Pubblica viaggio"}
        </button>
      </div>

      {/* Lista */}
      {(drafts.length > 0 || published.length > 0) && (
        <div>
          <div style={{ height: "1px", background: "rgba(255,255,255,0.07)", marginBottom: "16px" }} />
          {drafts.length > 0 && (
            <div style={{ marginBottom: "16px" }}>
              <div style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", color: "rgba(255,255,255,0.35)", marginBottom: "8px" }}>Bozze ({drafts.length})</div>
              {drafts.map(t => <TripListItem key={t.id} trip={t} onEdit={() => loadTrip(t)} onDelete={() => onDelete(t.id)} onTogglePublish={() => onPublish(t.id)} />)}
            </div>
          )}
          {published.length > 0 && (
            <div style={{ marginBottom: "24px" }}>
              <div style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", color: "rgba(52,211,153,0.6)", marginBottom: "8px" }}>Pubblicati ({published.length})</div>
              {published.map(t => <TripListItem key={t.id} trip={t} onEdit={() => loadTrip(t)} onDelete={() => onDelete(t.id)} onTogglePublish={async () => { await onSaveDraft({ id: t.id, title: t.title, status: "draft" }); }} />)}
            </div>
          )}
        </div>
      )}
      <style>{`@keyframes wd-spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  // ── Mobile: single column ─────────────────────────────────────────────
  if (mobileOnly) {
    return (
      <div style={{ height: "100%", background: "#0a0a12", overflowY: "auto" }}>
        {editor}
        {showMobileMap && (
          <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "#0a0a12", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: "12px", borderBottom: "1px solid rgba(255,255,255,0.07)", flexShrink: 0, background: "rgba(10,10,18,0.95)" }}>
              <button onClick={() => setShowMobileMap(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.7)", fontSize: "14px", fontWeight: 600, display: "flex", alignItems: "center", gap: "6px" }}>
                ← Torna all'editor
              </button>
            </div>
            <div style={{ flex: 1, minHeight: 0 }}>
              {previewItinerary ? <TripMap itinerary={previewItinerary} /> : (
                <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px", color: "rgba(255,255,255,0.3)", textAlign: "center", padding: "32px" }}>
                  <MapPin style={{ width: "40px", height: "40px", opacity: 0.3 }} />
                  <p style={{ fontSize: "14px" }}>Inserisci una destinazione per vedere la mappa</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Desktop: split ─────────────────────────────────────────────────────
  return (
    <div style={{ height: "100%", display: "flex", overflow: "hidden", background: "#0a0a12" }}>
      <div style={{ flex: "0 0 50%", overflowY: "auto", borderRight: "1px solid rgba(255,255,255,0.07)" }}>
        {editor}
      </div>
      <div style={{ flex: "0 0 50%", display: "flex", flexDirection: "column" }}>
        {previewItinerary ? <TripMap itinerary={previewItinerary} /> : (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px", color: "rgba(255,255,255,0.3)", textAlign: "center", padding: "32px" }}>
            <MapPin style={{ width: "40px", height: "40px", opacity: 0.3 }} />
            <p style={{ fontSize: "14px" }}>Inserisci una destinazione per vedere la mappa</p>
          </div>
        )}
      </div>
    </div>
  );
}