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

// ── Mapping città italiane → nome internazionale preciso ──────────────────
// Evita che WeatherAPI trovi la città sbagliata (es. Praga → Pragal, Portogallo)
const CITY_DISAMBIGUATION: Record<string, string> = {
  // Europa centrale/orientale
  "praga":      "Prague, Czech Republic",
  "prague":     "Prague, Czech Republic",
  "vienna":     "Vienna, Austria",
  "wien":       "Vienna, Austria",
  "varsavia":   "Warsaw, Poland",
  "warsaw":     "Warsaw, Poland",
  "budapest":   "Budapest, Hungary",
  "bratislava": "Bratislava, Slovakia",
  "zagabria":   "Zagreb, Croatia",
  "lubiana":    "Ljubljana, Slovenia",
  "bucarest":   "Bucharest, Romania",
  "sofia":      "Sofia, Bulgaria",
  "belgrado":   "Belgrade, Serbia",

  // Europa occidentale
  "lisbona":    "Lisbon, Portugal",
  "lisbon":     "Lisbon, Portugal",
  "porto":      "Porto, Portugal",
  "londra":     "London, United Kingdom",
  "london":     "London, United Kingdom",
  "parigi":     "Paris, France",
  "paris":      "Paris, France",
  "berlino":    "Berlin, Germany",
  "berlin":     "Berlin, Germany",
  "monaco":     "Munich, Germany",
  "münchen":    "Munich, Germany",
  "amsterdam":  "Amsterdam, Netherlands",
  "bruxelles":  "Brussels, Belgium",
  "ginevra":    "Geneva, Switzerland",
  "zurigo":     "Zurich, Switzerland",
  "copenaghen": "Copenhagen, Denmark",
  "stoccolma":  "Stockholm, Sweden",
  "oslo":       "Oslo, Norway",
  "helsinki":   "Helsinki, Finland",
  "dublino":    "Dublin, Ireland",
  "edimburgo":  "Edinburgh, United Kingdom",

  // Europa meridionale
  "atene":      "Athens, Greece",
  "athens":     "Athens, Greece",
  "santorini":  "Santorini, Greece",
  "mykonos":    "Mykonos, Greece",
  "istanbul":   "Istanbul, Turkey",
  "barcellona": "Barcelona, Spain",
  "barcelona":  "Barcelona, Spain",
  "madrid":     "Madrid, Spain",
  "siviglia":   "Seville, Spain",
  "valencia":   "Valencia, Spain",

  // Asia
  "tokyo":      "Tokyo, Japan",
  "osaka":      "Osaka, Japan",
  "kyoto":      "Kyoto, Japan",
  "seoul":      "Seoul, South Korea",
  "pechino":    "Beijing, China",
  "beijing":    "Beijing, China",
  "shangai":    "Shanghai, China",
  "shanghai":   "Shanghai, China",
  "bangkok":    "Bangkok, Thailand",
  "singapore":  "Singapore",
  "bali":       "Bali, Indonesia",
  "dubai":      "Dubai, UAE",
  "abu dhabi":  "Abu Dhabi, UAE",
  "doha":       "Doha, Qatar",
  "mumbai":     "Mumbai, India",
  "nuova delhi":"New Delhi, India",

  // Americhe
  "new york":   "New York, United States",
  "los angeles":"Los Angeles, United States",
  "miami":      "Miami, United States",
  "chicago":    "Chicago, United States",
  "las vegas":  "Las Vegas, United States",
  "san francisco":"San Francisco, United States",
  "toronto":    "Toronto, Canada",
  "vancouver":  "Vancouver, Canada",
  "città del messico":"Mexico City, Mexico",
  "buenos aires":"Buenos Aires, Argentina",
  "rio de janeiro":"Rio de Janeiro, Brazil",
  "san paolo":  "Sao Paulo, Brazil",

  // Africa
  "marrakech":  "Marrakech, Morocco",
  "casablanca": "Casablanca, Morocco",
  "il cairo":   "Cairo, Egypt",
  "cape town":  "Cape Town, South Africa",
  "nairobi":    "Nairobi, Kenya",

  // Oceania
  "sydney":     "Sydney, Australia",
  "melbourne":  "Melbourne, Australia",
  "auckland":   "Auckland, New Zealand",

  // Caraibi/America centrale
  "tulum":      "Tulum, Mexico",
  "cancun":     "Cancun, Mexico",
  "l'avana":    "Havana, Cuba",
};

/**
 * Disambigua la destinazione per evitare errori geografici.
 * Es: "Praga" → "Prague, Czech Republic"
 */
function disambiguateCity(destination: string): string {
  // Se contiene già una virgola (es. "Tokyo, Japan") è già preciso
  if (destination.includes(",")) return destination;

  const key = destination.toLowerCase().trim();
  return CITY_DISAMBIGUATION[key] || destination;
}

export async function fetchWeather(destination: string, days = 7): Promise<WeatherData | null> {
  if (!WEATHER_API_KEY) {
    console.error("VITE_WEATHER_API_KEY non trovata");
    return null;
  }

  const query = disambiguateCity(destination);
  console.log(`Meteo: "${destination}" → query: "${query}"`);

  try {
    const response = await fetch(
      `https://api.weatherapi.com/v1/forecast.json?key=${WEATHER_API_KEY}&q=${encodeURIComponent(query)}&days=${Math.min(days, 14)}&lang=it`,
    );

    if (!response.ok) {
      console.error("Errore WeatherAPI:", response.status, await response.text());
      return null;
    }

    const data = await response.json();

    return {
      location: data.location.name,
      country: data.location.country,
      days: data.forecast.forecastday.map((d: any) => ({
        date: d.date,
        avgTempC: Math.round(d.day.avgtemp_c),
        condition: d.day.condition.text,
        icon: `https:${d.day.condition.icon}`,
        maxWindKph: Math.round(d.day.maxwind_kph),
        chanceOfRain: d.day.daily_chance_of_rain,
      })),
    };
  } catch (err) {
    console.error("Errore fetch meteo:", err);
    return null;
  }
}