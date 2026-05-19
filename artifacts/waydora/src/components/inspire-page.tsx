// src/components/inspire-page.tsx
import { useState } from "react";
import { motion } from "framer-motion";
import { Heart, MapPin, Clock, Users, Sparkles, BookMarked } from "lucide-react";
import { fetchPhoto } from "@/lib/photos";
import { useEffect } from "react";

const FALLBACK = "https://images.pexels.com/photos/346885/pexels-photo-346885.jpeg";

// ── Viaggi predefiniti ────────────────────────────────────────────────────
const FEATURED_TRIPS = [
  {
    id: "tokyo-7",
    title: "Tokyo in 7 giorni",
    destination: "Tokyo, Giappone",
    days: 7,
    vibe: "Tecnologia, templi e ramen",
    emoji: "🗼",
    budget: "€1.800",
    tags: ["Cultura", "Cibo", "Tecnologia"],
    photoQuery: "tokyo japan shibuya night",
    prompt: "Crea un itinerario completo di 7 giorni a Tokyo, Giappone. Includi quartieri come Shibuya, Shinjuku, Asakusa, Harajuku. Mix di cultura tradizionale e moderna, i migliori ristoranti di ramen e sushi, e le esperienze più iconiche.",
  },
  {
    id: "bali-10",
    title: "Bali: mare e spiritualità",
    destination: "Bali, Indonesia",
    days: 10,
    vibe: "Relax, templi e surf",
    emoji: "🌺",
    budget: "€1.200",
    tags: ["Beach", "Natura", "Wellness"],
    photoQuery: "bali indonesia rice terraces temple",
    prompt: "Crea un itinerario di 10 giorni a Bali, Indonesia. Includi Ubud per i templi e le risaie, Seminyak per la spiaggia e i sunset, Uluwatu per il surf e i templi scogliera. Mix perfetto tra relax e avventura.",
  },
  {
    id: "marrakech-4",
    title: "Marrakech Express",
    destination: "Marrakech, Marocco",
    days: 4,
    vibe: "Spezie, souq e riads",
    emoji: "🕌",
    budget: "€600",
    tags: ["Cultura", "Cibo", "Shopping"],
    photoQuery: "marrakech morocco medina souq colorful",
    prompt: "Crea un itinerario di 4 giorni a Marrakech, Marocco. Includi la Medina, Djemaa el-Fna, i souq, il Palazzo Bahia, i giardini Majorelle e le migliori esperienze culinarie marocchine.",
  },
  {
    id: "lisbon-5",
    title: "Lisbona & Sintra",
    destination: "Lisbona, Portogallo",
    days: 5,
    vibe: "Fado, pastéis e tram",
    emoji: "🚋",
    budget: "€800",
    tags: ["Cultura", "Cibo", "Storia"],
    photoQuery: "lisbon portugal tram alfama sunset",
    prompt: "Crea un itinerario di 5 giorni a Lisbona e dintorni. Includi Alfama, Belém, Bairro Alto, una giornata a Sintra e una gita a Cascais. I migliori miradouros, pastéis de nata e cene tipiche.",
  },
  {
    id: "new-york-6",
    title: "New York City",
    destination: "New York, USA",
    days: 6,
    vibe: "Skyline, pizza e musei",
    emoji: "🗽",
    budget: "€2.200",
    tags: ["City Break", "Cultura", "Shopping"],
    photoQuery: "new york city manhattan skyline central park",
    prompt: "Crea un itinerario di 6 giorni a New York. Includi Manhattan, Brooklyn, Central Park, i musei principali (MoMA, Met), i migliori quartieri per mangiare (West Village, Chinatown, Williamsburg) e le viste più iconiche sulla skyline.",
  },
  {
    id: "santorini-4",
    title: "Santorini romantica",
    destination: "Santorini, Grecia",
    days: 4,
    vibe: "Tramonti, vino e caldera",
    emoji: "🌅",
    budget: "€1.400",
    tags: ["Romantico", "Beach", "Cibo"],
    photoQuery: "santorini greece oia white blue sunset caldera",
    prompt: "Crea un itinerario di 4 giorni a Santorini, Grecia. Includi Oia per i tramonti, Fira per i cocktail sulla caldera, Akrotiri per la storia, le migliori spiagge (Perissa, Red Beach) e i ristoranti con vista.",
  },
  {
    id: "prague-3",
    title: "Praga magica",
    destination: "Praga, Repubblica Ceca",
    days: 3,
    vibe: "Birra, castelli e magia",
    emoji: "🏰",
    budget: "€500",
    tags: ["Cultura", "Storia", "Nightlife"],
    photoQuery: "prague czech republic castle charles bridge night",
    prompt: "Crea un itinerario di 3 giorni a Praga. Includi il Castello di Praga, il Ponte Carlo, la Città Vecchia con l'Orologio Astronomico, Malá Strana, i migliori pub e ristoranti cechi.",
  },
  {
    id: "dubai-5",
    title: "Dubai: lusso e deserto",
    destination: "Dubai, UAE",
    days: 5,
    vibe: "Grattacieli, souk e dune",
    emoji: "🏙️",
    budget: "€2.000",
    tags: ["Lusso", "Avventura", "Shopping"],
    photoQuery: "dubai skyline burj khalifa desert luxury",
    prompt: "Crea un itinerario di 5 giorni a Dubai. Includi il Burj Khalifa, i souk dell'oro e delle spezie, un safari nel deserto, Dubai Mall, Marina e i migliori ristoranti della città.",
  },
];

// ── TripCard ──────────────────────────────────────────────────────────────
function TripCard({ trip, onSelect }: { trip: typeof FEATURED_TRIPS[0]; onSelect: (prompt: string) => void }) {
  const [photo, setPhoto] = useState(FALLBACK);
  const [liked, setLiked] = useState(false);

  useEffect(() => {
    // Pexels con fallback
    import("@/lib/photos").then(({ fetchPhoto }) => {
      fetchPhoto(trip.photoQuery).then(setPhoto).catch(() => setPhoto(FALLBACK));
    });
  }, [trip.photoQuery]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.3 }}
      style={{
        background: "rgba(255,255,255,0.05)",
        border: "1px solid rgba(255,255,255,0.09)",
        borderRadius: "18px",
        overflow: "hidden",
        cursor: "pointer",
      }}
    >
      {/* Foto */}
      <div style={{ position: "relative", height: "180px", overflow: "hidden" }}>
        <img src={photo} alt={trip.title}
          style={{ width: "100%", height: "100%", objectFit: "cover", transition: "transform 0.4s ease" }}
          onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.05)")}
          onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 60%)" }} />

        {/* Emoji + like */}
        <div style={{ position: "absolute", top: "12px", left: "12px", fontSize: "2rem" }}>{trip.emoji}</div>
        <button
          onClick={(e) => { e.stopPropagation(); setLiked(!liked); }}
          style={{ position: "absolute", top: "12px", right: "12px", background: "rgba(0,0,0,0.4)", border: "none", borderRadius: "50%", width: "32px", height: "32px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <Heart style={{ width: "15px", height: "15px", color: liked ? "#f43f5e" : "#fff", fill: liked ? "#f43f5e" : "none" }} />
        </button>

        {/* Info in basso sulla foto */}
        <div style={{ position: "absolute", bottom: "12px", left: "12px", right: "12px" }}>
          <h3 style={{ fontSize: "16px", fontWeight: 800, color: "#fff", marginBottom: "4px" }}>{trip.title}</h3>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <MapPin style={{ width: "11px", height: "11px", color: "rgba(255,255,255,0.7)" }} />
            <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.7)" }}>{trip.destination}</span>
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: "14px 16px" }}>
        <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.55)", marginBottom: "12px", fontStyle: "italic" }}>
          "{trip.vibe}"
        </p>

        {/* Meta info */}
        <div style={{ display: "flex", gap: "12px", marginBottom: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <Clock style={{ width: "12px", height: "12px", color: "rgba(255,255,255,0.4)" }} />
            <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)" }}>{trip.days} giorni</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)" }}>da {trip.budget}</span>
          </div>
        </div>

        {/* Tags */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "14px" }}>
          {trip.tags.map((tag) => (
            <span key={tag} style={{ fontSize: "11px", fontWeight: 600, padding: "3px 10px", borderRadius: "9999px", background: "rgba(249,115,22,0.12)", color: "rgba(249,115,22,0.9)", border: "1px solid rgba(249,115,22,0.2)" }}>
              {tag}
            </span>
          ))}
        </div>

        {/* CTA */}
        <button
          onClick={() => onSelect(trip.prompt)}
          style={{ width: "100%", padding: "10px", borderRadius: "12px", background: "linear-gradient(135deg,#f97316,#a855f7)", border: "none", color: "#fff", fontSize: "13px", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", transition: "opacity 0.15s" }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.9"; }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}>
          <Sparkles style={{ width: "14px", height: "14px" }} />
          Pianifica con Waydora
        </button>
      </div>
    </motion.div>
  );
}

// ── InspirePage ───────────────────────────────────────────────────────────
interface InspirePageProps {
  onSelectTrip: (prompt: string) => void;
}

export function InspirePage({ onSelectTrip }: InspirePageProps) {
  const [filter, setFilter] = useState<string>("Tutti");
  const filters = ["Tutti", "Cultura", "Beach", "City Break", "Romantico", "Avventura", "Lusso"];

  const filtered = filter === "Tutti"
    ? FEATURED_TRIPS
    : FEATURED_TRIPS.filter(t => t.tags.includes(filter));

  return (
    <div style={{ height: "100%", overflowY: "auto", background: "#0a0a12" }}>
      {/* Blob sfondo */}
      <div style={{ position: "fixed", top: "-10%", right: "-5%", width: "50vw", height: "50vw", borderRadius: "50%", background: "radial-gradient(circle,rgba(249,115,22,0.12) 0%,transparent 65%)", filter: "blur(70px)", pointerEvents: "none", zIndex: 0 }} />
      <div style={{ position: "fixed", bottom: "5%", left: "-5%", width: "45vw", height: "45vw", borderRadius: "50%", background: "radial-gradient(circle,rgba(168,85,247,0.12) 0%,transparent 65%)", filter: "blur(70px)", pointerEvents: "none", zIndex: 0 }} />

      <div style={{ position: "relative", zIndex: 1, padding: "32px 28px", maxWidth: "1000px", margin: "0 auto" }}>

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: "32px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
            <div style={{ fontSize: "2rem" }}>🌍</div>
            <h1 style={{ fontSize: "clamp(1.5rem, 3vw, 2.2rem)", fontWeight: 900, color: "#fff", letterSpacing: "-0.02em" }}>
              Lasciati ispirare
            </h1>
          </div>
          <p style={{ fontSize: "15px", color: "rgba(255,255,255,0.5)", maxWidth: "500px" }}>
            Viaggi curati dal team Waydora e dalla community. Scegli un'ispirazione e personalizzala con l'AI.
          </p>
        </motion.div>

        {/* Filtri */}
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "28px" }}>
          {filters.map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              style={{
                padding: "6px 14px", borderRadius: "9999px", fontSize: "12px", fontWeight: 600, cursor: "pointer", transition: "all 0.15s",
                background: filter === f ? "linear-gradient(135deg,#f97316,#a855f7)" : "rgba(255,255,255,0.07)",
                color: filter === f ? "#fff" : "rgba(255,255,255,0.55)",
                border: filter === f ? "none" : "1px solid rgba(255,255,255,0.1)",
              }}>
              {f}
            </button>
          ))}
        </div>

        {/* Grid viaggi */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "20px", marginBottom: "48px" }}>
          {filtered.map((trip) => (
            <TripCard key={trip.id} trip={trip} onSelect={onSelectTrip} />
          ))}
        </div>

        {/* Sezione community */}
        <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "20px", padding: "28px", textAlign: "center" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: "12px" }}>👥</div>
          <h2 style={{ fontSize: "20px", fontWeight: 800, color: "#fff", marginBottom: "8px" }}>Viaggi della Community</h2>
          <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.45)", marginBottom: "20px", maxWidth: "400px", margin: "0 auto 20px" }}>
            Presto potrai vedere e condividere i viaggi creati dagli altri utenti Waydora.
          </p>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
            <Users style={{ width: "16px", height: "16px", color: "#a78bfa" }} />
            <span style={{ fontSize: "13px", fontWeight: 600, color: "#a78bfa" }}>Community in arrivo</span>
          </div>
        </motion.div>
      </div>
    </div>
  );
}