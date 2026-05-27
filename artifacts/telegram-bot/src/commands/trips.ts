import type { Composer, Context } from "grammy";
import { InlineKeyboard } from "grammy";
import { listTrips, getTrip } from "../lib/trips.js";
import { loadOrCreateSession, saveSession } from "../lib/persistence.js";
import { summarizeItinerary, formatDay } from "../lib/format.js";
import { getDone } from "../lib/done-set.js";
import { buildItineraryKeyboard } from "./chat-ai.js";
import type { BoundContext } from "../bot.js";

export function registerTripCommands(bot: Composer<BoundContext>) {
  bot.command("viaggi", async (ctx) => {
    const trips = await listTrips(ctx.binding.user_id);
    if (trips.length === 0) {
      await ctx.reply(
        "Non hai ancora viaggi salvati.\n\n" +
          "Crea un itinerario qui scrivendomi dove vuoi andare, " +
          "oppure salvane uno dalla webapp waydora.com.",
      );
      return;
    }
    const kb = new InlineKeyboard();
    for (const t of trips.slice(0, 10)) {
      const it = t.itinerary ?? {};
      const label = `${it.heroEmoji ?? "🧳"} ${t.title ?? it.title ?? it.destination ?? "Viaggio"}`;
      kb.text(label.slice(0, 60), `trip:${t.id}`).row();
    }
    await ctx.reply("I tuoi viaggi salvati:", { reply_markup: kb });
  });

  // Selezione viaggio: carica l'itinerario nella sessione AI così l'utente
  // puo' continuare a chattare (modifiche, idee, meteo) sul viaggio scelto.
  bot.callbackQuery(/^trip:(.+)$/, async (ctx) => {
    const tripId = ctx.match![1];
    const trip = await getTrip(tripId, ctx.binding.user_id);
    if (!trip) {
      await ctx.answerCallbackQuery({ text: "Viaggio non trovato" });
      return;
    }
    const session = await loadOrCreateSession(ctx.binding.user_id, ctx.from!.id);
    session.itinerary = trip.itinerary;
    // Reset chat: parte una conversazione fresca contestualizzata sul trip
    session.api_messages = [];
    session.turns = [];
    await saveSession(session);
    await ctx.answerCallbackQuery({ text: "Viaggio caricato ✅" });
    const it = trip.itinerary ?? {};
    await ctx.reply(summarizeItinerary(it), {
      parse_mode: "Markdown",
      reply_markup: buildItineraryKeyboard(it),
    });
    await ctx.reply("Ora puoi chiedermi modifiche, info, meteo, mappa, calendario o salvare idee.");
  });

  bot.command("viaggio", async (ctx) => {
    const session = await loadOrCreateSession(ctx.binding.user_id, ctx.from!.id);
    if (!session.itinerary) {
      await ctx.reply("Nessun viaggio selezionato. Usa /viaggi per sceglierne uno.");
      return;
    }
    await ctx.reply(summarizeItinerary(session.itinerary), {
      parse_mode: "Markdown",
      reply_markup: buildItineraryKeyboard(session.itinerary),
    });
  });

  bot.command("oggi", async (ctx) => sendDay(ctx, undefined));
  bot.command("giorno", async (ctx) => {
    const n = Number(ctx.match);
    if (!Number.isFinite(n) || n < 1) {
      await ctx.reply("Uso: /giorno <numero>. Es: /giorno 2");
      return;
    }
    await sendDay(ctx, n);
  });
}

async function sendDay(ctx: BoundContext & Context, n: number | undefined) {
  const session = await loadOrCreateSession(ctx.binding.user_id, ctx.from!.id);
  const days: any[] = Array.isArray(session.itinerary?.days) ? session.itinerary!.days : [];
  if (days.length === 0) {
    await ctx.reply("Nessun itinerario attivo. Usa /viaggi o crea un nuovo viaggio.");
    return;
  }
  const idx = n ? n - 1 : 0;
  const day = days[idx];
  if (!day) {
    await ctx.reply(`Giorno ${n} non trovato (max ${days.length}).`);
    return;
  }
  const done = getDone(ctx.from!.id, session.id);
  await ctx.reply(formatDay(day, idx + 1, done), { parse_mode: "Markdown" });
}
