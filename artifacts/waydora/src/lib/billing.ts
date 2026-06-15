import { supabase } from "@/lib/supabase";

// ── Billing (Stripe) lato client ────────────────────────────────────────────
// Avvia il checkout sull'api-server (Railway) e gestisce il limite freemium.

const API_BASE = (import.meta.env.VITE_API_URL ?? "https://waydoraai-production.up.railway.app") + "/api";

// Quante GENERAZIONI di nuovi itinerari può fare un utente non-Pro al mese.
// (Le modifiche a un itinerario esistente non contano.) Limite "soft" lato client:
// per il lancio va bene; l'hardening server-side è una fase successiva.
export const FREE_MONTHLY_GENERATIONS = 3;

function monthKey(userId?: string): string {
  const d = new Date();
  const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  return `wd_gen_${userId ?? "guest"}_${ym}`;
}

export function freeGenerationsUsed(userId?: string): number {
  try { return parseInt(localStorage.getItem(monthKey(userId)) || "0", 10) || 0; } catch { return 0; }
}
export function freeGenerationsLeft(userId?: string): number {
  return Math.max(0, FREE_MONTHLY_GENERATIONS - freeGenerationsUsed(userId));
}
export function incFreeGeneration(userId?: string): void {
  try { localStorage.setItem(monthKey(userId), String(freeGenerationsUsed(userId) + 1)); } catch { /* ignore */ }
}

// Avvia il checkout Stripe e redirige alla pagina di pagamento. plan: annual | monthly.
export async function startCheckout(plan: "annual" | "monthly"): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Devi accedere prima di passare a Pro.");
  const res = await fetch(`${API_BASE}/billing/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ plan }),
  });
  const data = await res.json().catch(() => ({} as any));
  if (!res.ok || !data?.url) throw new Error(data?.error || "Impossibile avviare il pagamento. Riprova.");
  window.location.href = data.url as string;
}

// Apre il Customer Portal Stripe (gestione metodo di pagamento / disdetta / fatture).
export async function openBillingPortal(): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Devi accedere.");
  const res = await fetch(`${API_BASE}/billing/portal`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
  });
  const data = await res.json().catch(() => ({} as any));
  if (!res.ok || !data?.url) throw new Error(data?.error || "Impossibile aprire la gestione abbonamento.");
  window.location.href = data.url as string;
}
