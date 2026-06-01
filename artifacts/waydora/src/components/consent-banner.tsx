// src/components/consent-banner.tsx
// Banner consenso analytics (GDPR opt-in). Mobile-first, no framer-motion.
// Finché l'utente non sceglie, PostHog resta opt-out (nessun evento parte).
import { useEffect, useState } from "react";
import { optIn, optOut, getConsentChoice } from "@/lib/analytics";

export function ConsentBanner() {
  // Mostra il banner solo se non è stata ancora fatta una scelta.
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (getConsentChoice() === null) setVisible(true);
  }, []);

  if (!visible) return null;

  const accept = () => { optIn(); setVisible(false); };
  const decline = () => { optOut(); setVisible(false); };

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Consenso analytics"
      style={{
        position: "fixed",
        left: "12px",
        right: "12px",
        bottom: "12px",
        zIndex: 60,
        margin: "0 auto",
        maxWidth: "560px",
        borderRadius: "16px",
        padding: "16px",
        background: "rgba(13,10,24,0.96)",
        backdropFilter: "blur(20px) saturate(160%)",
        WebkitBackdropFilter: "blur(20px) saturate(160%)",
        border: "1px solid rgba(255,255,255,0.12)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.45)",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
      }}
    >
      <div style={{ fontSize: "13px", lineHeight: 1.55, color: "rgba(255,255,255,0.78)" }}>
        Usiamo analytics di prodotto (PostHog, hosting UE) per capire come migliorare Waydora.
        Nessun dato personale come email o testo dei messaggi viene inviato.{" "}
        <a
          href="/legale/privacy"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "#fb923c", textDecoration: "underline" }}
        >
          Privacy Policy
        </a>
      </div>
      <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", flexWrap: "wrap" }}>
        <button
          onClick={decline}
          style={{
            flex: "1 1 auto",
            minWidth: "120px",
            padding: "10px 16px",
            borderRadius: "9999px",
            fontSize: "13px",
            fontWeight: 600,
            cursor: "pointer",
            background: "rgba(255,255,255,0.07)",
            border: "1px solid rgba(255,255,255,0.14)",
            color: "rgba(255,255,255,0.7)",
          }}
        >
          Rifiuta
        </button>
        <button
          onClick={accept}
          style={{
            flex: "1 1 auto",
            minWidth: "120px",
            padding: "10px 16px",
            borderRadius: "9999px",
            fontSize: "13px",
            fontWeight: 700,
            cursor: "pointer",
            background: "var(--wd-grad-warm)",
            border: "none",
            color: "#fff",
          }}
        >
          Accetta
        </button>
      </div>
    </div>
  );
}
