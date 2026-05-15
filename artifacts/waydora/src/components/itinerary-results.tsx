import { useState } from "react";
import { motion } from "framer-motion";
import {
  Bed, Utensils, Compass, Bus, MapPin, Moon,
  ExternalLink, Sparkles, CheckSquare, Square,
  type LucideIcon,
} from "lucide-react";
type ItineraryData = any;
type ItineraryActivity = any;
type PackingCategory = any;
import { cn } from "@/lib/utils";
 
// ── Palette per categoria — gradiente + colore testo ─────────────────────
const CATEGORY_STYLE: Record<string, {
  icon: LucideIcon;
  label: string;
  gradient: string;       // bottone prenota
  iconBg: string;         // sfondo icona timeline
  iconColor: string;      // colore icona
  badgeBg: string;        // sfondo badge orario
  badgeColor: string;
  line: string;           // colore linea timeline
}> = {
  stay: {
    icon: Bed,
    label: "Soggiorno",
    gradient: "linear-gradient(135deg,#6366f1,#8b5cf6)",
    iconBg: "rgba(99,102,241,0.18)",
    iconColor: "#818cf8",
    badgeBg: "rgba(99,102,241,0.15)",
    badgeColor: "#a5b4fc",
    line: "rgba(99,102,241,0.35)",
  },
  food: {
    icon: Utensils,
    label: "Cibo",
    gradient: "linear-gradient(135deg,#f43f5e,#fb7185)",
    iconBg: "rgba(244,63,94,0.18)",
    iconColor: "#fb7185",
    badgeBg: "rgba(244,63,94,0.15)",
    badgeColor: "#fda4af",
    line: "rgba(244,63,94,0.35)",
  },
  experience: {
    icon: Compass,
    label: "Esperienza",
    gradient: "linear-gradient(135deg,#0ea5e9,#38bdf8)",
    iconBg: "rgba(14,165,233,0.18)",
    iconColor: "#38bdf8",
    badgeBg: "rgba(14,165,233,0.15)",
    badgeColor: "#7dd3fc",
    line: "rgba(14,165,233,0.35)",
  },
  transport: {
    icon: Bus,
    label: "Trasporto",
    gradient: "linear-gradient(135deg,#64748b,#94a3b8)",
    iconBg: "rgba(100,116,139,0.18)",
    iconColor: "#94a3b8",
    badgeBg: "rgba(100,116,139,0.15)",
    badgeColor: "#cbd5e1",
    line: "rgba(100,116,139,0.35)",
  },
  sightseeing: {
    icon: MapPin,
    label: "Visita",
    gradient: "linear-gradient(135deg,#f59e0b,#fbbf24)",
    iconBg: "rgba(245,158,11,0.18)",
    iconColor: "#fbbf24",
    badgeBg: "rgba(245,158,11,0.15)",
    badgeColor: "#fcd34d",
    line: "rgba(245,158,11,0.35)",
  },
  nightlife: {
    icon: Moon,
    label: "Nightlife",
    gradient: "linear-gradient(135deg,#ec4899,#f472b6)",
    iconBg: "rgba(236,72,153,0.18)",
    iconColor: "#f472b6",
    badgeBg: "rgba(236,72,153,0.15)",
    badgeColor: "#f9a8d4",
    line: "rgba(236,72,153,0.35)",
  },
};
 
const DEFAULT_STYLE = {
  icon: Sparkles,
  label: "Attività",
  gradient: "linear-gradient(135deg,#a78bfa,#c084fc)",
  iconBg: "rgba(167,139,250,0.18)",
  iconColor: "#c084fc",
  badgeBg: "rgba(167,139,250,0.15)",
  badgeColor: "#ddd6fe",
  line: "rgba(167,139,250,0.35)",
};
 
// ── Foto dinamiche Unsplash (stabili, no source.unsplash.com) ─────────────
// Usa l'API di Unsplash con parametri fissi per foto coerenti
function buildUnsplashUrl(query: string) {
  // Aggiungiamo un seed basato sulla query per avere sempre la stessa foto per la stessa query
  const seed = query.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return `https://images.unsplash.com/1600x900/?${encodeURIComponent(query)}&auto=format&fit=crop&q=80&seed=${seed}`;
}
 
// ── Singola attività ──────────────────────────────────────────────────────
function ActivityCard({ activity, index }: { activity: ItineraryActivity; index: number }) {
  const style = CATEGORY_STYLE[activity.category] ?? DEFAULT_STYLE;
  const Icon = style.icon;
 
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: Math.min(index * 0.06, 0.4) }}
      className="relative pl-11 pb-5 last:pb-0 group"
    >
      {/* Linea verticale */}
      <div className="absolute left-[20px] top-10 bottom-0 w-px group-last:hidden"
        style={{ background: style.line }} />
 
      {/* Icona */}
      <div className="absolute left-1 top-1 w-8 h-8 rounded-full flex items-center justify-center z-10"
        style={{ background: style.iconBg, border: `1.5px solid ${style.iconColor}40` }}>
        <Icon style={{ width: "15px", height: "15px", color: style.iconColor }} />
      </div>
 
      {/* Card con sfondo visibile */}
      <div style={{
        background: "rgba(255,255,255,0.09)",
        backdropFilter: "blur(16px) saturate(140%)",
        WebkitBackdropFilter: "blur(16px) saturate(140%)",
        border: `1px solid rgba(255,255,255,0.16)`,
        borderRadius: "14px",
        padding: "14px 16px",
        boxShadow: "0 2px 20px rgba(0,0,0,0.25)",
      }}>
        {/* Header */}
        <div className="flex flex-wrap items-center gap-2 mb-2.5">
          <span className="text-xs font-bold px-2.5 py-0.5 rounded-full"
            style={{ background: style.badgeBg, color: style.badgeColor }}>
            {activity.time}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wider"
            style={{ color: "rgba(255,255,255,0.4)" }}>
            {style.label}
          </span>
          {activity.estimatedCost && (
            <span className="text-xs font-semibold ml-auto px-2 py-0.5 rounded-full"
              style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.65)" }}>
              {activity.estimatedCost}
            </span>
          )}
        </div>
 
        {/* Titolo — bianco pieno, leggibile */}
        <h4 style={{ fontSize: "15px", fontWeight: 700, color: "#ffffff", marginBottom: "6px", lineHeight: 1.3 }}>
          {activity.title}
        </h4>
 
        {/* Descrizione — grigio chiaro leggibile */}
        <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.65)", lineHeight: 1.65, whiteSpace: "pre-line" }}>
          {activity.description}
        </p>
 
        {/* Bottone prenota con gradiente della categoria */}
        {activity.affiliate && (
          <div className="mt-3 flex items-center gap-2">
            <a
              href={activity.affiliate.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full text-white transition-all duration-200 hover:scale-105 hover:shadow-lg"
              style={{
                background: style.gradient,
                boxShadow: `0 2px 12px ${style.iconColor}40`,
                textDecoration: "none",
              }}
            >
              {activity.affiliate.label}
              <ExternalLink style={{ width: "11px", height: "11px" }} />
            </a>
            <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              via {activity.affiliate.provider}
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
}
 
// ── Header giorno ─────────────────────────────────────────────────────────
function DayHeader({ dayIndex, title, weather, summary }: {
  dayIndex: number; title: string; weather?: string; summary: string;
}) {
  return (
    <div style={{ marginBottom: "16px", paddingTop: dayIndex > 0 ? "28px" : "0" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", marginBottom: "6px" }}>
        <div style={{
          width: "30px", height: "30px", borderRadius: "50%", flexShrink: 0,
          background: "linear-gradient(135deg,#f97316,#a855f7)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontWeight: 900, fontSize: "13px", color: "#fff",
        }}>
          {dayIndex + 1}
        </div>
        <h3 style={{ fontSize: "16px", fontWeight: 800, color: "#ffffff", letterSpacing: "-0.01em" }}>
          {title}
        </h3>
        {weather && (
          <span style={{
            marginLeft: "auto", fontSize: "12px", fontWeight: 600, padding: "3px 10px",
            borderRadius: "9999px", background: "rgba(255,255,255,0.08)",
            color: "rgba(255,255,255,0.65)", border: "1px solid rgba(255,255,255,0.12)",
          }}>
            {weather}
          </span>
        )}
      </div>
      <p style={{ fontSize: "13px", fontStyle: "italic", paddingLeft: "40px", color: "rgba(255,255,255,0.45)" }}>
        {summary}
      </p>
      <div style={{ height: "1px", background: "rgba(255,255,255,0.07)", marginTop: "12px", marginBottom: "16px" }} />
    </div>
  );
}
 
// ── Foto dinamiche alla fine dell'itinerario ──────────────────────────────
function TripPhotos({ queries, destination }: { queries?: string[]; destination: string }) {
  // Genera 3-4 query di fallback basate sulla destinazione se tripPhotos non c'è
  const photoQueries = (queries && queries.length > 0)
    ? queries.slice(0, 4)
    : [
        `${destination} city landmark`,
        `${destination} street food`,
        `${destination} travel landscape`,
        `${destination} culture architecture`,
      ];
 
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      style={{ marginTop: "24px" }}
    >
      <p style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: "10px" }}>
        📸 Il tuo viaggio
      </p>
      <div style={{
        display: "grid",
        gridTemplateColumns: photoQueries.length >= 3 ? "1fr 1fr" : "1fr",
        gap: "8px",
      }}>
        {photoQueries.map((query, i) => (
          <div key={i} style={{
            position: "relative",
            borderRadius: "12px",
            overflow: "hidden",
            height: i === 0 && photoQueries.length >= 3 ? "160px" : "120px",
            gridColumn: i === 0 && photoQueries.length >= 3 ? "1 / -1" : "auto",
          }}>
            <img
              src={buildUnsplashUrl(query)}
              alt={query}
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              loading="lazy"
              onError={(e) => {
                // Fallback se l'immagine non carica
                e.currentTarget.src = `https://picsum.photos/seed/${encodeURIComponent(query)}/800/400`;
              }}
            />
            <div style={{
              position: "absolute", inset: 0,
              background: "linear-gradient(to top, rgba(0,0,0,0.45) 0%, transparent 55%)",
            }} />
          </div>
        ))}
      </div>
    </motion.div>
  );
}
 
// ── Itinerary principale ──────────────────────────────────────────────────
export function ItineraryResults({ itinerary }: { itinerary: ItineraryData }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
 
      {/* Header viaggio — gradiente arancio→viola */}
      <div style={{
        background: "linear-gradient(135deg,rgba(249,115,22,0.15) 0%,rgba(168,85,247,0.15) 100%)",
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: "16px",
        padding: "16px",
        marginBottom: "20px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "10px" }}>
          {itinerary.heroEmoji && <span style={{ fontSize: "2rem" }}>{itinerary.heroEmoji}</span>}
          <div>
            <h2 style={{ fontSize: "clamp(1.1rem,2.5vw,1.4rem)", fontWeight: 900, color: "#fff", letterSpacing: "-0.02em", lineHeight: 1.2 }}>
              {itinerary.title}
            </h2>
            <p style={{ fontSize: "13px", fontStyle: "italic", color: "rgba(255,255,255,0.5)", marginTop: "2px" }}>
              "{itinerary.vibe}"
            </p>
          </div>
        </div>
        {/* Badge info */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
          {[
            { label: `📍 ${itinerary.destination}` },
            { label: `🗓 ${itinerary.durationDays} giorni` },
            { label: `💰 ${itinerary.totalBudget}` },
            { label: `🌤 ${itinerary.bestSeason}` },
          ].map(({ label }) => label.includes("undefined") ? null : (
            <span key={label} style={{
              fontSize: "12px", fontWeight: 600, padding: "3px 10px", borderRadius: "9999px",
              background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.75)",
              border: "1px solid rgba(255,255,255,0.12)",
            }}>
              {label}
            </span>
          ))}
        </div>
      </div>
 
      {/* Giorni */}
      {itinerary.days?.map((day: any, dayIndex: number) => (
        <div key={day.day}>
          <DayHeader dayIndex={dayIndex} title={day.title} weather={day.weather} summary={day.summary} />
          {day.activities?.map((activity: any, actIndex: number) => (
            <ActivityCard key={`${day.day}-${actIndex}`} activity={activity} index={actIndex} />
          ))}
        </div>
      ))}
 
      {/* Foto in fondo */}
      <TripPhotos queries={itinerary.tripPhotos} destination={itinerary.destination} />
    </motion.div>
  );
}
 
// ── Lista Bagaglio (per toolbar mappa) ────────────────────────────────────
export function PackingList({ list }: { list: PackingCategory[] }) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
 
  if (!list || list.length === 0) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: "12px", color: "rgba(255,255,255,0.3)", padding: "32px" }}>
      <CheckSquare style={{ width: "32px", height: "32px", opacity: 0.3 }} />
      <p style={{ fontSize: "13px" }}>La lista bagaglio apparirà qui dopo aver pianificato un viaggio</p>
    </div>
  );
 
  return (
    <div style={{ padding: "16px", overflowY: "auto", height: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "20px" }}>
        <CheckSquare style={{ width: "16px", height: "16px", color: "#a78bfa" }} />
        <h3 style={{ fontSize: "14px", fontWeight: 700, color: "#fff" }}>Lista Bagaglio</h3>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        {list.map((category: any, catIndex: number) => (
          <div key={category.category}>
            <h4 style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.2em", color: "#a78bfa", marginBottom: "8px" }}>
              {category.category}
            </h4>
            <ul style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {category.items.map((item: string, itemIndex: number) => {
                const key = `${catIndex}-${itemIndex}`;
                const isChecked = checked[key];
                return (
                  <li key={itemIndex}
                    onClick={() => setChecked(prev => ({ ...prev, [key]: !prev[key] }))}
                    style={{ display: "flex", alignItems: "flex-start", gap: "10px", cursor: "pointer", color: isChecked ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.75)", fontSize: "13px" }}>
                    <button style={{ marginTop: "1px", flexShrink: 0, background: "none", border: "none", padding: 0, cursor: "pointer" }}>
                      {isChecked
                        ? <CheckSquare style={{ width: "14px", height: "14px", color: "#a78bfa" }} />
                        : <Square style={{ width: "14px", height: "14px", color: "rgba(255,255,255,0.25)" }} />}
                    </button>
                    <span style={{ textDecoration: isChecked ? "line-through" : "none", lineHeight: 1.4 }}>{item}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
 