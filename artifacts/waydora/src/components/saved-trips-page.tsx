// src/components/saved-trips-page.tsx
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookMarked, Share2, Copy, Check, Trash2,
  MapPin, Clock, ExternalLink, Lock, Globe,
  Loader2, X,
} from "lucide-react";
import type { SavedTripRow } from "@/hooks/trips";
import type { ItineraryData } from "@/hooks/api";

// ── ShareModal ────────────────────────────────────────────────────────────
function ShareModal({ trip, onClose }: { trip: SavedTripRow; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const shareUrl = `${window.location.origin}/trip/${trip.share_slug}`;

  const copyLink = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}
        onClick={onClose}>
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
          style={{ background: "rgba(16,10,28,0.98)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "20px", padding: "28px", width: "100%", maxWidth: "420px", position: "relative" }}
          onClick={(e) => e.stopPropagation()}>

          <button onClick={onClose} style={{ position: "absolute", top: "14px", right: "14px", background: "rgba(255,255,255,0.07)", border: "none", borderRadius: "50%", width: "28px", height: "28px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "rgba(255,255,255,0.5)" }}>
            <X style={{ width: "14px", height: "14px" }} />
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
            <Share2 style={{ width: "20px", height: "20px", color: "#a78bfa" }} />
            <h3 style={{ fontSize: "16px", fontWeight: 800, color: "#fff" }}>Condividi il viaggio</h3>
          </div>

          <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.5)", marginBottom: "16px" }}>
            Chiunque abbia questo link può vedere l'itinerario. Presto potranno anche aggiungere idee e media.
          </p>

          {/* URL box */}
          <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
            <div style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", padding: "10px 12px", fontSize: "12px", color: "rgba(255,255,255,0.6)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {shareUrl}
            </div>
            <button onClick={copyLink}
              style={{ width: "40px", height: "40px", borderRadius: "10px", background: copied ? "rgba(52,211,153,0.2)" : "rgba(167,139,250,0.15)", border: copied ? "1px solid rgba(52,211,153,0.3)" : "1px solid rgba(167,139,250,0.3)", color: copied ? "#34d399" : "#a78bfa", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
              {copied ? <Check style={{ width: "15px", height: "15px" }} /> : <Copy style={{ width: "15px", height: "15px" }} />}
            </button>
          </div>

          {/* Info collaborazione */}
          <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "12px", padding: "14px" }}>
            <div style={{ fontSize: "12px", fontWeight: 700, color: "rgba(255,255,255,0.6)", marginBottom: "8px" }}>🔜 In arrivo</div>
            <ul style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {["Aggiungere idee e note condivise", "Caricare foto e video del viaggio", "Gestire spese di gruppo", "Collaborazione in tempo reale"].map((f) => (
                <li key={f} style={{ fontSize: "12px", color: "rgba(255,255,255,0.45)", display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ color: "#a78bfa" }}>✦</span>{f}
                </li>
              ))}
            </ul>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ── TripCard ──────────────────────────────────────────────────────────────
function SavedTripCard({ trip, onRemove, onShare, onOpen }: {
  trip: SavedTripRow;
  onRemove: () => void;
  onShare: () => void;
  onOpen: () => void;
}) {
  const itinerary = trip.itinerary as ItineraryData | null;
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: "16px", overflow: "hidden" }}>

      {/* Header colorato */}
      <div style={{ background: "linear-gradient(135deg,rgba(249,115,22,0.2) 0%,rgba(168,85,247,0.2) 100%)", padding: "16px 18px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "8px" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
              <span style={{ fontSize: "1.4rem" }}>{itinerary?.heroEmoji ?? "🗺️"}</span>
              <h3 style={{ fontSize: "15px", fontWeight: 800, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {trip.title}
              </h3>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {itinerary?.destination && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "11px", color: "rgba(255,255,255,0.6)" }}>
                  <MapPin style={{ width: "10px", height: "10px" }} />{itinerary.destination}
                </span>
              )}
              {itinerary?.durationDays && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "11px", color: "rgba(255,255,255,0.6)" }}>
                  <Clock style={{ width: "10px", height: "10px" }} />{itinerary.durationDays} giorni
                </span>
              )}
            </div>
          </div>

          {/* Azioni */}
          <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
            <button onClick={onShare}
              style={{ width: "30px", height: "30px", borderRadius: "8px", background: "rgba(167,139,250,0.15)", border: "1px solid rgba(167,139,250,0.25)", color: "#a78bfa", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
              title="Condividi">
              <Share2 style={{ width: "13px", height: "13px" }} />
            </button>
            <button onClick={() => { if (confirmDelete) { onRemove(); } else { setConfirmDelete(true); setTimeout(() => setConfirmDelete(false), 3000); } }}
              style={{ width: "30px", height: "30px", borderRadius: "8px", background: confirmDelete ? "rgba(239,68,68,0.25)" : "rgba(255,255,255,0.07)", border: confirmDelete ? "1px solid rgba(239,68,68,0.35)" : "1px solid rgba(255,255,255,0.1)", color: confirmDelete ? "#f87171" : "rgba(255,255,255,0.4)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
              title={confirmDelete ? "Clicca di nuovo per confermare" : "Elimina"}>
              <Trash2 style={{ width: "13px", height: "13px" }} />
            </button>
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: "14px 18px" }}>
        {itinerary?.vibe && (
          <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.45)", fontStyle: "italic", marginBottom: "12px" }}>"{itinerary.vibe}"</p>
        )}

        {/* Badge info */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "14px" }}>
          {itinerary?.totalBudget && (
            <span style={{ fontSize: "11px", fontWeight: 600, padding: "3px 8px", borderRadius: "6px", background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.55)" }}>
              💰 {itinerary.totalBudget}
            </span>
          )}
          {itinerary?.bestSeason && (
            <span style={{ fontSize: "11px", fontWeight: 600, padding: "3px 8px", borderRadius: "6px", background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.55)" }}>
              🌤 {itinerary.bestSeason}
            </span>
          )}
        </div>

        {/* Link condivisione */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 10px", borderRadius: "8px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", marginBottom: "12px" }}>
          <Globe style={{ width: "12px", height: "12px", color: "rgba(255,255,255,0.3)", flexShrink: 0 }} />
          <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            waydora.com/trip/{trip.share_slug}
          </span>
        </div>

        {/* Bottone apri */}
        <button onClick={onOpen}
          style={{ width: "100%", padding: "9px", borderRadius: "10px", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.8)", fontSize: "13px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", transition: "all 0.15s" }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.12)"; e.currentTarget.style.color = "#fff"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.07)"; e.currentTarget.style.color = "rgba(255,255,255,0.8)"; }}>
          <ExternalLink style={{ width: "13px", height: "13px" }} />
          Apri itinerario completo
        </button>
      </div>
    </motion.div>
  );
}

// ── SavedTripsPage ────────────────────────────────────────────────────────
interface SavedTripsPageProps {
  saved: SavedTripRow[];
  loading: boolean;
  onRemove: (id: string) => void;
  onLogin: () => void;
  isLoggedIn: boolean;
}

export function SavedTripsPage({ saved, loading, onRemove, onLogin, isLoggedIn }: SavedTripsPageProps) {
  const [shareTrip, setShareTrip] = useState<SavedTripRow | null>(null);

  const openTrip = (trip: SavedTripRow) => {
    window.open(`/trip/${trip.share_slug}`, "_blank");
  };

  return (
    <div style={{ height: "100%", overflowY: "auto", background: "var(--wd-bg)", padding: "28px" }}>
      {/* Sfondo blob */}
      <div style={{ position: "fixed", top: "-10%", right: "-5%", width: "40vw", height: "40vw", borderRadius: "50%", background: "radial-gradient(circle,rgba(167,139,250,0.12) 0%,transparent 65%)", filter: "blur(60px)", pointerEvents: "none" }} />

      <div style={{ position: "relative", zIndex: 1, maxWidth: "900px", margin: "0 auto" }}>
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: "28px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
            <BookMarked style={{ width: "22px", height: "22px", color: "#a78bfa" }} />
            <h1 style={{ fontSize: "clamp(1.3rem,3vw,1.8rem)", fontWeight: 900, color: "#fff" }}>Viaggi salvati</h1>
          </div>
          <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.45)" }}>
            I tuoi itinerari salvati — condividili con amici e pianificate insieme.
          </p>
        </motion.div>

        {/* Non loggato */}
        {!isLoggedIn && (
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <div style={{ fontSize: "3rem", marginBottom: "16px" }}>🔒</div>
            <h3 style={{ fontSize: "18px", fontWeight: 800, color: "#fff", marginBottom: "8px" }}>Accedi per vedere i tuoi viaggi</h3>
            <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.45)", marginBottom: "20px" }}>
              Salva i tuoi itinerari e condividili con chi vuoi.
            </p>
            <button onClick={onLogin}
              style={{ padding: "12px 28px", borderRadius: "9999px", background: "var(--wd-grad-warm)", border: "none", color: "#fff", fontSize: "14px", fontWeight: 700, cursor: "pointer" }}>
              Accedi o Registrati
            </button>
          </div>
        )}

        {/* Loggato ma loading */}
        {isLoggedIn && loading && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", padding: "60px", color: "rgba(255,255,255,0.4)" }}>
            <Loader2 style={{ width: "20px", height: "20px", animation: "wd-spin 0.8s linear infinite" }} />
            <span style={{ fontSize: "14px" }}>Caricamento...</span>
            <style>{`@keyframes wd-spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        )}

        {/* Loggato, nessun viaggio */}
        {isLoggedIn && !loading && saved.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <div style={{ fontSize: "3rem", marginBottom: "16px" }}>🗺️</div>
            <h3 style={{ fontSize: "17px", fontWeight: 800, color: "#fff", marginBottom: "8px" }}>Nessun viaggio salvato</h3>
            <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.45)", maxWidth: "300px", margin: "0 auto" }}>
              Genera un itinerario con Waydora e salvalo, oppure metti il cuore a un viaggio nella sezione "Lasciati Ispirare".
            </p>
          </div>
        )}

        {/* Lista viaggi */}
        {isLoggedIn && !loading && saved.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "16px" }}>
            {saved.map((trip) => (
              <SavedTripCard
                key={trip.id}
                trip={trip}
                onRemove={() => onRemove(trip.id)}
                onShare={() => setShareTrip(trip)}
                onOpen={() => openTrip(trip)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modal condivisione */}
      {shareTrip && <ShareModal trip={shareTrip} onClose={() => setShareTrip(null)} />}
    </div>
  );
}