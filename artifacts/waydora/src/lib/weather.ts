// src/lib/weather.ts
// Integrazione WeatherAPI.com

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

export async function fetchWeather(destination: string, days = 7): Promise<WeatherData | null> {
  if (!WEATHER_API_KEY) {
    console.error("VITE_WEATHER_API_KEY non trovata");
    return null;
  }

  try {
    const response = await fetch(
      `https://api.weatherapi.com/v1/forecast.json?key=${WEATHER_API_KEY}&q=${encodeURIComponent(destination)}&days=${days}&lang=it`,
    );

    if (!response.ok) {
      console.error("Errore WeatherAPI:", response.status);
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

// Genera una query Amazon per articoli da viaggio basata sulla destinazione
export function getWeatherBasedPackingQuery(destination: string, avgTemp: number): string {
  if (avgTemp < 10) return `abbigliamento+invernale+viaggio+${encodeURIComponent(destination)}`;
  if (avgTemp < 20) return `abbigliamento+primaverile+viaggio+impermeabile`;
  return `abbigliamento+estivo+viaggio+leggero`;
}