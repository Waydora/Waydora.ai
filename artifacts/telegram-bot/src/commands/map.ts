import type { Composer } from "grammy";
import { InlineKeyboard } from "grammy";
import type { BoundContext } from "../bot.js";
import { loadOrCreateSession } from "../lib/persistence.js";

// Costruisce un URL Google Maps con la destinazione + waypoints intermedi.
// Formato: https://www.google.com/maps/dir/?api=1&destination=...&waypoints=...|...
function buildMapsRouteUrl(activities: Array<{ title: string; coordinates?: { lat: number; lng: number } }>, destination: string): string {
  const withCoords = activities.filter((a) => a.coordinates?.lat && a.coordinates?.lng);
  if (withCoords.length === 0) {
    // Fallback: ricerca generica della destinazione
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(destination)}`;
  }
  if (withCoords.length === 1) {
    const c = withCoords[0].coordinates!;
    return `https://www.google.com/maps/search/?api=1&query=${c.lat},${c.lng}`;
  }
  const dest = withCoords[withCoords.length - 1].coordinates!;
  const waypoints = withCoords
    .slice(0, -1)
    .map((a) => `${a.coordinates!.lat},${a.coordinates!.lng}`)
    .join("|");
  return `https://www.google.com/maps/dir/?api=1&destination=${dest.lat},${dest.lng}&waypoints=${encodeURIComponent(waypoints)}&travelmode=walking`;
}

// Pin singoli (venue) per ogni POI con coordinate del giorno.
async function sendDayVenues(ctx: any, day: any) {
  const acts: any[] = Array.isArray(day?.activities) ? day.activities : [];
  for (const a of acts) {
    if (!a?.coordinates?.lat || !a?.coordinates?.lng) continue;
    try {
      await ctx.replyWithVenue(
        Number(a.coordinates.lat),
        Number(a.coordinates.lng),
        String(a.title ?? "Tappa").slice(0, 64),
        String(a.description ?? a.time ?? "").slice(0, 64) || "Tappa",
      );
    } catch (e) {
      console.warn("[map] sendVenue err", e);
    }
  }
}

export function registerMap(bot: Composer<BoundContext>) {
  bot.command("mappa", async (ctx) => {
    await runMap(ctx, undefined);
  });

  bot.callbackQuery("map:trip", async (ctx) => {
    await ctx.answerCallbackQuery();
    await runMap(ctx, undefined);
  });

  bot.callbackQuery(/^map:day:(\d+)$/, async (ctx) => {
    const dayN = Number(ctx.match![1]);
    await ctx.answerCallbackQuery();
    await runMap(ctx, dayN);
  });

  bot.callbackQuery(/^map:venues:(\d+)$/, async (ctx) => {
    const dayN = Number(ctx.match![1]);
    const session = await loadOrCreateSession(ctx.binding.user_id, ctx.from!.id);
    const day = session.itinerary?.days?.[dayN - 1];
    if (!day) {
      await ctx.answerCallbackQuery({ text: "Giorno non trovato" });
      return;
    }
    await ctx.answerCallbackQuery({ text: `Invio i pin del Giorno ${dayN}...` });
    await sendDayVenues(ctx, day);
  });
}

async function runMap(ctx: any, dayN: number | undefined) {
  const session = await loadOrCreateSession(ctx.binding.user_id, ctx.from!.id);
  const it = session.itinerary;
  if (!it) {
    await ctx.reply("Nessun viaggio attivo. Usa /viaggi o creane uno.");
    return;
  }

  // Se chiede un giorno specifico, mappa di quel giorno; altrimenti tutto il trip
  let activities: any[];
  let title: string;
  if (dayN) {
    const day = it.days?.[dayN - 1];
    if (!day) {
      await ctx.reply(`Giorno ${dayN} non trovato.`);
      return;
    }
    activities = day.activities ?? [];
    title = `Giorno ${dayN}`;
  } else {
    activities = (it.days ?? []).flatMap((d: any) => d.activities ?? []);
    title = it.title ?? it.destination ?? "Viaggio";
  }

  const url = buildMapsRouteUrl(activities, it.destination ?? "");
  const kb = new InlineKeyboard().url("🗺 Apri in Google Maps", url);

  // Se l'utente ha salvato il trip sul sito, aggiungiamo link alla pagina interattiva
  // (ha mappa Waydora con tutti i pin + sidebar attivita').
  if (it.shareSlug || it.share_slug) {
    const slug = it.shareSlug ?? it.share_slug;
    kb.row().url("🌐 Mappa Waydora", `https://www.waydora.com/trip/${slug}`);
  }

  // Pin venue: utile per averli direttamente in chat Telegram (geolocalizzati)
  if (dayN) {
    kb.row().text("📍 Manda i pin in chat", `map:venues:${dayN}`);
  }

  await ctx.reply(
    `🗺 *Mappa — ${title}*\n` +
      `${activities.filter((a) => a.coordinates).length} tappe geolocalizzate`,
    { parse_mode: "Markdown", reply_markup: kb },
  );
}
