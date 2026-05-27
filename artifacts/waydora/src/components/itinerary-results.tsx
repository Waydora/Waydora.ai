import { useState } from "react";
import { motion } from "framer-motion";
import {
  Bed, Utensils, Compass, Bus, MapPin, Moon,
  ExternalLink, Sparkles, CheckSquare, Square, ShoppingBag,
  type LucideIcon,
} from "lucide-react";
type ItineraryData = any;
type ItineraryActivity = any;
type PackingCategory = any;
import { fetchPhoto } from "@/lib/photos";
import { AFFILIATES, isGoCityDestination, isOutsideEU, goCityUrlFor, stay22UrlFor } from "@/lib/affiliates";

const FALLBACK = "https://images.pexels.com/photos/346885/pexels-photo-346885.jpeg";
const AMAZON_TAG = "waydora-21";

// ── Banner Go City (mostrato solo per destinazioni coperte) ───────────────
function GoCityBanner({ destination }: { destination: string }) {
  if (!isGoCityDestination(destination)) return null;
  return (
    <a href={goCityUrlFor(destination)} target="_blank" rel="noopener noreferrer sponsored"
       style={{ display: "block", textDecoration: "none", marginBottom: "16px" }}>
      <div style={{
        background: "linear-gradient(135deg,#0ea5e9 0%,#6366f1 100%)",
        borderRadius: "14px", padding: "14px 16px",
        display: "flex", alignItems: "center", gap: "12px",
        boxShadow: "0 4px 18px rgba(14,165,233,0.3)",
      }}>
        <span style={{ fontSize: "1.8rem", flexShrink: 0 }}>🎟️</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "13px", fontWeight: 800, color: "#fff", marginBottom: "2px" }}>
            Risparmia con Go City Pass
          </div>
          <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.85)" }}>
            Un solo pass per le attrazioni top di {destination.split(",")[0]} — fino a -50% sui biglietti
          </div>
        </div>
        <span style={{ fontSize: "10px", fontWeight: 700, color: "#fff",
          background: "rgba(255,255,255,0.18)", padding: "5px 10px", borderRadius: "9999px", flexShrink: 0 }}>
          Scopri →
        </span>
      </div>
    </a>
  );
}

// ── Banner Stay22 (cerca alloggio per la città dell'itinerario) ───────────
function Stay22Banner({ destination }: { destination: string }) {
  if (!destination) return null;
  return (
    <a href={stay22UrlFor(destination)} target="_blank" rel="noopener noreferrer sponsored"
       style={{ display: "block", textDecoration: "none", marginBottom: "16px" }}>
      <div style={{
        background: "linear-gradient(135deg,#f97316 0%,#ef4444 100%)",
        borderRadius: "14px", padding: "14px 16px",
        display: "flex", alignItems: "center", gap: "12px",
        boxShadow: "0 4px 18px rgba(249,115,22,0.28)",
      }}>
        <span style={{ fontSize: "1.8rem", flexShrink: 0 }}>🏨</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "13px", fontWeight: 800, color: "#fff", marginBottom: "2px" }}>
            Trova alloggio a {destination.split(",")[0]}
          </div>
          <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.9)" }}>
            Confronta hotel, B&B e appartamenti su una sola mappa — powered by Stay22
          </div>
        </div>
        <span style={{ fontSize: "10px", fontWeight: 700, color: "#fff",
          background: "rgba(255,255,255,0.18)", padding: "5px 10px", borderRadius: "9999px", flexShrink: 0 }}>
          Cerca →
        </span>
      </div>
    </a>
  );
}

// ── Banner Yesim eSIM (per destinazioni extra-UE) ─────────────────────────
function YesimBanner({ destination }: { destination: string }) {
  if (!isOutsideEU(destination)) return null;
  return (
    <a href={AFFILIATES.YESIM_URL} target="_blank" rel="noopener noreferrer sponsored"
       style={{ display: "block", textDecoration: "none", marginBottom: "16px" }}>
      <div style={{
        background: "linear-gradient(135deg,#10b981 0%,#06b6d4 100%)",
        borderRadius: "14px", padding: "14px 16px",
        display: "flex", alignItems: "center", gap: "12px",
        boxShadow: "0 4px 18px rgba(16,185,129,0.25)",
      }}>
        <span style={{ fontSize: "1.8rem", flexShrink: 0 }}>📶</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "13px", fontWeight: 800, color: "#fff", marginBottom: "2px" }}>
            Resta connesso in {destination.split(",")[0]}
          </div>
          <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.9)" }}>
            eSIM Yesim — dati internet senza roaming, attivazione istantanea
          </div>
        </div>
        <span style={{ fontSize: "10px", fontWeight: 700, color: "#fff",
          background: "rgba(255,255,255,0.18)", padding: "5px 10px", borderRadius: "9999px", flexShrink: 0 }}>
          Attiva →
        </span>
      </div>
    </a>
  );
}

function amazonLink(query: string): string {
  const encoded = encodeURIComponent(query.toLowerCase().replace(/\s+/g, "+"));
  return `https://www.amazon.it/s?k=${encoded}&tag=${AMAZON_TAG}`;
}

function getAmazonQuery(item: string, _category: string): string {
  const q = item.toLowerCase();
  if (q.includes("passaporto") || q.includes("documenti")) return "portadocumenti viaggio";
  if (q.includes("zaino")) return "zaino viaggio cabina leggero";
  if (q.includes("valigia") || q.includes("trolley")) return "valigia trolley viaggio leggera";
  if (q.includes("crema solare") || q.includes("protezione solare")) return "crema solare viso spf50 viaggio";
  if (q.includes("adattatore") || q.includes("presa")) return "adattatore presa universale viaggio";
  if (q.includes("cuffie") || q.includes("auricolar")) return "cuffie bluetooth viaggio noise cancelling";
  if (q.includes("power bank") || q.includes("caricabatterie")) return "power bank viaggio compatto";
  if (q.includes("lucchetto")) return "lucchetto valigia tsa";
  if (q.includes("sacchetto") || q.includes("organizer")) return "organizer viaggio valigia set";
  if (q.includes("bottiglia") || q.includes("borraccia")) return "borraccia viaggio leggera";
  if (q.includes("ombrello")) return "ombrello viaggio compatto tascabile";
  if (q.includes("occhiali da sole")) return "occhiali da sole viaggio polarizzati";
  if (q.includes("cappello") || q.includes("berretto")) return "cappello viaggio estivo protezione uv";
  if (q.includes("scarpe") || q.includes("sneaker")) return "scarpe viaggio comode leggere";
  if (q.includes("impermeabile") || q.includes("giubbotto")) return "giacca impermeabile viaggio leggera";
  if (q.includes("medicinali") || q.includes("farmaci") || q.includes("kit")) return "kit pronto soccorso viaggio";
  if (q.includes("asciugamano")) return "asciugamano microfibra viaggio compatto";
  return `${item} viaggio`;
}

const AMAZON_CATEGORIES = [
  "Abbigliamento", "Accessori", "Tecnologia", "Salute e Igiene",
  "Essenziali", "Documenti", "Sport e Outdoor",
];

// ── Palette categoria ─────────────────────────────────────────────────────
const CATEGORY_STYLE: Record<string, {
  icon: LucideIcon; label: string; gradient: string;
  iconBg: string; iconColor: string; badgeBg: string; badgeColor: string; line: string;
}> = {
  stay:       { icon: Bed,       label: "Soggiorno",   gradient: "linear-gradient(135deg,#6366f1,#8b5cf6)", iconBg: "rgba(99,102,241,0.2)",  iconColor: "#818cf8", badgeBg: "rgba(99,102,241,0.18)",  badgeColor: "#a5b4fc", line: "rgba(99,102,241,0.3)"  },
  food:       { icon: Utensils,  label: "Cibo",         gradient: "linear-gradient(135deg,#f43f5e,#fb923c)", iconBg: "rgba(244,63,94,0.2)",   iconColor: "#fb7185", badgeBg: "rgba(244,63,94,0.18)",   badgeColor: "#fda4af", line: "rgba(244,63,94,0.3)"   },
  experience: { icon: Compass,   label: "Esperienza",   gradient: "linear-gradient(135deg,#0ea5e9,#06b6d4)", iconBg: "rgba(14,165,233,0.2)",  iconColor: "#38bdf8", badgeBg: "rgba(14,165,233,0.18)",  badgeColor: "#7dd3fc", line: "rgba(14,165,233,0.3)"  },
  transport:  { icon: Bus,       label: "Trasporto",    gradient: "linear-gradient(135deg,#64748b,#94a3b8)", iconBg: "rgba(100,116,139,0.2)", iconColor: "#94a3b8", badgeBg: "rgba(100,116,139,0.18)", badgeColor: "#cbd5e1", line: "rgba(100,116,139,0.3)" },
  sightseeing:{ icon: MapPin,    label: "Visita",       gradient: "linear-gradient(135deg,#f59e0b,#eab308)", iconBg: "rgba(245,158,11,0.2)",  iconColor: "#fbbf24", badgeBg: "rgba(245,158,11,0.18)",  badgeColor: "#fcd34d", line: "rgba(245,158,11,0.3)"  },
  nightlife:  { icon: Moon,      label: "Vita notturna",gradient: "linear-gradient(135deg,#ec4899,#a855f7)", iconBg: "rgba(236,72,153,0.2)",  iconColor: "#f472b6", badgeBg: "rgba(236,72,153,0.18)",  badgeColor: "#f9a8d4", line: "rgba(236,72,153,0.3)"  },
  shopping:   { icon: ShoppingBag,label: "Shopping",     gradient: "linear-gradient(135deg,#10b981,#06b6d4)", iconBg: "rgba(16,185,129,0.2)",  iconColor: "#34d399", badgeBg: "rgba(16,185,129,0.18)",  badgeColor: "#6ee7b7", line: "rgba(16,185,129,0.3)"  },
  culture:    { icon: MapPin,    label: "Cultura",      gradient: "linear-gradient(135deg,#f59e0b,#eab308)", iconBg: "rgba(245,158,11,0.2)",  iconColor: "#fbbf24", badgeBg: "rgba(245,158,11,0.18)",  badgeColor: "#fcd34d", line: "rgba(245,158,11,0.3)"  },
  nature:     { icon: Compass,   label: "Natura",       gradient: "linear-gradient(135deg,#22c55e,#10b981)", iconBg: "rgba(34,197,94,0.2)",   iconColor: "#4ade80", badgeBg: "rgba(34,197,94,0.18)",   badgeColor: "#86efac", line: "rgba(34,197,94,0.3)"   },
};
const DEFAULT_STYLE = { icon: Sparkles, label: "Attività", gradient: "linear-gradient(135deg,#a78bfa,#c084fc)", iconBg: "rgba(167,139,250,0.2)", iconColor: "#c084fc", badgeBg: "rgba(167,139,250,0.18)", badgeColor: "#ddd6fe", line: "rgba(167,139,250,0.3)" };

// ── ActivityCard ──────────────────────────────────────────────────────────
function ActivityCard({ activity, index }: { activity: ItineraryActivity; index: number }) {
  const style = CATEGORY_STYLE[activity.category] ?? DEFAULT_STYLE;
  const Icon = style.icon;
  return (
    <motion.div initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(index * 0.06, 0.35) }}
      className="relative pl-11 pb-5 last:pb-0 group">
      <div className="absolute left-[20px] top-10 bottom-0 w-px group-last:hidden" style={{ background: style.line }} />
      <div className="absolute left-1 top-1 w-8 h-8 rounded-full flex items-center justify-center z-10"
        style={{ background: style.iconBg, border: `1.5px solid ${style.iconColor}50` }}>
        <Icon style={{ width: "15px", height: "15px", color: style.iconColor }} />
      </div>
      <div style={{ background: "rgba(22,15,40,1)", border: "1px solid rgba(255,255,255,0.13)", borderRadius: "14px", padding: "14px 16px", boxShadow: "0 2px 12px rgba(0,0,0,0.4)" }}>
        <div className="flex flex-wrap items-center gap-2 mb-2.5">
          <span className="text-xs font-bold px-2.5 py-0.5 rounded-full" style={{ background: style.badgeBg, color: style.badgeColor }}>{activity.time}</span>
          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.35)" }}>{style.label}</span>
          {activity.estimatedCost && (
            <span className="text-xs font-semibold ml-auto px-2 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.6)" }}>{activity.estimatedCost}</span>
          )}
        </div>
        <h4 style={{ fontSize: "15px", fontWeight: 700, color: "#ffffff", marginBottom: "6px", lineHeight: 1.3 }}>{activity.title}</h4>
        <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.6)", lineHeight: 1.65, whiteSpace: "pre-line" }}>{activity.description}</p>
        {activity.affiliate && (
          <div className="mt-3 flex items-center gap-2">
            <a href={activity.affiliate.url} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full text-white transition-all duration-200 hover:scale-105"
              style={{ background: style.gradient, boxShadow: `0 2px 10px ${style.iconColor}40`, textDecoration: "none" }}>
              {activity.affiliate.label}<ExternalLink style={{ width: "11px", height: "11px" }} />
            </a>
            <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.28)", textTransform: "uppercase", letterSpacing: "0.05em" }}>via {activity.affiliate.provider}</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ── DayHeader ─────────────────────────────────────────────────────────────
function DayHeader({ dayIndex, title, weather, summary }: { dayIndex: number; title: string; weather?: string; summary: string }) {
  return (
    <div style={{ marginBottom: "16px", paddingTop: dayIndex > 0 ? "28px" : "0" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", marginBottom: "6px" }}>
        <div style={{ width: "30px", height: "30px", borderRadius: "50%", flexShrink: 0, background: "var(--wd-grad-warm)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: "13px", color: "#fff" }}>{dayIndex + 1}</div>
        <h3 style={{ fontSize: "16px", fontWeight: 800, color: "#ffffff", letterSpacing: "-0.01em" }}>{title}</h3>
        {weather && <span style={{ marginLeft: "auto", fontSize: "12px", fontWeight: 600, padding: "3px 10px", borderRadius: "9999px", background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.1)" }}>{weather}</span>}
      </div>
      <p style={{ fontSize: "13px", fontStyle: "italic", paddingLeft: "40px", color: "rgba(255,255,255,0.4)" }}>{summary}</p>
      <div style={{ height: "1px", background: "rgba(255,255,255,0.06)", marginTop: "12px", marginBottom: "16px" }} />
    </div>
  );
}

// ── TripPhotos ────────────────────────────────────────────────────────────
function TripPhoto({ query, isHero }: { query: string; isHero: boolean }) {
  const [src, setSrc] = useState<string>(FALLBACK);
  const [loaded, setLoaded] = useState(false);
  useState(() => {
    fetchPhoto(query).then((url) => { setSrc(url); setLoaded(true); }).catch(() => { setSrc(FALLBACK); setLoaded(true); });
  });
  return (
    <div style={{ position: "relative", borderRadius: "12px", overflow: "hidden", height: isHero ? "180px" : "120px", background: "rgba(255,255,255,0.05)" }}>
      <img src={src} alt={query} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", opacity: loaded ? 1 : 0, transition: "opacity 0.4s ease" }} />
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top,rgba(0,0,0,0.5) 0%,transparent 55%)" }} />
    </div>
  );
}

function TripPhotos({ queries, destination }: { queries?: string[]; destination: string }) {
  const photoQueries = (queries && queries.length > 0) ? queries.slice(0, 4) : [`${destination} landmark`, `${destination} street`, `${destination} food`];
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} style={{ marginTop: "24px" }}>
      <p style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: "10px" }}>📸 Il tuo viaggio</p>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <TripPhoto query={photoQueries[0]} isHero={true} />
        {photoQueries.length > 1 && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
            {photoQueries.slice(1).map((q, i) => <TripPhoto key={i} query={q} isHero={false} />)}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ── ItineraryResults ──────────────────────────────────────────────────────
export function ItineraryResults({ itinerary }: { itinerary: ItineraryData }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <div style={{ background: "linear-gradient(135deg,rgba(249,115,22,0.12) 0%,rgba(168,85,247,0.12) 100%)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: "16px", padding: "16px", marginBottom: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "10px" }}>
          {itinerary.heroEmoji && <span style={{ fontSize: "2rem" }}>{itinerary.heroEmoji}</span>}
          <div>
            <h2 style={{ fontSize: "clamp(1.1rem,2.5vw,1.4rem)", fontWeight: 900, color: "#fff", letterSpacing: "-0.02em", lineHeight: 1.2 }}>{itinerary.title}</h2>
            <p style={{ fontSize: "13px", fontStyle: "italic", color: "rgba(255,255,255,0.45)", marginTop: "2px" }}>"{itinerary.vibe}"</p>
          </div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
          {[`📍 ${itinerary.destination}`, `🗓 ${itinerary.durationDays} giorni`, `💰 ${itinerary.totalBudget}`, `🌤 ${itinerary.bestSeason}`]
            .filter(l => !l.includes("undefined"))
            .map((label) => (
              <span key={label} style={{ fontSize: "12px", fontWeight: 600, padding: "3px 10px", borderRadius: "9999px", background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.1)" }}>{label}</span>
            ))}
        </div>
      </div>
      <Stay22Banner destination={itinerary.destination ?? ""} />
      <GoCityBanner destination={itinerary.destination ?? ""} />
      <YesimBanner destination={itinerary.destination ?? ""} />
      {itinerary.days?.map((day: any, dayIndex: number) => (
        <div key={day.day}>
          <DayHeader dayIndex={dayIndex} title={day.title} weather={day.weather} summary={day.summary} />
          {day.activities?.map((activity: any, actIndex: number) => (
            <ActivityCard key={`${day.day}-${actIndex}`} activity={activity} index={actIndex} />
          ))}
        </div>
      ))}
      <TripPhotos queries={itinerary.tripPhotos} destination={itinerary.destination} />
    </motion.div>
  );
}

// ── PackingList (senza badge Amazon in alto a destra) ─────────────────────
export function PackingList({ list, destination }: { list: PackingCategory[]; destination?: string }) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  if (!list || list.length === 0) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: "12px", color: "rgba(255,255,255,0.3)", padding: "32px", textAlign: "center" }}>
      <CheckSquare style={{ width: "32px", height: "32px", opacity: 0.3 }} />
      <p style={{ fontSize: "13px" }}>La lista bagaglio apparirà qui dopo aver pianificato un viaggio</p>
    </div>
  );

  return (
    <div style={{ padding: "16px", overflowY: "auto", height: "100%" }}>
      {/* Header — solo titolo, niente badge Amazon */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "20px" }}>
        <CheckSquare style={{ width: "16px", height: "16px", color: "rgba(255,255,255,0.6)" }} />
        <h3 style={{ fontSize: "14px", fontWeight: 700, color: "#fff" }}>Lista Bagaglio</h3>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        {list.map((category: any, catIndex: number) => {
          const hasAmazonLink = AMAZON_CATEGORIES.some(c =>
            category.category.toLowerCase().includes(c.toLowerCase()) ||
            c.toLowerCase().includes(category.category.toLowerCase())
          );
          return (
            <div key={category.category}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                <h4 style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.2em", color: "rgba(255,255,255,0.5)" }}>{category.category}</h4>
                {hasAmazonLink && (
                  <a href={amazonLink(`${category.category} viaggio`)} target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: "10px", color: "#ff9900", textDecoration: "none", opacity: 0.6, transition: "opacity 0.15s" }}
                    onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                    onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.6")}>
                    Acquista tutto →
                  </a>
                )}
              </div>
              <ul style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {category.items.map((item: string, itemIndex: number) => {
                  const key = `${catIndex}-${itemIndex}`;
                  const isChecked = checked[key];
                  const link = amazonLink(getAmazonQuery(item, category.category));
                  return (
                    <li key={itemIndex} style={{ display: "flex", alignItems: "flex-start", gap: "8px", fontSize: "13px" }}>
                      <button onClick={() => setChecked(prev => ({ ...prev, [key]: !prev[key] }))}
                        style={{ marginTop: "1px", flexShrink: 0, background: "none", border: "none", padding: 0, cursor: "pointer" }}>
                        {isChecked
                          ? <CheckSquare style={{ width: "14px", height: "14px", color: "rgba(255,255,255,0.5)" }} />
                          : <Square style={{ width: "14px", height: "14px", color: "rgba(255,255,255,0.2)" }} />}
                      </button>
                      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px" }}>
                        <span style={{ color: isChecked ? "rgba(255,255,255,0.28)" : "rgba(255,255,255,0.75)", textDecoration: isChecked ? "line-through" : "none", lineHeight: 1.4 }}>{item}</span>
                        <a href={link} target="_blank" rel="noopener noreferrer" title={`Cerca "${item}" su Amazon`}
                          style={{ flexShrink: 0, opacity: 0.4, transition: "opacity 0.15s", color: "#ff9900", textDecoration: "none" }}
                          onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                          onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.4")}>
                          <ShoppingBag style={{ width: "13px", height: "13px" }} />
                        </a>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>

      {/* Footer Amazon */}
      <div style={{ marginTop: "20px", paddingTop: "16px", borderTop: "1px solid rgba(255,255,255,0.07)", textAlign: "center" }}>
        <a href={`https://www.amazon.it/s?k=accessori+viaggio${destination ? `+${encodeURIComponent(destination)}` : ""}&tag=${AMAZON_TAG}`}
          target="_blank" rel="noopener noreferrer"
          style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 700, padding: "8px 16px", borderRadius: "9999px", background: "rgba(255,153,0,0.12)", color: "#ff9900", border: "1px solid rgba(255,153,0,0.25)", textDecoration: "none", transition: "all 0.15s" }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,153,0,0.2)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,153,0,0.12)"; }}>
          <ShoppingBag style={{ width: "14px", height: "14px" }} />
          Tutto il necessario su Amazon
        </a>
        <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.2)", marginTop: "8px" }}>
          Link affiliato — acquistando supporti Waydora senza costi aggiuntivi
        </p>
      </div>
    </div>
  );
}