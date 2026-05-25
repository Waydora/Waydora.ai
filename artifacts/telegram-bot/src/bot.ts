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

// Context arricchito con il binding risolto (presente in tutti gli handler post-middleware tranne /start).
export type BoundContext = Context & { binding: Binding };

export const bot = new Bot<BoundContext>(env.TELEGRAM_BOT_TOKEN);

// ── /start: bind oppure saluto ────────────────────────────────────────────
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
        `✅ Collegato a Waydora (piano: ${tier}).\n\nProva /viaggi per vedere i tuoi viaggi.`,
      );
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      if (msg.includes("paid plan required")) {
        await ctx.reply("Il bot Telegram e' riservato al piano Waydora Pro. Aggiorna su waydora.com.");
      } else {
        await ctx.reply("Errore durante il collegamento. Riprova.");
      }
    }
    return;
  }

  const existing = await getBindingByTelegramId(tgId);
  if (existing) {
    await ctx.reply("Bentornato 👋\nProva /viaggi per i tuoi viaggi.");
  } else {
    await ctx.reply(
      "Ciao! Per usare Waydora su Telegram collega il tuo account:\n" +
        "1) apri https://www.waydora.com\n" +
        "2) accedi e clicca \"Collega Telegram\"",
    );
  }
});

// ── Middleware: richiedi binding per tutto il resto ──────────────────────
bot.use(async (ctx, next) => {
  // /start passa sopra (registrato prima, sopra il middleware → ctx.command gia' processato? no: i middleware
  // registrati DOPO bot.command sono comunque invocati. Distinguiamo con il testo.)
  const text = ctx.message?.text ?? ctx.callbackQuery?.data ?? "";
  if (text.startsWith("/start")) return;

  const tgId = ctx.from?.id;
  if (!tgId) return;

  if (!checkRate(tgId)) {
    await ctx.reply("Troppi messaggi, riprova fra un minuto.");
    return;
  }

  const binding = await getBindingByTelegramId(tgId);
  if (!binding) {
    await ctx.reply("Account non collegato. Apri waydora.com → \"Collega Telegram\".");
    return;
  }

  // Gate paid ad ogni messaggio (in caso il piano sia decaduto)
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

// ── Comandi business ─────────────────────────────────────────────────────
registerTripCommands(bot as any);

bot.command("scollega", async (ctx) => {
  await deleteBindingByTelegramId(ctx.from!.id);
  await ctx.reply("Account scollegato. Per riconnetterti vai su waydora.com.");
});

bot.command("help", async (ctx) => {
  await ctx.reply(
    [
      "Comandi:",
      "/viaggi — lista dei tuoi viaggi",
      "/viaggio — dettagli del viaggio selezionato",
      "/oggi — itinerario di oggi",
      "/giorno N — itinerario giorno N",
      "/scollega — rimuovi collegamento",
    ].join("\n"),
  );
});

bot.on("message:text", async (ctx) => {
  // Placeholder M4 (AI free-text). Per ora rispondiamo con guida.
  await ctx.reply("Capito! Per ora usa /help per la lista comandi. La chat AI arriva presto.");
});

export async function setupBotMenu() {
  await bot.api.setMyCommands([
    { command: "viaggi", description: "Lista dei tuoi viaggi" },
    { command: "viaggio", description: "Dettagli viaggio selezionato" },
    { command: "oggi", description: "Itinerario di oggi" },
    { command: "giorno", description: "Itinerario di un giorno specifico" },
    { command: "help", description: "Aiuto" },
    { command: "scollega", description: "Scollega account Waydora" },
  ]);
}
