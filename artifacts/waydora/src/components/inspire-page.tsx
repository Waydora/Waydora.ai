// src/components/inspire-page.tsx
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Heart, MapPin, Clock, Users, Sparkles } from "lucide-react";
import { fetchPhoto } from "@/lib/photos";
import type { UserTripRow } from "@/hooks/trips";

const FALLBACK = "https://images.pexels.com/photos/346885/pexels-photo-346885.jpeg";

// ── Viaggi predefiniti curati dal team ────────────────────────────────────
const FEATURED_TRIPS = [
  { id: "tokyo-7",      title: "Tokyo in 7 giorni",      destination: "Tokyo, Giappone",          days: 7,  vibe: "Tecnologia, templi e ramen",    emoji: "🗼", budget: "€1.800", tags: ["Cultura","Cibo","Tecnologia"],  photoQuery: "tokyo japan shibuya night",             prompt: "Crea un itinerario completo di 7 giorni a Tokyo, Giappone. Includi Shibuya, Shinjuku, Asakusa, Harajuku. Mix di cultura tradizionale e moderna, ramen e sushi, esperienze iconiche." },
  { id: "bali-10",      title: "Bali: mare e spiritualità", destination: "Bali, Indonesia",        days: 10, vibe: "Relax, templi e surf",           emoji: "🌺", budget: "€1.200", tags: ["Beach","Natura","Wellness"],    photoQuery: "bali indonesia rice terraces temple",   prompt: "Crea un itinerario di 10 giorni a Bali. Includi Ubud, Seminyak, Uluwatu. Mix relax e avventura." },
  { id: "marrakech-4",  title: "Marrakech Express",       destination: "Marrakech, Marocco",       days: 4,  vibe: "Spezie, souq e riads",           emoji: "🕌", budget: "€600",   tags: ["Cultura","Cibo","Shopping"],   photoQuery: "marrakech morocco medina souq colorful", prompt: "Crea un itinerario di 4 giorni a Marrakech. Medina, Djemaa el-Fna, souq, Palazzo Bahia, giardini Majorelle." },
  { id: "lisbon-5",     title: "Lisbona & Sintra",        destination: "Lisbona, Portogallo",      days: 5,  vibe: "Fado, pastéis e tram",           emoji: "🚋", budget: "€800",   tags: ["Cultura","Cibo","Storia"],     photoQuery: "lisbon portugal tram alfama sunset",    prompt: "Crea un itinerario di 5 giorni a Lisbona. Alfama, Belém, Sintra, Cascais. Pastéis de nata e fado." },
  { id: "new-york-6",   title: "New York City",            destination: "New York, USA",            days: 6,  vibe: "Skyline, pizza e musei",         emoji: "🗽", budget: "€2.200", tags: ["City Break","Cultura","Shopping"], photoQuery: "new york city manhattan skyline central park", prompt: "Crea un itinerario di 6 giorni a New York. Manhattan, Brooklyn, Central Park, musei, quartieri per mangiare." },
  { id: "santorini-4",  title: "Santorini romantica",     destination: "Santorini, Grecia",        days: 4,  vibe: "Tramonti, vino e caldera",       emoji: "🌅", budget: "€1.400", tags: ["Romantico","Beach","Cibo"],     photoQuery: "santorini greece oia white blue sunset caldera", prompt: "Crea un itinerario di 4 giorni a Santorini. Oia, Fira, Akrotiri, spiagge e ristoranti con vista." },
  { id: "prague-3",     title: "Praga magica",             destination: "Praga, Repubblica Ceca",  days: 3,  vibe: "Birra, castelli e magia",        emoji: "🏰", budget: "€500",   tags: ["Cultura","Storia","Nightlife"], photoQuery: "prague czech republic castle charles bridge night", prompt: "Crea un itinerario di 3 giorni a Praga. Castello, Ponte Carlo, Città Vecchia, Orologio Astronomico." },
  { id: "dubai-5",      title: "Dubai: lusso e deserto",  destination: "Dubai, UAE",               days: 5,  vibe: "Grattacieli, souk e dune",       emoji: "🏙️", budget: "€2.000", tags: ["Lusso","Avventura","Shopping"], photoQuery: "dubai skyline burj khalifa desert luxury", prompt: "Crea un itinerario di 5 giorni a Dubai. Burj Khalifa, souk, safari nel deserto, Marina." },
];

const ALL_FILTERS = ["Tutti", "Cultura", "Beach", "City Break", "Romantico", "Avventura", "Lusso", "Natura", "Cibo"];

// ── TripCard ──────────────────────────────────────────────────────────────
function TripCard({ trip, liked, onLike, onSelect }: {
  trip: typeof FEATURED_TRIPS[0] | (UserTripRow & { photoQuery?: string; prompt?: string; tags?: string[] });
  liked: boolean;
  onLike: () => void;
  onSelect: (prompt: string) => void;
}) {
  const [photo, setPhoto] = useState(FALLBACK);
  const photoQuery = (trip as any).photoQuery ?? `${(trip as any).destination} travel landmark`;
  const prompt = (trip as any).prompt ?? `Crea un itinerario per ${(trip as any).destination}`;
  const tags = (trip as any).tags ?? [];
  const days = (trip as any).days ?? (trip as any).durationDays ?? (trip as any).days?.length;
  const budget = (trip as any).budget ?? (trip as any).budget;

  useEffect(() => {
    fetchPhoto(photoQuery).then(setPhoto).catch(() => setPhoto(FALLBACK));
  }, [photoQuery]);

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
      whileHover={{ y: -3 }} transition={{ duration: 0.25 }}
      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: "18px", overflow: "hidden" }}>

      {/* Foto */}
      <div style={{ position: "relative", height: "170px", overflow: "hidden" }}>
        <img src={photo} alt={trip.title} style={{ width: "100%", height: "100%", objectFit: "cover", transition: "transform 0.4s ease" }}
          onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.05)")}
          onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top,rgba(0,0,0,0.7) 0%,transparent 55%)" }} />

        <div style={{ position: "absolute", top: "10px", left: "10px", fontSize: "1.8rem" }}>{(trip as any).emoji ?? (trip as any).hero_emoji ?? "🗺️"}</div>

        {/* Like button */}
        <button onClick={(e) => { e.stopPropagation(); onLike(); }}
          style={{ position: "absolute", top: "10px", right: "10px", background: "rgba(0,0,0,0.45)", border: "none", borderRadius: "50%", width: "30px", height: "30px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "transform 0.15s" }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.15)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}>
          <Heart style={{ width: "14px", height: "14px", color: liked ? "#f43f5e" : "#fff", fill: liked ? "#f43f5e" : "none", transition: "all 0.2s" }} />
        </button>

        {/* Info in basso */}
        <div style={{ position: "absolute", bottom: "10px", left: "10px", right: "10px" }}>
          <h3 style={{ fontSize: "15px", fontWeight: 800, color: "#fff", marginBottom: "3px" }}>{trip.title}</h3>
          <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <MapPin style={{ width: "10px", height: "10px", color: "rgba(255,255,255,0.65)" }} />
            <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.65)" }}>{(trip as any).destination}</span>
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: "12px 14px" }}>
        <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)", marginBottom: "10px", fontStyle: "italic" }}>
          "{(trip as any).vibe ?? (trip as any).description ?? ""}"
        </p>

        <div style={{ display: "flex", gap: "10px", marginBottom: "10px" }}>
          {days && <div style={{ display: "flex", alignItems: "center", gap: "4px" }}><Clock style={{ width: "11px", height: "11px", color: "rgba(255,255,255,0.4)" }} /><span style={{ fontSize: "11px", color: "rgba(255,255,255,0.45)" }}>{days} giorni</span></div>}
          {budget && <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.45)" }}>da {budget}</span>}
        </div>

        {tags.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", marginBottom: "12px" }}>
            {tags.map((tag: string) => (
              <span key={tag} style={{ fontSize: "10px", fontWeight: 600, padding: "2px 8px", borderRadius: "9999px", background: "rgba(249,115,22,0.12)", color: "rgba(249,115,22,0.9)", border: "1px solid rgba(249,115,22,0.2)" }}>{tag}</span>
            ))}
          </div>
        )}

        <button onClick={() => onSelect(prompt)}
          style={{ width: "100%", padding: "9px", borderRadius: "11px", background: "linear-gradient(135deg,#f97316,#a855f7)", border: "none", color: "#fff", fontSize: "12px", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "5px" }}>
          <Sparkles style={{ width: "13px", height: "13px" }} />Pianifica con Waydora
        </button>
      </div>
    </motion.div>
  );
}

// ── InspirePage ───────────────────────────────────────────────────────────
interface InspirePageProps {
  onSelectTrip: (prompt: string) => void;
  likedIds: string[];
  onLike: (tripId: string, title: string) => void;
  publishedUserTrips?: UserTripRow[];
}

export function InspirePage({ onSelectTrip, likedIds, onLike, publishedUserTrips = [] }: InspirePageProps) {
  const [filter, setFilter] = useState("Tutti");

  const filtered = filter === "Tutti"
    ? FEATURED_TRIPS
    : FEATURED_TRIPS.filter(t => t.tags.includes(filter));

  return (
    <div style={{ height: "100%", overflowY: "auto", background: "#0a0a12" }}>
      <div style={{ position: "fixed", top: "-10%", right: "-5%", width: "50vw", height: "50vw", borderRadius: "50%", background: "radial-gradient(circle,rgba(249,115,22,0.1) 0%,transparent 65%)", filter: "blur(70px)", pointerEvents: "none", zIndex: 0 }} />
      <div style={{ position: "relative", zIndex: 1, padding: "28px", maxWidth: "1000px", margin: "0 auto" }}>

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
            <span style={{ fontSize: "1.8rem" }}>🌍</span>
            <h1 style={{ fontSize: "clamp(1.3rem,3vw,2rem)", fontWeight: 900, color: "#fff", letterSpacing: "-0.02em" }}>Lasciati ispirare</h1>
          </div>
          <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.45)", maxWidth: "480px" }}>
            Viaggi curati dal team Waydora. Metti il cuore per salvarli, poi pianificali con l'AI.
          </p>
        </motion.div>

        {/* Filtri */}
        <div style={{ display: "flex", gap: "7px", flexWrap: "wrap", marginBottom: "24px" }}>
          {ALL_FILTERS.map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              style={{ padding: "5px 13px", borderRadius: "9999px", fontSize: "12px", fontWeight: 600, cursor: "pointer", transition: "all 0.15s", background: filter === f ? "linear-gradient(135deg,#f97316,#a855f7)" : "rgba(255,255,255,0.07)", color: filter === f ? "#fff" : "rgba(255,255,255,0.5)", border: filter === f ? "none" : "1px solid rgba(255,255,255,0.1)" }}>
              {f}
            </button>
          ))}
        </div>

        {/* Grid curati */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(270px,1fr))", gap: "18px", marginBottom: "40px" }}>
          {filtered.map((trip) => (
            <TripCard key={trip.id} trip={trip}
              liked={likedIds.includes(trip.id)}
              onLike={() => onLike(trip.id, trip.title)}
              onSelect={onSelectTrip} />
          ))}
        </div>

        {/* Viaggi pubblicati dalla community */}
        {publishedUserTrips.length > 0 && (
          <div style={{ marginBottom: "40px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
              <Users style={{ width: "16px", height: "16px", color: "#a78bfa" }} />
              <h2 style={{ fontSize: "16px", fontWeight: 800, color: "#fff" }}>Dalla community</h2>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(270px,1fr))", gap: "18px" }}>
              {publishedUserTrips.map((trip) => (
                <TripCard key={trip.id} trip={trip}
                  liked={likedIds.includes(trip.id)}
                  onLike={() => onLike(trip.id, trip.title)}
                  onSelect={(p) => onSelectTrip(p)} />
              ))}
            </div>
          </div>
        )}

        {/* Community placeholder */}
        <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "18px", padding: "24px", textAlign: "center" }}>
          <div style={{ fontSize: "2rem", marginBottom: "10px" }}>👥</div>
          <h2 style={{ fontSize: "17px", fontWeight: 800, color: "#fff", marginBottom: "6px" }}>Vuoi condividere un viaggio?</h2>
          <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.4)", marginBottom: "0", maxWidth: "360px", margin: "0 auto" }}>
            Vai su "Crea un viaggio" nella sidebar, crea il tuo itinerario e pubblicalo — apparirà qui per tutta la community.
          </p>
        </motion.div>
      </div>
    </div>
  );
}