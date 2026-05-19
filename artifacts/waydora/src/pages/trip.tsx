import { useEffect, useState } from "react";
import { useParams, Link } from "wouter";
import { Loader2, ArrowLeft, Share2, Copy, Map, Mail } from "lucide-react";
import { Layout } from "@/components/layout";
import { ItineraryResults, PackingList } from "@/components/itinerary-results";
import { TripMap } from "@/components/trip-map";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";

export default function Trip() {
  const params = useParams();
  const slug = params.slug || "";
  const { toast } = useToast();

  const [itinerary, setItinerary] = useState<any>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(false);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);

    // Legge direttamente da Supabase tramite share_slug
    supabase
      .from("saved_trips")
      .select("*")
      .eq("share_slug", slug)
      .single()
      .then(({ data, error: err }) => {
        if (err || !data || !data.itinerary) {
          setError(true);
        } else {
          setItinerary(data.itinerary);
        }
        setLoading(false);
      });
  }, [slug]);

  useEffect(() => {
    if (itinerary?.destination) {
      document.title = `${itinerary.destination} — Waydora`;
    }
  }, [itinerary]);

  const shareUrl = typeof window !== "undefined"
    ? `${window.location.origin}/trip/${slug}`
    : "";

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    toast({ title: "Link copiato!", description: "Ora puoi incollarlo e condividerlo." });
  };

  const handleMailShare = () => {
    if (!itinerary) return;
    const subject = `Guarda questo viaggio a ${itinerary.destination}`;
    const body = `Ho pianificato un viaggio a ${itinerary.destination} con Waydora.\n\nGuarda l'itinerario qui: ${shareUrl}`;
    window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
  };

  const handleWhatsAppShare = () => {
    if (!itinerary) return;
    const text = `Guarda questo viaggio a ${itinerary.destination} pianificato con Waydora: ${shareUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`);
  };

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <Layout>
        <div className="flex-1 flex items-center justify-center" style={{ background: "#0a0a12" }}>
          <Loader2 style={{ width: "36px", height: "36px", color: "#a78bfa", animation: "spin 0.8s linear infinite" }} />
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      </Layout>
    );
  }

  // ── 404 ───────────────────────────────────────────────────────────────────
  if (error || !itinerary) {
    return (
      <Layout>
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center gap-6"
          style={{ background: "#0a0a12" }}>
          <div style={{ fontSize: "4rem" }}>🗺️</div>
          <h2 style={{ fontSize: "24px", fontWeight: 900, color: "#fff" }}>Viaggio non trovato</h2>
          <p style={{ fontSize: "15px", color: "rgba(255,255,255,0.45)", maxWidth: "400px" }}>
            Non abbiamo trovato questo itinerario. Il link potrebbe essere scaduto o il viaggio è stato eliminato.
          </p>
          <Link href="/">
            <button style={{ padding: "12px 28px", borderRadius: "9999px", background: "linear-gradient(135deg,#f97316,#a855f7)", border: "none", color: "#fff", fontSize: "14px", fontWeight: 700, cursor: "pointer" }}>
              ← Torna alla home
            </button>
          </Link>
        </div>
      </Layout>
    );
  }

  // ── Share card ────────────────────────────────────────────────────────────
  const ShareCard = (
    <div style={{
      background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.2)",
      borderRadius: "20px", padding: "28px", textAlign: "center",
    }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
        <div style={{ width: "56px", height: "56px", borderRadius: "50%", background: "rgba(167,139,250,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Share2 style={{ width: "24px", height: "24px", color: "#a78bfa" }} />
        </div>
        <div>
          <h3 style={{ fontSize: "18px", fontWeight: 800, color: "#fff", marginBottom: "6px" }}>Condividi questo viaggio</h3>
          <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.45)" }}>Manda l'itinerario ai compagni di viaggio.</p>
        </div>
        <div style={{ display: "flex", gap: "8px", width: "100%", maxWidth: "480px" }}>
          <div style={{ flex: 1, padding: "10px 14px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", fontSize: "12px", color: "rgba(255,255,255,0.5)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {shareUrl}
          </div>
          <button onClick={handleCopyLink} style={{ display: "flex", alignItems: "center", gap: "6px", padding: "10px 16px", borderRadius: "12px", background: "linear-gradient(135deg,#f97316,#a855f7)", border: "none", color: "#fff", fontSize: "13px", fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
            <Copy style={{ width: "14px", height: "14px" }} />Copia
          </button>
        </div>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", justifyContent: "center" }}>
          <button onClick={handleMailShare} style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 16px", borderRadius: "9999px", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.7)", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
            <Mail style={{ width: "14px", height: "14px" }} />Email
          </button>
          <button onClick={handleWhatsAppShare} style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 16px", borderRadius: "9999px", background: "rgba(37,211,102,0.12)", border: "1px solid rgba(37,211,102,0.3)", color: "#25D366", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
            WhatsApp
          </button>
        </div>
      </div>
    </div>
  );

  // ── Layout principale ─────────────────────────────────────────────────────
  return (
    <Layout>
      {/* Sfondo */}
      <div style={{ position: "fixed", inset: 0, zIndex: -1, background: "#0a0a12" }}>
        <div style={{ position: "absolute", top: "-10%", right: "-5%", width: "50vw", height: "50vw", borderRadius: "50%", background: "radial-gradient(circle,rgba(249,115,22,0.12) 0%,transparent 65%)", filter: "blur(70px)" }} />
        <div style={{ position: "absolute", bottom: "5%", left: "-5%", width: "45vw", height: "45vw", borderRadius: "50%", background: "radial-gradient(circle,rgba(168,85,247,0.12) 0%,transparent 65%)", filter: "blur(70px)" }} />
      </div>

      {/* DESKTOP */}
      <div className="flex-1 min-h-0 hidden lg:grid" style={{ gridTemplateColumns: "minmax(0,1fr) 440px" }}>
        <section className="min-h-0 flex flex-col" style={{ borderRight: "1px solid rgba(255,255,255,0.07)" }}>
          {/* Header */}
          <div className="px-5 py-3 flex items-center justify-between shrink-0"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.07)", background: "rgba(10,10,18,0.88)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" }}>
            <Link href="/">
              <button style={{ display: "flex", alignItems: "center", gap: "6px", background: "none", border: "none", color: "rgba(255,255,255,0.5)", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}
                onMouseEnter={e => { e.currentTarget.style.color = "#fff"; }}
                onMouseLeave={e => { e.currentTarget.style.color = "rgba(255,255,255,0.5)"; }}>
                <ArrowLeft style={{ width: "15px", height: "15px" }} />Pianificatore
              </button>
            </Link>
            <button onClick={handleCopyLink}
              style={{ display: "flex", alignItems: "center", gap: "6px", padding: "7px 16px", borderRadius: "9999px", background: "rgba(255,255,255,0.09)", border: "1px solid rgba(255,255,255,0.18)", color: "#fff", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>
              <Copy style={{ width: "13px", height: "13px" }} />Copia link
            </button>
          </div>

          {/* Contenuto */}
          <div className="flex-1 overflow-y-auto">
            <div style={{ padding: "28px 32px", maxWidth: "720px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "32px", paddingBottom: "64px" }}>
              <ItineraryResults itinerary={itinerary} />
              <PackingList list={itinerary.packingList ?? []} destination={itinerary.destination} />
              {ShareCard}
            </div>
          </div>
        </section>

        {/* Mappa */}
        <aside className="min-h-0 flex flex-col">
          <div className="px-4 py-3 shrink-0"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.07)", background: "rgba(10,10,18,0.88)", backdropFilter: "blur(20px)" }}>
            <span style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.5)" }}>Mappa</span>
          </div>
          <div className="flex-1 min-h-0">
            <TripMap itinerary={itinerary} />
          </div>
        </aside>
      </div>

      {/* MOBILE */}
      <div className="flex-1 min-h-0 lg:hidden flex flex-col">
        <div className="px-4 py-3 flex items-center justify-between shrink-0"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.07)", background: "rgba(10,10,18,0.88)", backdropFilter: "blur(20px)" }}>
          <Link href="/">
            <button style={{ display: "flex", alignItems: "center", gap: "5px", background: "none", border: "none", color: "rgba(255,255,255,0.5)", fontSize: "13px", cursor: "pointer" }}>
              <ArrowLeft style={{ width: "14px", height: "14px" }} />Home
            </button>
          </Link>
          <button onClick={handleCopyLink}
            style={{ display: "flex", alignItems: "center", gap: "5px", padding: "6px 14px", borderRadius: "9999px", background: "rgba(255,255,255,0.09)", border: "1px solid rgba(255,255,255,0.15)", color: "#fff", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>
            <Copy style={{ width: "12px", height: "12px" }} />Copia
          </button>
        </div>

        <Tabs defaultValue="trip" className="flex-1 flex flex-col min-h-0">
          <div className="px-3 pt-3 shrink-0">
            <TabsList className="w-full grid grid-cols-2 rounded-xl p-1"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.09)" }}>
              <TabsTrigger value="trip" className="text-xs font-semibold rounded-lg data-[state=active]:bg-[rgba(255,255,255,0.12)] data-[state=active]:text-white text-[rgba(255,255,255,0.4)]">Itinerario</TabsTrigger>
              <TabsTrigger value="map"  className="text-xs font-semibold rounded-lg data-[state=active]:bg-[rgba(255,255,255,0.12)] data-[state=active]:text-white text-[rgba(255,255,255,0.4)]">Mappa</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="trip" className="flex-1 min-h-0 mt-2">
            <div className="h-full overflow-y-auto px-3 pb-16" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              <ItineraryResults itinerary={itinerary} />
              <PackingList list={itinerary.packingList ?? []} destination={itinerary.destination} />
              {ShareCard}
            </div>
          </TabsContent>
          <TabsContent value="map" className="flex-1 min-h-0 mt-2">
            <div className="h-full">
              <TripMap itinerary={itinerary} />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}