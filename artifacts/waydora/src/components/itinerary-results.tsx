import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Bed, Utensils, Compass, Bus, MapPin, Moon,
  ExternalLink, Sparkles, CheckSquare, Square,
  type LucideIcon,
} from "lucide-react";
type ItineraryData = any;
type ItineraryActivity = any;
type PackingCategory = any;
import { fetchPhoto } from "@/lib/photos";
import { cn } from "@/lib/utils";
 
const FALLBACK = "https://images.pexels.com/photos/346885/pexels-photo-346885.jpeg";
 
// ── Palette per categoria ─────────────────────────────────────────────────
const CATEGORY_STYLE: Record<string, {
  icon: LucideIcon; label: string;
  gradient: string; iconBg: string; iconColor: string;
  badgeBg: string; badgeColor: string; line: string;
}> = {
  stay: {
    icon: Bed, label: "Soggiorno",
    gradient: "linear-gradient(135deg,#6366f1,#8b5cf6)",
    iconBg: "rgba(99,102,241,0.2)", iconColor: "#818cf8",
    badgeBg: "rgba(99,102,241,0.18)", badgeColor: "#a5b4fc",
    line: "rgba(99,102,241,0.3)",
  },
  food: {
    icon: Utensils, label: "Cibo",
    gradient: "linear-gradient(135deg,#f43f5e,#fb923c)",
    iconBg: "rgba(244,63,94,0.2)", iconColor: "#fb7185",
    badgeBg: "rgba(244,63,94,0.18)", badgeColor: "#fda4af",
    line: "rgba(244,63,94,0.3)",
  },
  experience: {
    icon: Compass, label: "Esperienza",
    gradient: "linear-gradient(135deg,#0ea5e9,#06b6d4)",
    iconBg: "rgba(14,165,233,0.2)", iconColor: "#38bdf8",
    badgeBg: "rgba(14,165,233,0.18)", badgeColor: "#7dd3fc",
    line: "rgba(14,165,233,0.3)",
  },
  transport: {
    icon: Bus, label: "Trasporto",
    gradient: "linear-gradient(135deg,#64748b,#94a3b8)",
    iconBg: "rgba(100,116,139,0.2)", iconColor: "#94a3b8",
    badgeBg: "rgba(100,116,139,0.18)", badgeColor: "#cbd5e1",
    line: "rgba(100,116,139,0.3)",
  },
  sightseeing: {
    icon: MapPin, label: "Visita",
    gradient: "linear-gradient(135deg,#f59e0b,#eab308)",
    iconBg: "rgba(245,158,11,0.2)", iconColor: "#fbbf24",
    badgeBg: "rgba(245,158,11,0.18)", badgeColor: "#fcd34d",
    line: "rgba(245,158,11,0.3)",
  },
  nightlife: {
    icon: Moon, label: "Nightlife",
    gradient: "linear-gradient(135deg,#ec4899,#a855f7)",
    iconBg: "rgba(236,72,153,0.2)", iconColor: "#f472b6",
    badgeBg: "rgba(236,72,153,0.18)", badgeColor: "#f9a8d4",
    line: "rgba(236,72,153,0.3)",
  },
};
 
const DEFAULT_STYLE = {
  icon: Sparkles, label: "Attività",
  gradient: "linear-gradient(135deg,#a78bfa,#c084fc)",
  iconBg: "rgba(167,139,250,0.2)", iconColor: "#c084fc",
  badgeBg: "rgba(167,139,250,0.18)", badgeColor: "#ddd6fe",
  line: "rgba(167,139,250,0.3)",
};
 
// ── Hook: carica una foto Pexels ──────────────────────────────────────────
function usePexelsPhoto(query: string | null) {
  const [src, setSrc] = useState<string>(FALLBACK);
  const [loading, setLoading] = useState(true);
 
  useEffect(() => {
    if (!query) { setLoading(false); return; }
    setLoading(true);
    fetchPhoto(query)
      .then((url) => setSrc(url))
      .catch(() => setSrc(FALLBACK))
      .finally(() => setLoading(false));
  }, [query]);
 
  return { src, loading };
}
 
// ── Singola attività ──────────────────────────────────────────────────────
function ActivityCard({ activity, index }: { activity: ItineraryActivity; index: number }) {
  const style = CATEGORY_STYLE[activity.category] ?? DEFAULT_STYLE;
  const Icon = style.icon;
 
  return (
    <motion.div
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: Math.min(index * 0.06, 0.35) }}
      className="relative pl-11 pb-5 last:pb-0 group"
    >
      {/* Linea verticale */}
      <div
        className="absolute left-[20px] top-10 bottom-0 w-px group-last:hidden"
        style={{ background: style.line }}
      />
 
      {/* Icona */}
      <div
        className="absolute left-1 top-1 w-8 h-8 rounded-full flex items-center justify-center z-10"
        style={{ background: style.iconBg, border: `1.5px solid ${style.iconColor}50` }}
      >
        <Icon style={{ width: "15px", height: "15px", color: style.iconColor }} />
      </div>
 
      {/* Card — sfondo solido, niente blur */}
      <div style={{
        background: "rgba(22,15,40,1)",
        border: "1px solid rgba(255,255,255,0.13)",
        borderRadius: "14px",
        padding: "14px 16px",
        boxShadow: "0 2px 12px rgba(0,0,0,0.4)",
      }}>
        {/* Header */}
        <div className="flex flex-wrap items-center gap-2 mb-2.5">
          <span
            className="text-xs font-bold px-2.5 py-0.5 rounded-full"
            style={{ background: style.badgeBg, color: style.badgeColor }}
          >
            {activity.time}
          </span>
          <span
            className="text-[10px] font-bold uppercase tracking-wider"
            style={{ color: "rgba(255,255,255,0.35)" }}
          >
            {style.label}
          </span>
          {activity.estimatedCost && (
            <span
              className="text-xs font-semibold ml-auto px-2 py-0.5 rounded-full"
              style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.6)" }}
            >
              {activity.estimatedCost}
            </span>
          )}
        </div>
 
        {/* Titolo */}
        <h4 style={{ fontSize: "15px", fontWeight: 700, color: "#ffffff", marginBottom: "6px", lineHeight: 1.3 }}>
          {activity.title}
        </h4>
 
        {/* Descrizione */}
        <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.6)", lineHeight: 1.65, whiteSpace: "pre-line" }}>
          {activity.description}
        </p>
 
        {/* Bottone prenota — gradiente della categoria */}
        {activity.affiliate && (
          <div className="mt-3 flex items-center gap-2">
            <a
              href={activity.affiliate.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full text-white transition-all duration-200 hover:scale-105"
              style={{
                background: style.gradient,
                boxShadow: `0 2px 10px ${style.iconColor}40`,
                textDecoration: "none",
              }}
            >
              {activity.affiliate.label}
              <ExternalLink style={{ width: "11px", height: "11px" }} />
            </a>
            <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.28)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
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
            marginLeft: "auto", fontSize: "12px", fontWeight: 600,
            padding: "3px 10px", borderRadius: "9999px",
            background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.6)",
            border: "1px solid rgba(255,255,255,0.1)",
          }}>
            {weather}
          </span>
        )}
      </div>
      <p style={{ fontSize: "13px", fontStyle: "italic", paddingLeft: "40px", color: "rgba(255,255,255,0.4)" }}>
        {summary}
      </p>
      <div style={{ height: "1px", background: "rgba(255,255,255,0.06)", marginTop: "12px", marginBottom: "16px" }} />
    </div>
  );
}
 
// ── Foto viaggio in fondo (Pexels) ────────────────────────────────────────
function TripPhoto({ query, isHero }: { query: string; isHero: boolean }) {
  const { src, loading } = usePexelsPhoto(query);
 
  return (
    <div style={{
      position: "relative",
      borderRadius: "12px",
      overflow: "hidden",
      height: isHero ? "180px" : "120px",
      background: "rgba(255,255,255,0.05)",
    }}>
      {loading && (
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(90deg,rgba(255,255,255,0.03) 25%,rgba(255,255,255,0.07) 50%,rgba(255,255,255,0.03) 75%)",
          animation: "shimmer 1.5s infinite",
        }} />
      )}
      <img
        src={src}
        alt={query}
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", opacity: loading ? 0 : 1, transition: "opacity 0.4s ease" }}
      />
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top,rgba(0,0,0,0.5) 0%,transparent 55%)" }} />
    </div>
  );
}
 
function TripPhotos({ queries, destination }: { queries?: string[]; destination: string }) {
  // Usa tripPhotos da Claude; fallback con query sulla destinazione
  const photoQueries = (queries && queries.length > 0)
    ? queries.slice(0, 4)
    : [
        `${destination} landmark`,
        `${destination} street`,
        `${destination} food`,
      ];
 
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      style={{ marginTop: "24px" }}
    >
      <p style={{
        fontSize: "11px", fontWeight: 700, letterSpacing: "0.2em",
        textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: "10px",
      }}>
        📸 Il tuo viaggio
      </p>
 
      {/* Prima foto grande (hero), le altre in griglia 2 col */}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <TripPhoto query={photoQueries[0]} isHero={true} />
        {photoQueries.length > 1 && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
            {photoQueries.slice(1).map((q, i) => (
              <TripPhoto key={i} query={q} isHero={false} />
            ))}
          </div>
        )}
      </div>
 
      <style>{`@keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}`}</style>
    </motion.div>
  );
}
 
// ── Itinerary principale ──────────────────────────────────────────────────
export function ItineraryResults({ itinerary }: { itinerary: ItineraryData }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
 
      {/* Header viaggio */}
      <div style={{
        background: "linear-gradient(135deg,rgba(249,115,22,0.12) 0%,rgba(168,85,247,0.12) 100%)",
        border: "1px solid rgba(255,255,255,0.10)",
        borderRadius: "16px", padding: "16px", marginBottom: "20px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "10px" }}>
          {itinerary.heroEmoji && <span style={{ fontSize: "2rem" }}>{itinerary.heroEmoji}</span>}
          <div>
            <h2 style={{
              fontSize: "clamp(1.1rem,2.5vw,1.4rem)", fontWeight: 900,
              color: "#fff", letterSpacing: "-0.02em", lineHeight: 1.2,
            }}>
              {itinerary.title}
            </h2>
            <p style={{ fontSize: "13px", fontStyle: "italic", color: "rgba(255,255,255,0.45)", marginTop: "2px" }}>
              "{itinerary.vibe}"
            </p>
          </div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
          {[
            `📍 ${itinerary.destination}`,
            `🗓 ${itinerary.durationDays} giorni`,
            `💰 ${itinerary.totalBudget}`,
            `🌤 ${itinerary.bestSeason}`,
          ].filter(l => !l.includes("undefined")).map((label) => (
            <span key={label} style={{
              fontSize: "12px", fontWeight: 600, padding: "3px 10px", borderRadius: "9999px",
              background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.7)",
              border: "1px solid rgba(255,255,255,0.1)",
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
 
      {/* Foto Pexels in fondo */}
      <TripPhotos queries={itinerary.tripPhotos} destination={itinerary.destination} />
    </motion.div>
  );
}
 
// ── Lista Bagaglio ────────────────────────────────────────────────────────
export function PackingList({ list }: { list: PackingCategory[] }) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
 
  if (!list || list.length === 0) return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", height: "100%", gap: "12px",
      color: "rgba(255,255,255,0.3)", padding: "32px", textAlign: "center",
    }}>
      <CheckSquare style={{ width: "32px", height: "32px", opacity: 0.3 }} />
      <p style={{ fontSize: "13px" }}>La lista bagaglio apparirà qui dopo aver pianificato un viaggio</p>
    </div>
  );
 
  return (
    <div style={{ padding: "16px", overflowY: "auto", height: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "20px" }}>
        <CheckSquare style={{ width: "16px", height: "16px", color: "rgba(255,255,255,0.6)" }} />
        <h3 style={{ fontSize: "14px", fontWeight: 700, color: "#fff" }}>Lista Bagaglio</h3>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        {list.map((category: any, catIndex: number) => (
          <div key={category.category}>
            <h4 style={{
              fontSize: "10px", fontWeight: 700, textTransform: "uppercase",
              letterSpacing: "0.2em", color: "rgba(255,255,255,0.5)", marginBottom: "8px",
            }}>
              {category.category}
            </h4>
            <ul style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {category.items.map((item: string, itemIndex: number) => {
                const key = `${catIndex}-${itemIndex}`;
                const isChecked = checked[key];
                return (
                  <li
                    key={itemIndex}
                    onClick={() => setChecked(prev => ({ ...prev, [key]: !prev[key] }))}
                    style={{
                      display: "flex", alignItems: "flex-start", gap: "10px",
                      cursor: "pointer", fontSize: "13px",
                      color: isChecked ? "rgba(255,255,255,0.28)" : "rgba(255,255,255,0.72)",
                    }}
                  >
                    <button style={{ marginTop: "1px", flexShrink: 0, background: "none", border: "none", padding: 0, cursor: "pointer" }}>
                      {isChecked
                        ? <CheckSquare style={{ width: "14px", height: "14px", color: "rgba(255,255,255,0.5)" }} />
                        : <Square style={{ width: "14px", height: "14px", color: "rgba(255,255,255,0.2)" }} />}
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
 