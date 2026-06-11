import { useState } from "react";
import { X, Check, Loader2, Sparkles } from "lucide-react";
import { startCheckout } from "@/lib/billing";
import { useToast } from "@/hooks/use-toast";

// Modale di upgrade a Waydora Pro. Mostra i vantaggi e avvia il checkout Stripe.
// I prezzi mostrati DEVONO combaciare con i Price creati su Stripe (env del server:
// STRIPE_PRICE_PRO_ANNUAL / STRIPE_PRICE_PRO_MONTHLY).
const PRO_BENEFITS = [
  "Itinerari illimitati ogni mese",
  "Scansione scontrini con l'AI",
  "Personalizzazione avanzata sui tuoi gusti",
  "Modifiche AI illimitate ai viaggi",
  "Esporta e organizza senza limiti",
];

export function UpgradeModal({ open, onClose, reason }: { open: boolean; onClose: () => void; reason?: string }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState<null | "annual" | "monthly">(null);
  if (!open) return null;

  const go = async (plan: "annual" | "monthly") => {
    setLoading(plan);
    try { await startCheckout(plan); }
    catch (e: any) { toast({ title: e?.message || "Errore", variant: "destructive" }); setLoading(null); }
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.72)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
      <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: "440px", background: "rgba(16,10,28,0.98)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "22px", padding: "26px", position: "relative" }}>
        <button onClick={onClose} style={{ position: "absolute", top: "14px", right: "14px", width: "30px", height: "30px", borderRadius: "50%", background: "rgba(255,255,255,0.08)", border: "none", color: "rgba(255,255,255,0.55)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <X style={{ width: "15px", height: "15px" }} />
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
          <Sparkles style={{ width: "20px", height: "20px", color: "#fbbf24" }} />
          <h3 style={{ fontSize: "19px", fontWeight: 900, color: "#fff" }}>Passa a Waydora Pro</h3>
        </div>
        <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.5)", marginBottom: "18px" }}>
          {reason || "Sblocca tutta la potenza di Waydora e pianifica senza limiti."}
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "9px", marginBottom: "22px" }}>
          {PRO_BENEFITS.map(b => (
            <div key={b} style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "13.5px", color: "rgba(255,255,255,0.82)" }}>
              <span style={{ width: "20px", height: "20px", borderRadius: "50%", background: "rgba(52,211,153,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Check style={{ width: "12px", height: "12px", color: "#34d399" }} />
              </span>
              {b}
            </div>
          ))}
        </div>

        {/* Piano annuale (consigliato) */}
        <button onClick={() => go("annual")} disabled={!!loading}
          style={{ width: "100%", padding: "14px", borderRadius: "14px", marginBottom: "10px", background: "var(--wd-grad-warm)", border: "none", color: "#fff", fontSize: "15px", fontWeight: 800, cursor: loading ? "wait" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", position: "relative" }}>
          {loading === "annual" ? <Loader2 style={{ width: "16px", height: "16px", animation: "wd-spin 0.8s linear infinite" }} /> : null}
          Annuale — €34,99/anno
          <span style={{ position: "absolute", top: "-9px", right: "12px", fontSize: "10px", fontWeight: 800, padding: "2px 8px", borderRadius: "9999px", background: "#34d399", color: "#06281c" }}>2 MESI GRATIS</span>
        </button>

        {/* Piano mensile */}
        <button onClick={() => go("monthly")} disabled={!!loading}
          style={{ width: "100%", padding: "12px", borderRadius: "14px", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.14)", color: "rgba(255,255,255,0.8)", fontSize: "14px", fontWeight: 700, cursor: loading ? "wait" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
          {loading === "monthly" ? <Loader2 style={{ width: "15px", height: "15px", animation: "wd-spin 0.8s linear infinite" }} /> : null}
          Mensile — €5,99/mese
        </button>

        <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)", textAlign: "center", marginTop: "14px" }}>
          Pagamento sicuro con Stripe · disdici quando vuoi
        </p>
        <style>{`@keyframes wd-spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  );
}
