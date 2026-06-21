// ── Entitlements (free vs Pro) ───────────────────────────────────────────────
// Sorgente UNICA del gating delle funzioni a pagamento, condivisa tra la creazione
// (home.tsx) e il viaggio salvato/condiviso (trip.tsx). La verità sull'essere Pro
// resta lato server: user.tier === "paid" (app_metadata.tier via webhook Stripe).
//
// Modello deciso col prodotto:
//  • FREE → itinerario, mappa, bagaglio, condivisione del viaggio, chat compagni 💬,
//           bot Telegram, 3 generazioni/mese (vedi lib/billing.ts).
//  • PRO  → in più: meteo, calendario, spese e modifica AI ✨ dell'itinerario.
//  • Viaggi CONDIVISI: le funzioni Pro sono sbloccate dal piano del PROPRIETARIO del
//    viaggio, così gli amici che aprono il link (anche guest non registrati) possono
//    collaborare quando l'owner è Pro. La chat compagni resta libera per tutti
//    (zero costo AI, è il gancio collaborativo/virale).
//  • Nascosti per ora a TUTTI: idee e media (non ancora rifiniti per il cliente).

export type PlanTier = "guest" | "free" | "paid";

// Tool che richiedono Pro. Gli id combaciano con le toolbar di home.tsx e trip.tsx.
export const PRO_TOOLS = new Set<string>(["calendar", "weather", "expenses"]);

// Tool nascosti a tutti finché non saranno davvero utili al cliente.
export const HIDDEN_TOOLS = new Set<string>(["ideas", "media"]);

// Un tool è bloccato quando è Pro e le funzioni Pro non sono sbloccate nel contesto.
export function isToolLocked(toolId: string, proUnlocked: boolean): boolean {
  return PRO_TOOLS.has(toolId) && !proUnlocked;
}

// Rimuove i tool nascosti da una lista di toolbar (preserva l'ordine).
export function visibleTools<T extends { id: string }>(tools: T[]): T[] {
  return tools.filter(t => !HIDDEN_TOOLS.has(t.id));
}

// Calcola se le funzioni Pro sono sbloccate su un viaggio condiviso.
// isOwnerPaid: piano dell'utente corrente quando È il proprietario del viaggio.
// ownerPro:    flag persistito sul viaggio (saved_trips.owner_pro) — vale per chi
//              apre il link senza essere l'owner (amici/guest).
export function proUnlockedFor(isOwner: boolean, isOwnerPaid: boolean, ownerPro: boolean): boolean {
  return isOwner ? isOwnerPaid : ownerPro;
}
