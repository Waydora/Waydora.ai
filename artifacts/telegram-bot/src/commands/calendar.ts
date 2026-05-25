import type { Composer } from "grammy";
import { InputFile } from "grammy";
import type { BoundContext } from "../bot.js";
import { loadOrCreateSession } from "../lib/persistence.js";
import { buildIcs } from "../lib/calendar.js";

export function registerCalendar(bot: Composer<BoundContext>) {
  bot.command("calendario", run);
  bot.callbackQuery("cal:export", async (ctx) => {
    await ctx.answerCallbackQuery();
    await run(ctx);
  });

  async function run(ctx: any) {
    const session = await loadOrCreateSession(ctx.binding.user_id, ctx.from!.id);
    const it = session.itinerary;
    if (!it?.days?.length) {
      await ctx.reply("Nessun itinerario da esportare. Creane uno prima.");
      return;
    }
    const { value, error } = buildIcs({ trip: it });
    if (error || !value) {
      await ctx.reply("Errore generazione calendario.");
      return;
    }
    const buf = Buffer.from(value, "utf8");
    const name = `${(it.title ?? "waydora").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.ics`;
    await ctx.replyWithDocument(new InputFile(buf, name), {
      caption: "📆 Importalo in Google/Apple Calendar.",
    });
  }
}
