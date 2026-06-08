// ── Profilo viaggiatore (auto dai viaggi) ───────────────────────────────────
// Costruisce un riassunto COMPATTO dei gusti dell'utente a partire dai suoi
// itinerari salvati/generati. Nessuna analisi delle conversazioni, nessun dato
// sensibile: solo mete, stile, budget, durata e interessi ricavati dai viaggi.
// Il risultato viene iniettato nel prompt per personalizzare i suggerimenti.

function parseEuro(s: unknown): number | null {
  if (typeof s !== "string") return null;
  // "€1.200 totali" → 1200 ; "420€" → 420
  const m = s.replace(/\./g, "").match(/(\d+(?:,\d+)?)/);
  if (!m) return null;
  const n = parseFloat(m[1].replace(",", "."));
  return isNaN(n) ? null : n;
}

function topN(map: Map<string, number>, n: number): string[] {
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(e => e[0]);
}

function catLabel(cat: string): string {
  switch (cat) {
    case "food":        return "cucina locale";
    case "sightseeing": return "arte e monumenti";
    case "experience":  return "esperienze";
    case "activity":    return "attività all'aperto";
    case "nightlife":   return "vita notturna";
    default:            return "";
  }
}

function budgetTier(avg: number): string {
  if (avg < 500) return "contenuto";
  if (avg < 1500) return "medio";
  return "alto";
}

// `itineraries`: array di oggetti itinerario (campo .itinerary dei saved_trips).
export function buildTravelProfile(itineraries: any[]): string | null {
  const its = (itineraries || []).filter(it => it && Array.isArray(it.days) && it.days.length > 0);
  if (its.length < 1) return null;

  const destCount = new Map<string, number>();
  const catCount = new Map<string, number>();
  const budgets: number[] = [];
  const durations: number[] = [];

  for (const it of its) {
    const dest = String(it.destination || "").trim();
    if (dest) {
      const parts = dest.split(",").map((s: string) => s.trim()).filter(Boolean);
      const key = parts.length > 1 ? parts[parts.length - 1] : parts[0];
      if (key) destCount.set(key, (destCount.get(key) || 0) + 1);
    }
    const b = parseEuro(it.totalBudget);
    if (b) budgets.push(b);
    if (typeof it.durationDays === "number" && it.durationDays > 0) durations.push(it.durationDays);
    for (const d of it.days || []) {
      for (const a of d.activities || []) {
        const c = String(a.category || "").toLowerCase();
        if (c && c !== "transport" && c !== "stay") catCount.set(c, (catCount.get(c) || 0) + 1);
      }
    }
  }

  const lines: string[] = [];
  const topDest = topN(destCount, 5);
  if (topDest.length) lines.push(`Mete che ha già pianificato: ${topDest.join(", ")}.`);
  const interests = topN(catCount, 4).map(catLabel).filter(Boolean);
  if (interests.length) lines.push(`Interessi ricorrenti: ${interests.join(", ")}.`);
  if (budgets.length) lines.push(`Budget tipico: ${budgetTier(budgets.reduce((a, b) => a + b, 0) / budgets.length)}.`);
  if (durations.length) lines.push(`Durata media dei viaggi: ${Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)} giorni.`);

  return lines.length ? lines.join(" ") : null;
}
