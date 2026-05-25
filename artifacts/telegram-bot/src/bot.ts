import { Bot, Context } from "grammy";
import { env } from "./lib/env.js";
import { consumeBindToken } from "./lib/bind-tokens.js";
import {
  getBindingByTelegramId,
  upsertBinding,
  deleteBindingByTelegramId,
  touchLastSeen,
  type Binding,
} from "./lib/bindings.js";
import { assertCanUseBot } from "./lib/auth-gate.js";
import { checkRate } from "./lib/rate-limit.js";
import { registerTripCommands } from "./commands/trips.js";
import { registerChatAI } from "./commands/chat-ai.js";
import { registerWeather } from "./commands/weather.js";
import { registerIdeas } from "./commands/ideas.js";
import { registerCalendar } from "./commands/calendar.js";
import { registerReminders } from "./commands/reminders.js";

export type BoundContext = Context & { binding: Binding };

export const bot = new Bot<BoundContext>(env.TELEGRAM_BOT_TOKEN);

// ── /start: bind oppure saluto (PRIMA del middleware di binding) ──────────
bot.command("start", async (ctx) => {
  const tgId = ctx.from?.id;
  if (!tgId) return;
  const token = ctx.match?.trim();

  if (token) {
    const userId = consumeBindToken(token);
    if (!userId) {
      await ctx.reply("⚠️ Link di collegamento non valido o scaduto. Generane uno nuovo su waydora.com.");
      return;
    }
    try {
      const { tier } = await assertCanUseBot(userId);
      await upsertBinding({
        telegram_user_id: tgId,
        user_id: userId,
        telegram_username: ctx.from?.username ?? null,
        language_code: ctx.from?.language_code ?? null,
        tier,
      });
      await ctx.reply(
        `✅ Collegato a Waydora (piano: ${tier}).\n\n` +
          `Scrivimi dove vuoi andare e ti aiuto a costruire l'itinerario.\n` +
          `Comandi: /viaggi /idea /idee /meteo /calendario /reminder /help`,
      );
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      if (msg.includes("paid plan required")) {
        await ctx.reply("Il bot Telegram e' riservato al piano Waydora Pro. Aggiorna su waydora.com.");
      } else {
        console.error("[start bind]", e);
        await ctx.reply("Errore durante il collegamento. Riprova.");
      }
    }
    return;
  }

  const existing = await getBindingByTelegramId(tgId);
  if (existing) {
    await ctx.reply("Bentornato 👋\nScrivimi dove vuoi andare oppure usa /help.");
  } else {
    await ctx.reply(
      "Ciao! Per usare Waydora su Telegram collega il tuo account:\n" +
        "1) apri https://www.waydora.com\n" +
        "2) accedi e clicca \"Continua su Telegram\" nella sidebar",
    );
  }
});

// ── Middleware: richiede binding per tutto il resto ──────────────────────
bot.use(async (ctx, next) => {
  const text = ctx.message?.text ?? ctx.callbackQuery?.data ?? "";
  if (text.startsWith("/start")) return; // gia' gestito sopra

  const tgId = ctx.from?.id;
  if (!tgId) return;

  if (!checkRate(tgId)) {
    await ctx.reply("Troppi messaggi, riprova fra un minuto.");
    return;
  }

  const binding = await getBindingByTelegramId(tgId);
  if (!binding) {
    await ctx.reply("Account non collegato. Apri waydora.com → \"Continua su Telegram\".");
    return;
  }

  try {
    await assertCanUseBot(binding.user_id);
  } catch (e: any) {
    if (String(e?.message ?? "").includes("paid plan required")) {
      await ctx.reply("Il piano Pro e' scaduto. Rinnova su waydora.com per continuare a usare il bot.");
      return;
    }
    throw e;
  }

  (ctx as BoundContext).binding = binding;
  touchLastSeen(tgId).catch(() => {});
  await next();
});

// ── Comandi business (ordine conta: AI catch-all per ultimo) ─────────────
registerTripCommands(bot as any);
registerWeather(bot as any);
registerIdeas(bot as any);
registerCalendar(bot as any);
registerReminders(bot as any);

bot.command("scollega", async (ctx) => {
  await deleteBindingByTelegramId(ctx.from!.id);
  await ctx.reply("Account scollegato. Per riconnetterti vai su waydora.com.");
});

bot.command("help", async (ctx) => {
  await ctx.reply(
    [
      "🗺 *Waydora bot*",
      "",
      "Scrivimi liberamente: capisco le tue richieste e costruisco l'itinerario.",
      "_Es. \"3 giorni a Lisbona con cibo locale\"_",
      "",
      "*Comandi*:",
      "/viaggi — i tuoi viaggi salvati",
      "/viaggio — viaggio selezionato",
      "/oggi /giorno N — itinerario per giorno",
      "/meteo [citta'] — previsioni",
      "/idea <testo> — salva idea",
      "/idee — lista idee",
      "/calendario — esporta .ics",
      "/reminder <quando> | <testo> — promemoria",
      "/reminders — lista reminder",
      "/nuovo — reset chat",
      "/scollega — rimuovi collegamento",
    ].join("\n"),
    { parse_mode: "Markdown" },
  );
});

// IMPORTANTE: chat-ai registra l'handler "message:text" catch-all → per ultimo
registerChatAI(bot as any);

export async function setupBotMenu() {
  await bot.api.setMyCommands([
    { command: "viaggi", description: "I tuoi viaggi" },
    { command: "viaggio", description: "Viaggio selezionato" },
    { command: "oggi", description: "Itinerario di oggi" },
    { command: "giorno", description: "Itinerario di un giorno" },
    { command: "meteo", description: "Previsioni meteo" },
    { command: "idea", description: "Salva un'idea" },
    { command: "idee", description: "Le tue idee" },
    { command: "calendario", description: "Esporta .ics" },
    { command: "reminder", description: "Crea reminder" },
    { command: "reminders", description: "Lista reminder" },
    { command: "nuovo", description: "Nuova conversazione" },
    { command: "help", description: "Aiuto" },
    { command: "scollega", description: "Scollega account" },
  ]);
}
