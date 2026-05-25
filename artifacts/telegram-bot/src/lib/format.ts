// Helpers per formattare itinerari e attivita' in Markdown leggero Telegram.

export function md(s: string): string {
  return s.replace(/([_*\[\]()~`>#+\-=|{}.!])/g, "\\$1");
}

export function summarizeItinerary(it: any): string {
  if (!it) return "Itinerario vuoto.";
  const days = Array.isArray(it.days) ? it.days.length : 0;
  return [
    `${it.heroEmoji ?? "🗺️"} *${it.title ?? "Viaggio"}*`,
    it.destination ? `📍 ${it.destination}` : null,
    days ? `🗓 ${days} giorni` : null,
    it.totalBudget ? `💶 ${it.totalBudget}` : null,
    it.bestSeason ? `🌤 Stagione: ${it.bestSeason}` : null,
    it.vibe ? `\n_${it.vibe}_` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export function formatDay(day: any, dayNumber: number, doneSet: Set<string> = new Set()): string {
  const lines = [
    `📅 *Giorno ${dayNumber}*${day?.title ? ` — ${day.title}` : ""}`,
    day?.summary ? `_${day.summary}_\n` : "",
  ];
  for (const a of day?.activities ?? []) {
    const key = `${dayNumber}:${a.title}`;
    const check = doneSet.has(key) ? "✅" : "•";
    const cat = catEmoji(a.category);
    const cost = a.estimatedCost ? ` (${a.estimatedCost})` : "";
    const time = a.time ? `${a.time} — ` : "";
    lines.push(`${check} ${cat} ${time}*${a.title}*${cost}`);
    if (a.description) lines.push(`   _${a.description}_`);
    if (a?.affiliate?.url) lines.push(`   🔗 [${a.affiliate.label}](${a.affiliate.url})`);
  }
  return lines.join("\n");
}

function catEmoji(c?: string): string {
  switch ((c ?? "").toLowerCase()) {
    case "stay": return "🏨";
    case "food": return "🍝";
    case "transport": return "✈️";
    case "sightseeing": return "🏛️";
    case "experience": return "🎟️";
    case "nightlife": return "🍷";
    default: return "📌";
  }
}
