// Helpers per formattare itinerari e attivita' in Markdown leggero Telegram.

// Escape caratteri speciali per parse_mode "Markdown" (legacy, severo).
// Senza escape, un underscore o asterisco non bilanciato in title/vibe/description
// fa rigettare l'intero messaggio da Telegram → utente vede silenzio.
export function md(s: string): string {
  if (s == null) return "";
  return String(s).replace(/([_*\[\]`])/g, "\\$1");
}

export function summarizeItinerary(it: any): string {
  if (!it) return "Itinerario vuoto.";
  const days = Array.isArray(it.days) ? it.days.length : 0;
  const slug = it.shareSlug ?? it.share_slug;
  const webUrl = slug ? `https://www.waydora.com/trip/${slug}` : null;
  return [
    `${it.heroEmoji ?? "🗺️"} *${md(it.title ?? "Viaggio")}*`,
    it.destination ? `📍 ${md(it.destination)}` : null,
    days ? `🗓 ${days} giorni` : null,
    it.totalBudget ? `💶 ${md(it.totalBudget)}` : null,
    it.bestSeason ? `🌤 Stagione: ${md(it.bestSeason)}` : null,
    it.vibe ? `\n_${md(it.vibe)}_` : null,
    webUrl ? `\n🌐 [Apri su Waydora](${webUrl}) — mappa, foto e modifica live` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export function formatDay(day: any, dayNumber: number, doneSet: Set<string> = new Set()): string {
  const lines = [
    `📅 *Giorno ${dayNumber}*${day?.title ? ` — ${md(day.title)}` : ""}`,
    day?.summary ? `_${md(day.summary)}_\n` : "",
  ];
  for (const a of day?.activities ?? []) {
    const key = `${dayNumber}:${a.title}`;
    const check = doneSet.has(key) ? "✅" : "•";
    const emoji = activityEmoji(a);
    const cost = a.estimatedCost ? ` (${md(a.estimatedCost)})` : "";
    const time = a.time ? `${md(a.time)} — ` : "";
    lines.push(`${check} ${emoji} ${time}*${md(a.title ?? "")}*${cost}`);
    if (a.description) lines.push(`   _${md(a.description)}_`);
    if (a?.affiliate?.url) lines.push(`   🔗 [${md(a.affiliate.label ?? "Apri")}](${a.affiliate.url})`);
  }
  return lines.join("\n");
}

// Emoji intelligente: per transport sceglie in base al mezzo, non sempre aereo.
function activityEmoji(a: any): string {
  const cat = (a?.category ?? "").toLowerCase();
  if (cat === "transport") return transportEmoji(a);
  switch (cat) {
    case "stay": return "🏨";
    case "food": return "🍝";
    case "sightseeing": return "🏛️";
    case "experience": return "🎟️";
    case "nightlife": return "🍷";
    case "shopping": return "🛍️";
    case "culture": return "🎭";
    case "nature": return "🌿";
    default: return "📌";
  }
}

function transportEmoji(a: any): string {
  const mode = (a?.transportMode ?? "").toLowerCase();
  if (mode) {
    switch (mode) {
      case "ferry": return "⛴️";
      case "train": return "🚆";
      case "bus": return "🚌";
      case "taxi": return "🚕";
      case "car": return "🚗";
      case "flight": return "✈️";
    }
  }
  const text = `${a?.title ?? ""} ${a?.description ?? ""}`.toLowerCase();
  if (/traghett|ferry|aliscaf|catamarano|trajekt|luka/.test(text)) return "⛴️";
  if (/treno|train|frecci|italo|stazione|tgv|ave|ice/.test(text)) return "🚆";
  if (/autobus|pullman|flixbus|\bbus\b/.test(text)) return "🚌";
  if (/taxi|uber|bolt/.test(text)) return "🚕";
  return "✈️";
}
