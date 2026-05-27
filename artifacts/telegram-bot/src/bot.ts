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
import { registerMap } from "./commands/map.js";
import { registerMedia } from "./commands/media.js";

export type BoundContext = Context & { binding: Binding };

export const bot = new Bot<BoundContext>(env.TELEGRAM_BOT_TOKEN);

// Logica di binding condivisa fra /start <token> e /bind <token>.
// Telegram Desktop a volte NON ripassa il parametro start se l'utente ha gia'
// la chat aperta col bot → forniamo /bind <token> come fallback manuale.
async function tryBind(ctx: any, token: string): Promise<void> {
  const tgId = ctx.from?.id;
  if (!tgId) return;
  const userId = consumeBindToken(token);
  if (!userId) {
    await ctx.reply("⚠️ Codice di collegamento non valido o scaduto. Generane uno nuovo da waydora.com.");
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
      console.error("[bind]", e);
      await ctx.reply("Errore durante il collegamento. Riprova.");
    }
  }
}

// ── /start: bind oppure saluto (PRIMA del middleware di binding) ──────────
bot.command("start", async (ctx) => {
  const tgId = ctx.from?.id;
  if (!tgId) return;
  const token = ctx.match?.trim();

  if (token) {
    await tryBind(ctx, token);
    return;
  }

  const existing = await getBindingByTelegramId(tgId);
  if (existing) {
    await ctx.reply("Bentornato 👋\nScrivimi dove vuoi andare oppure usa /help.");
  } else {
    await ctx.reply(
      "👋 Per collegare il tuo account Waydora:\n\n" +
        "1) Apri https://www.waydora.com (devi essere loggato)\n" +
        "2) Sidebar → clicca *Continua su Telegram*\n" +
        "3) Si apre Telegram automaticamente con un codice\n\n" +
        "Se Telegram non passa il codice automaticamente, copialo dal sito e incollalo qui come:\n" +
        "`/bind <codice>`",
      { parse_mode: "Markdown" },
    );
  }
});

// /bind <token>: fallback manuale quando Telegram non inoltra ?start=<token>
bot.command("bind", async (ctx) => {
  const token = (ctx.match ?? "").toString().trim();
  if (!token) {
    await ctx.reply("Uso: /bind <codice>. Genera il codice da waydora.com → \"Continua su Telegram\".");
    return;
  }
  await tryBind(ctx, token);
});

// ── Middleware: richiede binding per tutto il resto ──────────────────────
bot.use(async (ctx, next) => {
  const text = ctx.message?.text ?? ctx.callbackQuery?.data ?? "";
  if (text.startsWith("/start") || text.startsWith("/bind")) return; // gestiti sopra senza binding

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
registerMap(bot as any);
registerMedia(bot as any);

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
      "/mappa — mappa interattiva del viaggio",
      "/meteo [citta'] — previsioni",
      "/idea <testo> — salva idea",
      "/idee — lista idee",
      "/calendario — esporta .ics",
      "/reminder <quando> | <testo> — promemoria",
      "/reminders — lista reminder",
      "/nuovo — reset chat",
      "/bind <codice> — collega manualmente (fallback)",
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
    { command: "mappa", description: "Mappa interattiva" },
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
