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

// ── Decisione endpoint: Railway (Sonnet) vs Vercel (Haiku) ────────────────
// Creazione nuovo itinerario o modifica "pesante" → Railway+Sonnet (no timeout, max qualità)
// Tutto il resto → Vercel+Haiku (veloce, economico)
const HEAVY_EDIT_RX = /aggiungi.+(gior|gg|tappa)|nuov[oi]\s+gior|rigenera|ricr[ea]|rifare|crea\s+(un|il|nuov)|cambia\s+(destinazion|citt[aà]|posto|paese)|sposta.+(gior|tutto)/i;

export function shouldUseRailway(prompt: string, hasItinerary: boolean): boolean {
  if (!hasItinerary) return true;            // creazione nuovo → Railway+Sonnet
  if (HEAVY_EDIT_RX.test(prompt)) return true; // modifica pesante → Railway+Sonnet
  return false;                                 // modifica leggera/chat → Vercel+Haiku
}
