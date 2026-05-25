import { env } from "./env.js";

export type ForecastDay = {
  date: string;
  maxC: number;
  minC: number;
  condition: string;
  icon: string;
  chanceOfRain: number;
};

export async function getForecast(destination: string, days = 5): Promise<ForecastDay[] | null> {
  if (!env.WEATHER_API_KEY || !destination) return null;
  const url = `https://api.weatherapi.com/v1/forecast.json?key=${env.WEATHER_API_KEY}&q=${encodeURIComponent(destination)}&days=${Math.min(days, 10)}&lang=it`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const j: any = await res.json();
    const arr: any[] = j?.forecast?.forecastday ?? [];
    return arr.map((d) => ({
      date: d.date,
      maxC: Math.round(d.day?.maxtemp_c ?? 0),
      minC: Math.round(d.day?.mintemp_c ?? 0),
      condition: d.day?.condition?.text ?? "",
      icon: d.day?.condition?.icon ?? "",
      chanceOfRain: Math.round(d.day?.daily_chance_of_rain ?? 0),
    }));
  } catch {
    return null;
  }
}

export function formatForecast(destination: string, fc: ForecastDay[]): string {
  const lines = [`🌤 Meteo *${destination}*`];
  for (const d of fc) {
    const date = new Date(d.date).toLocaleDateString("it-IT", { weekday: "short", day: "numeric", month: "short" });
    const rain = d.chanceOfRain > 30 ? ` · ☔ ${d.chanceOfRain}%` : "";
    lines.push(`• ${date}: ${d.minC}°–${d.maxC}° ${d.condition}${rain}`);
  }
  return lines.join("\n");
}
