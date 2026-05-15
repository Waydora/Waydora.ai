import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Bed, Utensils, Compass, Bus, MapPin, Moon,
  ExternalLink, Sparkles, CheckSquare, Square, Cloud,
  type LucideIcon,
} from "lucide-react";
type ItineraryData = any;
type ItineraryActivity = any;
type PackingCategory = any;
 
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
 
// ── Stili glassmorphism ───────────────────────────────────────────────────
const glass = {
  background: "rgba(255,255,255,0.06)",
  backdropFilter: "blur(20px) saturate(140%)",
  WebkitBackdropFilter: "blur(20px) saturate(140%)",
  border: "1px solid rgba(255,255,255,0.10)",
  borderRadius: "16px",
} as React.CSSProperties;
 
const glassStrong = {
  background: "rgba(255,255,255,0.08)",
  backdropFilter: "blur(24px) saturate(160%)",
  WebkitBackdropFilter: "blur(24px) saturate(160%)",
  border: "1px solid rgba(255,255,255,0.14)",
  borderRadius: "20px",
} as React.CSSProperties;
 
const gradientText = {
  background: "linear-gradient(135deg,#ffffff 0%,#a78bfa 50%,#ec4899 100%)",
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
  backgroundClip: "text",
} as React.CSSProperties;
 
// ── Icone categoria ───────────────────────────────────────────────────────
const CATEGORY_ICON: Record<string, LucideIcon> = {
  stay: Bed, food: Utensils, experience: Compass,
  transport: Bus, sightseeing: MapPin, nightlife: Moon,
};
const CATEGORY_LABEL: Record<string, string> = {
  stay: "Soggiorno", food: "Cibo", experience: "Esperienza",
  transport: "Trasporto", sightseeing: "Visita", nightlife: "Nightlife",
};
const CATEGORY_COLOR: Record<string, string> = {
  stay: "#a78bfa", food: "#f472b6", experience: "#34d399",
  transport: "#60a5fa", sightseeing: "#a78bfa", nightlife: "#f59e0b",
};
 
// ── Foto viaggio da Unsplash tramite tripPhotos ────────────────────────────
function useTripPhoto(query: string) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    if (!query) return;
    // Usa Unsplash con photo_id stabili se disponibili, altrimenti query
    const url = `https://images.unsplash.com/1600x900/?${encodeURIComponent(query)}&auto=format&fit=crop&q=80`;
    setSrc(url);
  }, [query]);
  return src;
}
 
// ── Singola attività ──────────────────────────────────────────────────────
function ActivityCard({ activity, index }: { activity: ItineraryActivity; index: number }) {
  const Icon = CATEGORY_ICON[activity.category] ?? Sparkles;
  const color = CATEGORY_COLOR[activity.category] ?? "#a78bfa";
 
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: Math.min(index * 0.06, 0.4) }}
      className="relative pl-10 pb-5 last:pb-0 group"
    >
      {/* Linea verticale timeline */}
      <div className="absolute left-[19px] top-9 bottom-0 w-px group-last:hidden"
        style={{ background: "rgba(167,139,250,0.2)" }} />
 
      {/* Icona timeline */}
      <div className="absolute left-1 top-1 w-8 h-8 rounded-full flex items-center justify-center z-10"
        style={{ background: `${color}18`, border: `1px solid ${color}40` }}>
        <Icon style={{ width: "14px", height: "14px", color }} />
      </div>
 
      {/* Card */}
      <div style={{ ...glass, padding: "16px 18px" }}>
        {/* Header */}
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <span className="text-xs font-bold px-2.5 py-0.5 rounded-full"
            style={{ background: `${color}18`, color, border: `1px solid ${color}30` }}>
            {activity.time}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wider"
            style={{ color: "rgba(255,255,255,0.35)" }}>
            {CATEGORY_LABEL[activity.category] ?? activity.category}
          </span>
          {activity.estimatedCost && (
            <span className="text-xs font-semibold ml-auto"
              style={{ color: "rgba(255,255,255,0.45)" }}>
              {activity.estimatedCost}
            </span>
          )}
        </div>
 
        {/* Titolo */}
        <h4 className="font-bold text-white leading-tight mb-1.5" style={{ fontSize: "15px" }}>
          {activity.title}
        </h4>
 
        {/* Descrizione */}
        <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.55)", whiteSpace: "pre-line" }}>
          {activity.description}
        </p>
 
        {/* Link affiliato */}
        {activity.affiliate && (
          <div className="mt-3 flex items-center gap-2">
            <a href={activity.affiliate.url} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full transition-all duration-200 hover:scale-105"
              style={{ background: "rgba(167,139,250,0.15)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.3)" }}>
              {activity.affiliate.label}
              <ExternalLink style={{ width: "11px", height: "11px" }} />
            </a>
            <span className="text-[10px] uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.25)" }}>
              via {activity.affiliate.provider}
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
}
 
// ── Header di ogni giorno ─────────────────────────────────────────────────
function DayHeader({ dayIndex, title, weather, summary }: {
  dayIndex: number; title: string; weather?: string; summary: string;
}) {
  return (
    <div className="mb-5" style={{ paddingTop: dayIndex > 0 ? "24px" : "0" }}>
      <div className="flex items-center gap-3 flex-wrap mb-2">
        {/* Numero giorno */}
        <div className="flex items-center justify-center w-8 h-8 rounded-full font-black text-sm"
          style={{ background: "rgba(167,139,250,0.15)", border: "1px solid rgba(167,139,250,0.35)", color: "#a78bfa" }}>
          {dayIndex + 1}
        </div>
        <h3 className="font-bold text-white" style={{ fontSize: "17px", letterSpacing: "-0.01em" }}>
          {title}
        </h3>
        {weather && (
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full ml-auto"
            style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.1)" }}>
            {weather}
          </span>
        )}
      </div>
      <p className="text-sm italic pl-11" style={{ color: "rgba(255,255,255,0.4)" }}>
        {summary}
      </p>
      <div className="mt-3 mb-5 h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
    </div>
  );
}
 
// ── Foto viaggio in fondo all'itinerario ──────────────────────────────────
function TripPhotos({ queries }: { queries: string[] }) {
  if (!queries || queries.length === 0) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="mt-8 grid gap-3"
      style={{ gridTemplateColumns: queries.length > 1 ? "1fr 1fr" : "1fr" }}
    >
      {queries.slice(0, 2).map((query, i) => (
        <div key={i} className="relative overflow-hidden"
          style={{ borderRadius: "16px", height: queries.length > 1 ? "140px" : "200px" }}>
          <img
            src={`https://images.unsplash.com/1600x900/?${encodeURIComponent(query)}&auto=format&fit=crop&q=80`}
            alt={query}
            className="w-full h-full object-cover"
            style={{ transition: "transform 0.4s ease" }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.04)")}
            onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
          />
          <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.4) 0%, transparent 60%)" }} />
        </div>
      ))}
    </motion.div>
  );
}
 
// ── Itinerary principale ──────────────────────────────────────────────────
export function ItineraryResults({ itinerary }: { itinerary: ItineraryData }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-0"
    >
      {/* Header del viaggio */}
      <div className="mb-6 pb-5" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="flex items-center gap-3 mb-3">
          {itinerary.heroEmoji && (
            <span style={{ fontSize: "2rem" }}>{itinerary.heroEmoji}</span>
          )}
          <div>
            <h2 className="font-black text-white leading-tight" style={{ fontSize: "clamp(1.2rem, 3vw, 1.6rem)", letterSpacing: "-0.02em" }}>
              {itinerary.title}
            </h2>
            <p className="text-sm italic mt-0.5" style={{ color: "rgba(255,255,255,0.45)" }}>
              "{itinerary.vibe}"
            </p>
          </div>
        </div>
 
        {/* Badge info */}
        <div className="flex flex-wrap gap-2">
          {[
            { icon: MapPin, label: itinerary.destination },
            { icon: null, label: `${itinerary.durationDays} giorni` },
            { icon: null, label: itinerary.totalBudget },
            { icon: null, label: itinerary.bestSeason },
          ].map(({ icon: Icon, label }) => label ? (
            <span key={label} className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full"
              style={{ background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.2)", color: "rgba(255,255,255,0.7)" }}>
              {Icon && <Icon style={{ width: "11px", height: "11px", color: "#a78bfa" }} />}
              {label}
            </span>
          ) : null)}
        </div>
      </div>
 
      {/* Giorni */}
      {itinerary.days.map((day: any, dayIndex: number) => (
        <div key={day.day}>
          <DayHeader
            dayIndex={dayIndex}
            title={day.title}
            weather={day.weather}
            summary={day.summary}
          />
          <div>
            {day.activities.map((activity: any, actIndex: number) => (
              <ActivityCard
                key={`${day.day}-${actIndex}`}
                activity={activity}
                index={actIndex}
              />
            ))}
          </div>
        </div>
      ))}
 
      {/* Foto viaggio in fondo */}
      {itinerary.tripPhotos && itinerary.tripPhotos.length > 0 && (
        <TripPhotos queries={itinerary.tripPhotos} />
      )}
    </motion.div>
  );
}
 
// ── Lista Bagaglio (ora nella toolbar mappa) ──────────────────────────────
export function PackingList({ list }: { list: PackingCategory[] }) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const toggle = (catIndex: number, itemIndex: number) => {
    const key = `${catIndex}-${itemIndex}`;
    setChecked((prev) => ({ ...prev, [key]: !prev[key] }));
  };
 
  if (!list || list.length === 0) return (
    <div className="flex flex-col items-center justify-center h-full gap-3 py-12"
      style={{ color: "rgba(255,255,255,0.35)" }}>
      <CheckSquare style={{ width: "32px", height: "32px", opacity: 0.3 }} />
      <p className="text-sm">La lista bagaglio apparirà qui</p>
    </div>
  );
 
  return (
    <div className="p-4 overflow-y-auto h-full">
      <div className="flex items-center gap-2 mb-5">
        <CheckSquare style={{ width: "18px", height: "18px", color: "#a78bfa" }} />
        <h3 className="font-bold text-white" style={{ fontSize: "15px" }}>Lista Bagaglio</h3>
      </div>
      <div className="space-y-6">
        {list.map((category: any, catIndex: number) => (
          <div key={category.category}>
            <h4 className="text-[10px] font-bold uppercase tracking-wider mb-3"
              style={{ color: "#a78bfa" }}>
              {category.category}
            </h4>
            <ul className="space-y-2">
              {category.items.map((item: string, itemIndex: number) => {
                const key = `${catIndex}-${itemIndex}`;
                const isChecked = checked[key];
                return (
                  <li key={itemIndex}
                    className="flex items-start gap-3 text-sm cursor-pointer"
                    style={{ color: isChecked ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.75)" }}
                    onClick={() => toggle(catIndex, itemIndex)}>
                    <button className="mt-0.5 shrink-0 transition-colors">
                      {isChecked
                        ? <CheckSquare style={{ width: "15px", height: "15px", color: "#a78bfa" }} />
                        : <Square style={{ width: "15px", height: "15px", color: "rgba(255,255,255,0.3)" }} />}
                    </button>
                    <span className={cn("leading-snug", isChecked && "line-through")}>{item}</span>
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
 