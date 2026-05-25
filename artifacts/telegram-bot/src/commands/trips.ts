import type { Composer, Context } from "grammy";
import { InlineKeyboard } from "grammy";
import { listTrips, getTrip } from "../lib/trips.js";
import { getSession, setActiveTrip } from "../lib/session.js";
import type { BoundContext } from "../bot.js";

export function registerTripCommands(bot: Composer<BoundContext>) {
  bot.command("viaggi", async (ctx) => {
    const trips = await listTrips(ctx.binding.user_id);
    if (trips.length === 0) {
      await ctx.reply("Non hai ancora viaggi. Creane uno su waydora.com ✈️");
      return;
    }
    const kb = new InlineKeyboard();
    for (const t of trips.slice(0, 10)) {
      const label = `${t.hero_emoji ?? "🧳"} ${t.title ?? t.destination ?? "Viaggio"}`;
      kb.text(label, `trip:${t.id}`).row();
    }
    await ctx.reply("I tuoi viaggi:", { reply_markup: kb });
  });

  bot.callbackQuery(/^trip:(.+)$/, async (ctx) => {
    const tripId = ctx.match![1];
    const trip = await getTrip(tripId, ctx.binding.user_id);
    if (!trip) {
      await ctx.answerCallbackQuery({ text: "Viaggio non trovato" });
      return;
    }
    setActiveTrip(ctx.from!.id, tripId);
    await ctx.answerCallbackQuery({ text: "Selezionato ✅" });
    await ctx.reply(formatTripSummary(trip));
  });

  bot.command("viaggio", async (ctx) => {
    const s = getSession(ctx.from!.id);
    if (!s.activeTripId) {
      await ctx.reply("Nessun viaggio selezionato. Usa /viaggi per sceglierne uno.");
      return;
    }
    const trip = await getTrip(s.activeTripId, ctx.binding.user_id);
    if (!trip) {
      await ctx.reply("Viaggio non piu' disponibile. /viaggi");
      return;
    }
    await ctx.reply(formatTripSummary(trip));
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

function formatTripSummary(t: Awaited<ReturnType<typeof getTrip>>): string {
  if (!t) return "";
  const days = Array.isArray(t.days) ? t.days.length : 0;
  return [
    `${t.hero_emoji ?? "🧳"} *${t.title ?? "Viaggio"}*`,
    t.destination ? `📍 ${t.destination}` : null,
    days ? `🗓 ${days} giorni` : null,
    t.description ? `\n${t.description}` : null,
    `\nComandi: /oggi /giorno N /bagaglio /meteo`,
  ]
    .filter(Boolean)
    .join("\n");
}

async function sendDay(ctx: BoundContext & Context, n: number | undefined) {
  const s = getSession(ctx.from!.id);
  if (!s.activeTripId) {
    await ctx.reply("Seleziona prima un viaggio con /viaggi");
    return;
  }
  const trip = await getTrip(s.activeTripId, ctx.binding.user_id);
  const days: any[] = Array.isArray(trip?.days) ? trip!.days : [];
  if (days.length === 0) {
    await ctx.reply("Itinerario non disponibile per questo viaggio.");
    return;
  }
  const idx = n ? n - 1 : 0;
  const day = days[idx];
  if (!day) {
    await ctx.reply(`Giorno ${n} non trovato (max ${days.length}).`);
    return;
  }
  const acts: any[] = Array.isArray(day.activities) ? day.activities : [];
  const lines = [
    `📅 *Giorno ${idx + 1}*${day.title ? ` — ${day.title}` : ""}`,
    ...acts.map((a: any) => `• ${a.time ?? ""} ${a.title ?? ""}`.trim()),
  ];
  await ctx.reply(lines.join("\n"));
}
