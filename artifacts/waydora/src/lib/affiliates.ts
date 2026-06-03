// ── Configurazione affiliate centralizzata ────────────────────────────────
// Tutti i link partner sono qui per facilitare aggiornamenti futuri.

export const AFFILIATES = {
  GYG_PARTNER_ID: "EPBPR3R",
  STAY22_URL:  "https://booking.stay22.com/waydora/5DPoKS60Cy",
  KIWI_URL:    "https://kiwi.tpm.li/HdS8gBCi",
  GOCITY_URL:  "https://gocity.tpm.li/R2PafwsG",
  TIQETS_URL:  "https://tiqets.tpm.li/5f5kLwe7",
  KLOOK_URL:   "https://klook.tpm.li/VwLE04EZ",
  YESIM_URL:   "https://yesim.tpm.li/3DONLGQL",
} as const;

// ── Go City: città coperte dal pass turistico ─────────────────────────────
// Lista ufficiale aggiornata 2025. Match case-insensitive su `destination`.
const GO_CITY_SUPPORTED = [
  "new york", "nyc", "las vegas", "boston", "san francisco", "los angeles",
  "miami", "san diego", "washington", "chicago", "philadelphia", "orlando",
  "cancun", "toronto", "vancouver",
  "london", "paris", "rome", "roma", "berlin", "amsterdam", "barcelona",
  "madrid", "vienna", "prague", "praga", "dublin", "edinburgh", "lisbon", "lisbona",
  "istanbul", "dubai",
  "sydney", "melbourne", "auckland",
  "bangkok", "singapore", "hong kong", "tokyo",
];

export function isGoCityDestination(destination?: string): boolean {
  if (!destination) return false;
  const d = destination.toLowerCase();
  return GO_CITY_SUPPORTED.some(city => d.includes(city));
}

// Mapping città → slug usato dagli URL gocity.com (/en/{slug})
const GO_CITY_SLUGS: Record<string, string> = {
  "new york": "new-york", "nyc": "new-york",
  "las vegas": "las-vegas", "boston": "boston", "san francisco": "san-francisco",
  "los angeles": "los-angeles", "miami": "miami", "san diego": "san-diego",
  "washington": "washington-dc", "chicago": "chicago", "philadelphia": "philadelphia",
  "orlando": "orlando", "cancun": "cancun", "toronto": "toronto", "vancouver": "vancouver",
  "london": "london", "paris": "paris", "rome": "rome", "roma": "rome",
  "berlin": "berlin", "amsterdam": "amsterdam", "barcelona": "barcelona",
  "madrid": "madrid", "vienna": "vienna", "prague": "prague", "praga": "prague",
  "dublin": "dublin", "edinburgh": "edinburgh", "lisbon": "lisbon", "lisbona": "lisbon",
  "istanbul": "istanbul", "dubai": "dubai",
  "sydney": "sydney", "melbourne": "melbourne", "auckland": "auckland",
  "bangkok": "bangkok", "singapore": "singapore", "hong kong": "hong-kong", "tokyo": "tokyo",
};

// Deeplink Travelpayouts: wrappa qualsiasi URL gocity.com mantenendo marker/trs/campaign per il tracking.
const GOCITY_TP_BASE = "https://tp.media/r?marker=729072&trs=529687&p=1942&campaign_id=62&u=";

// Stay22 "allez" link — accetta query params address/checkin/checkout/adults per pre-filtrare la mappa.
export function stay22UrlFor(destination?: string, checkin?: string, checkout?: string, adults = 2): string {
  if (!destination) return AFFILIATES.STAY22_URL;
  const params = new URLSearchParams({ address: destination, adults: String(adults) });
  if (checkin)  params.set("checkin",  checkin);
  if (checkout) params.set("checkout", checkout);
  return `${AFFILIATES.STAY22_URL}?${params.toString()}`;
}

// Ritorna deeplink TP verso la città specifica se coperta, altrimenti redirect affiliate generico.
export function goCityUrlFor(destination?: string): string {
  if (!destination) return AFFILIATES.GOCITY_URL;
  const d = destination.toLowerCase();
  for (const [key, slug] of Object.entries(GO_CITY_SLUGS)) {
    if (d.includes(key)) return GOCITY_TP_BASE + encodeURIComponent(`https://gocity.com/en/${slug}`);
  }
  return AFFILIATES.GOCITY_URL;
}

// ── Paesi UE (per decidere se mostrare banner Yesim eSIM) ─────────────────
const EU_KEYWORDS = [
  "italy", "italia", "france", "francia", "germany", "germania", "spain", "spagna",
  "portugal", "portogallo", "netherlands", "olanda", "belgium", "belgio", "austria",
  "ireland", "irlanda", "denmark", "danimarca", "sweden", "svezia", "finland", "finlandia",
  "greece", "grecia", "poland", "polonia", "czech", "ceca", "hungary", "ungheria",
  "slovakia", "slovacchia", "slovenia", "croatia", "croazia", "romania", "bulgaria",
  "estonia", "latvia", "lettonia", "lithuania", "lituania", "luxembourg", "lussemburgo",
  "malta", "cyprus", "cipro",
];

export function isOutsideEU(destination?: string): boolean {
  if (!destination) return false;
  const d = destination.toLowerCase();
  return !EU_KEYWORDS.some(eu => d.includes(eu));
}

// ── Affiliate per singola attività (fallback client) ──────────────────────
// Mirror della logica server (ensureAffiliateOnItinerary/buildAffiliate in
// server-standalone.js): costruisce il link di prenotazione per un'attività
// in base alla categoria. Usato come FALLBACK quando l'attività non ha già un
// campo `affiliate` — es. gli itinerari TEMPLATE seminati staticamente, che
// non passano dal server. Garantisce i bottoni "Prenota" su ogni viaggio.
export type ActivityAffiliate = { provider: string; label: string; url: string };

type AffiliateActivity = { title?: string; description?: string; category?: string; transportMode?: string };

function inferTransportMode(activity: AffiliateActivity): string {
  const explicit = (activity?.transportMode || "").toLowerCase().trim();
  if (["flight", "train", "ferry", "bus", "taxi", "car"].includes(explicit)) return explicit;
  const text = `${activity?.title || ""} ${activity?.description || ""}`.toLowerCase();
  if (/(traghett|ferry|catamarano|aliscaf|\bporto\b)/.test(text)) return "ferry";
  if (/(funivia|funicolare|cabinovia|seggiovia|pedaggio)/.test(text)) return "car"; // montagna → Maps
  if (/(treno|train|frecci|italo|trenitalia|intercity|tgv|\bave\b|\bice\b|stazione)/.test(text)) return "train";
  if (/(autobus|pullman|flixbus|\bbus\b)/.test(text)) return "bus";
  if (/(taxi|uber|bolt|free now|\bcab\b)/.test(text)) return "taxi";
  if (/(volo|voli|aereo|flight|aeroport)/.test(text)) return "flight";
  return "flight";
}

function buildTransportAffiliate(activity: AffiliateActivity, destination?: string): ActivityAffiliate {
  const mode = inferTransportMode(activity);
  const q = encodeURIComponent(`${activity?.title || ""} ${destination || ""}`.trim());
  switch (mode) {
    case "ferry": return { provider: "Direct Ferries", label: "Cerca traghetti", url: `https://www.directferries.it/srp_pf.htm?keywords=${q}` };
    case "train": return { provider: "Trainline", label: "Cerca treni", url: `https://www.thetrainline.com/it/cerca/${q}` };
    case "bus":   return { provider: "FlixBus", label: "Cerca bus", url: `https://www.flixbus.it/?q=${q}` };
    case "taxi":  return { provider: "Google Maps", label: "Apri in Maps", url: `https://www.google.com/maps/search/?api=1&query=${q}` };
    case "car":   return { provider: "Google Maps", label: "Indicazioni", url: `https://www.google.com/maps/dir/?api=1&destination=${q}` };
    case "flight":
    default:      return { provider: "Kiwi", label: "Cerca voli", url: AFFILIATES.KIWI_URL };
  }
}

export function buildActivityAffiliate(activity: AffiliateActivity, destination?: string): ActivityAffiliate {
  const category = (activity?.category || "").toLowerCase();
  const q = encodeURIComponent(`${activity?.title || ""} ${destination || ""}`.trim());
  switch (category) {
    case "stay":      return { provider: "Stay22", label: "Cerca alloggi", url: stay22UrlFor(destination) };
    case "food":      return { provider: "Google Maps", label: "Vedi su Maps", url: `https://www.google.com/maps/search/?api=1&query=${q}` };
    case "transport": return buildTransportAffiliate(activity, destination);
    case "sightseeing":
    case "experience":
    case "nightlife":
    default:          return { provider: "GetYourGuide", label: "Prenota ora", url: `https://www.getyourguide.com/s/?q=${q}&partner_id=${AFFILIATES.GYG_PARTNER_ID}` };
  }
}

// ── Decisione endpoint: Railway (Sonnet) vs Vercel (Haiku) ────────────────
// Creazione nuovo itinerario o modifica "pesante" → Railway+Sonnet (no timeout, max qualità)
// Tutto il resto → Vercel+Haiku (veloce, economico)
const HEAVY_EDIT_RX = /aggiungi.+(gior|gg|tappa)|nuov[oi]\s+gior|rigenera|ricr[ea]|rifare|crea\s+(un|il|nuov)|cambia\s+(destinazion|citt[aà]|posto|paese)|sposta.+(gior|tutto)/i;

export function shouldUseRailway(prompt: string, hasItinerary: boolean): boolean {
  if (!hasItinerary) return true;            // creazione nuovo → Railway+Sonnet
  if (HEAVY_EDIT_RX.test(prompt)) return true; // modifica pesante → Railway+Sonnet
  return false;                                 // modifica leggera/chat → Vercel+Haiku
}
