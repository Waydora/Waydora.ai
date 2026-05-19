// src/lib/weather.ts

export type WeatherDay = {
  date: string;
  avgTempC: number;
  condition: string;
  icon: string;
  maxWindKph: number;
  chanceOfRain: number;
};

export type WeatherData = {
  location: string;
  country: string;
  days: WeatherDay[];
};

const WEATHER_API_KEY = import.meta.env.VITE_WEATHER_API_KEY as string;

// ── Dizionario disambiguazione città ─────────────────────────────────────
// Formato: "nome italiano lowercase" → "nome internazionale, Paese"
const CITY_MAP: Record<string, string> = {
  // ── Italia (città che collidono con nomi esteri) ──
  "milano":       "Milan, Italy",
  "milan":        "Milan, Italy",
  "torino":       "Turin, Italy",
  "turin":        "Turin, Italy",
  "napoli":       "Naples, Italy",
  "naples":       "Naples, Italy",
  "roma":         "Rome, Italy",
  "rome":         "Rome, Italy",
  "firenze":      "Florence, Italy",
  "florence":     "Florence, Italy",
  "venezia":      "Venice, Italy",
  "venice":       "Venice, Italy",
  "bologna":      "Bologna, Italy",
  "genova":       "Genoa, Italy",
  "genoa":        "Genoa, Italy",
  "palermo":      "Palermo, Italy",
  "bari":         "Bari, Italy",
  "catania":      "Catania, Italy",
  "verona":       "Verona, Italy",
  "trieste":      "Trieste, Italy",
  "padova":       "Padua, Italy",
  "padua":        "Padua, Italy",
  "perugia":      "Perugia, Italy",
  "trento":       "Trento, Italy",
  "cagliari":     "Cagliari, Italy",
  "pescara":      "Pescara, Italy",
  "reggio calabria": "Reggio Calabria, Italy",
  "isernia":      "Isernia, Italy",
  "campobasso":   "Campobasso, Italy",
  "potenza":      "Potenza, Italy",
  "matera":       "Matera, Italy",
  "cefalù":       "Cefalù, Italy",
  "cefalu":       "Cefalù, Italy",
  "taormina":     "Taormina, Italy",
  "positano":     "Positano, Italy",
  "amalfi":       "Amalfi, Italy",
  "siena":        "Siena, Italy",
  "pisa":         "Pisa, Italy",
  "lucca":        "Lucca, Italy",

  // ── Europa centrale/orientale ──
  "praga":        "Prague, Czech Republic",
  "prague":       "Prague, Czech Republic",
  "vienna":       "Vienna, Austria",
  "wien":         "Vienna, Austria",
  "varsavia":     "Warsaw, Poland",
  "warsaw":       "Warsaw, Poland",
  "cracovia":     "Krakow, Poland",
  "krakow":       "Krakow, Poland",
  "budapest":     "Budapest, Hungary",
  "bratislava":   "Bratislava, Slovakia",
  "zagabria":     "Zagreb, Croatia",
  "lubiana":      "Ljubljana, Slovenia",
  "bucarest":     "Bucharest, Romania",
  "sofia":        "Sofia, Bulgaria",
  "belgrado":     "Belgrade, Serbia",
  "sarajevo":     "Sarajevo, Bosnia",
  "tallinn":      "Tallinn, Estonia",
  "riga":         "Riga, Latvia",
  "vilnius":      "Vilnius, Lithuania",

  // ── Europa occidentale ──
  "lisbona":      "Lisbon, Portugal",
  "lisbon":       "Lisbon, Portugal",
  "porto":        "Porto, Portugal",
  "londra":       "London, United Kingdom",
  "london":       "London, United Kingdom",
  "parigi":       "Paris, France",
  "paris":        "Paris, France",
  "berlino":      "Berlin, Germany",
  "berlin":       "Berlin, Germany",
  "monaco":       "Munich, Germany",
  "münchen":      "Munich, Germany",
  "francoforte":  "Frankfurt, Germany",
  "frankfurt":    "Frankfurt, Germany",
  "amburgo":      "Hamburg, Germany",
  "hamburg":      "Hamburg, Germany",
  "amsterdam":    "Amsterdam, Netherlands",
  "bruxelles":    "Brussels, Belgium",
  "brussels":     "Brussels, Belgium",
  "ginevra":      "Geneva, Switzerland",
  "geneva":       "Geneva, Switzerland",
  "zurigo":       "Zurich, Switzerland",
  "zurich":       "Zurich, Switzerland",
  "berna":        "Bern, Switzerland",
  "copenaghen":   "Copenhagen, Denmark",
  "copenhagen":   "Copenhagen, Denmark",
  "stoccolma":    "Stockholm, Sweden",
  "stockholm":    "Stockholm, Sweden",
  "oslo":         "Oslo, Norway",
  "helsinki":     "Helsinki, Finland",
  "dublino":      "Dublin, Ireland",
  "dublin":       "Dublin, Ireland",
  "edimburgo":    "Edinburgh, United Kingdom",
  "edinburgh":    "Edinburgh, United Kingdom",
  "lione":        "Lyon, France",
  "marsiglia":    "Marseille, France",
  "nizza":        "Nice, France",

  // ── Europa meridionale ──
  "atene":        "Athens, Greece",
  "athens":       "Athens, Greece",
  "santorini":    "Santorini, Greece",
  "mykonos":      "Mykonos, Greece",
  "rodi":         "Rhodes, Greece",
  "creta":        "Heraklion, Greece",
  "istanbul":     "Istanbul, Turkey",
  "barcellona":   "Barcelona, Spain",
  "barcelona":    "Barcelona, Spain",
  "madrid":       "Madrid, Spain",
  "siviglia":     "Seville, Spain",
  "seville":      "Seville, Spain",
  "valencia":     "Valencia, Spain",
  "granada":      "Granada, Spain",
  "bilbao":       "Bilbao, Spain",
  "porto rico":   "Puerto Rico, Spain",

  // ── Asia ──
  "tokyo":        "Tokyo, Japan",
  "osaka":        "Osaka, Japan",
  "kyoto":        "Kyoto, Japan",
  "seoul":        "Seoul, South Korea",
  "pechino":      "Beijing, China",
  "beijing":      "Beijing, China",
  "shangai":      "Shanghai, China",
  "shanghai":     "Shanghai, China",
  "bangkok":      "Bangkok, Thailand",
  "singapore":    "Singapore",
  "bali":         "Bali, Indonesia",
  "dubai":        "Dubai, UAE",
  "abu dhabi":    "Abu Dhabi, UAE",
  "doha":         "Doha, Qatar",
  "mumbai":       "Mumbai, India",
  "nuova delhi":  "New Delhi, India",
  "new delhi":    "New Delhi, India",
  "ho chi minh":  "Ho Chi Minh City, Vietnam",
  "hanoi":        "Hanoi, Vietnam",
  "kuala lumpur": "Kuala Lumpur, Malaysia",
  "taipei":       "Taipei, Taiwan",
  "hong kong":    "Hong Kong",

  // ── Americhe ──
  "new york":     "New York, United States",
  "los angeles":  "Los Angeles, United States",
  "miami":        "Miami, United States",
  "chicago":      "Chicago, United States",
  "las vegas":    "Las Vegas, United States",
  "san francisco":"San Francisco, United States",
  "boston":       "Boston, United States",
  "seattle":      "Seattle, United States",
  "toronto":      "Toronto, Canada",
  "vancouver":    "Vancouver, Canada",
  "montréal":     "Montreal, Canada",
  "montreal":     "Montreal, Canada",
  "città del messico": "Mexico City, Mexico",
  "mexico city":  "Mexico City, Mexico",
  "buenos aires": "Buenos Aires, Argentina",
  "rio de janeiro":"Rio de Janeiro, Brazil",
  "san paolo":    "Sao Paulo, Brazil",
  "lima":         "Lima, Peru",
  "bogotà":       "Bogota, Colombia",
  "bogota":       "Bogota, Colombia",

  // ── Africa ──
  "marrakech":    "Marrakech, Morocco",
  "casablanca":   "Casablanca, Morocco",
  "fes":          "Fes, Morocco",
  "il cairo":     "Cairo, Egypt",
  "cairo":        "Cairo, Egypt",
  "cape town":    "Cape Town, South Africa",
  "nairobi":      "Nairobi, Kenya",
  "zanzibar":     "Zanzibar, Tanzania",

  // ── Oceania ──
  "sydney":       "Sydney, Australia",
  "melbourne":    "Melbourne, Australia",
  "brisbane":     "Brisbane, Australia",
  "auckland":     "Auckland, New Zealand",

  // ── Caraibi/America centrale ──
  "tulum":        "Tulum, Mexico",
  "cancun":       "Cancun, Mexico",
  "l'avana":      "Havana, Cuba",
  "havana":       "Havana, Cuba",
  "san josè":     "San Jose, Costa Rica",
};

function disambiguate(destination: string): string {
  // Se contiene già una virgola → già preciso (es. "Tokyo, Japan")
  if (destination.includes(",")) return destination;

  const key = destination.toLowerCase().trim();
  if (CITY_MAP[key]) return CITY_MAP[key];

  // Prova a fare match parziale sul primo token
  // Es. "Milano centro" → cerca "milano" nel dizionario
  const firstWord = key.split(" ")[0];
  if (CITY_MAP[firstWord]) return CITY_MAP[firstWord];

  return destination;
}

export async function fetchWeather(destination: string, days = 7): Promise<WeatherData | null> {
  if (!WEATHER_API_KEY) {
    console.error("VITE_WEATHER_API_KEY non trovata");
    return null;
  }

  const query = disambiguate(destination);
  console.log(`🌤 Meteo: "${destination}" → query: "${query}"`);

  try {
    const res = await fetch(
      `https://api.weatherapi.com/v1/forecast.json?key=${WEATHER_API_KEY}&q=${encodeURIComponent(query)}&days=${Math.min(days, 14)}&lang=it`,
    );

    if (!res.ok) {
      console.error("WeatherAPI error:", res.status);
      return null;
    }

    const data = await res.json();

    return {
      location: data.location.name,
      country:  data.location.country,
      days: data.forecast.forecastday.map((d: any) => ({
        date:          d.date,
        avgTempC:      Math.round(d.day.avgtemp_c),
        condition:     d.day.condition.text,
        icon:          `https:${d.day.condition.icon}`,
        maxWindKph:    Math.round(d.day.maxwind_kph),
        chanceOfRain:  d.day.daily_chance_of_rain,
      })),
    };
  } catch (err) {
    console.error("fetchWeather error:", err);
    return null;
  }
}