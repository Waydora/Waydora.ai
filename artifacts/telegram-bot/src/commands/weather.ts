import type { Composer } from "grammy";
import type { BoundContext } from "../bot.js";
import { loadOrCreateSession } from "../lib/persistence.js";
import { getForecast, formatForecast } from "../lib/weather.js";

export function registerWeather(bot: Composer<BoundContext>) {
  bot.command("meteo", async (ctx) => {
    const arg = (ctx.match ?? "").toString().trim();
    const session = await loadOrCreateSession(ctx.binding.user_id, ctx.from!.id);
    const dest = arg || session.itinerary?.destination;
    if (!dest) {
      await ctx.reply("Uso: /meteo <citta'> — oppure crea prima un itinerario.");
      return;
    }
    const fc = await getForecast(dest, 5);
    if (!fc) {
      await ctx.reply("Meteo non disponibile al momento.");
      return;
    }
    await ctx.reply(formatForecast(dest, fc), { parse_mode: "Markdown" });
  });

  bot.callbackQuery("weather:cur", async (ctx) => {
    const session = await loadOrCreateSession(ctx.binding.user_id, ctx.from!.id);
    const dest = session.itinerary?.destination;
    if (!dest) {
      await ctx.answerCallbackQuery({ text: "Nessuna destinazione." });
      return;
    }
    await ctx.answerCallbackQuery();
    const fc = await getForecast(dest, 5);
    if (!fc) {
      await ctx.reply("Meteo non disponibile.");
      return;
    }
    await ctx.reply(formatForecast(dest, fc), { parse_mode: "Markdown" });
  });

  bot.callbackQuery(/^weather:day:(\d+)$/, async (ctx) => {
    const dayN = Number(ctx.match![1]);
    const session = await loadOrCreateSession(ctx.binding.user_id, ctx.from!.id);
    const dest = session.itinerary?.destination;
    if (!dest) {
      await ctx.answerCallbackQuery({ text: "Nessuna destinazione." });
      return;
    }
    await ctx.answerCallbackQuery();
    const fc = await getForecast(dest, Math.max(dayN, 3));
    const single = fc?.[dayN - 1];
    if (!single) {
      await ctx.reply("Meteo non disponibile per quel giorno.");
      return;
    }
    await ctx.reply(formatForecast(dest, [single]), { parse_mode: "Markdown" });
  });
}
