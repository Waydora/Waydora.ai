import type { Composer } from "grammy";
import type { BoundContext } from "../bot.js";
import { addReminder, listReminders, deleteReminder, parseWhen } from "../lib/reminders.js";

const HELP =
  "Uso: /reminder <quando> | <testo>\n" +
  "Esempi:\n" +
  "  /reminder tra 2h | Prenota cena\n" +
  "  /reminder domani 09:00 | Check-in hotel\n" +
  "  /reminder 2026-06-01 18:00 | Volo BCN";

export function registerReminders(bot: Composer<BoundContext>) {
  bot.command("reminder", async (ctx) => {
    const arg = (ctx.match ?? "").toString();
    const parts = arg.split("|").map((s) => s.trim());
    if (parts.length < 2 || !parts[0] || !parts[1]) {
      await ctx.reply(HELP);
      return;
    }
    const when = parseWhen(parts[0]);
    if (!when || when.getTime() < Date.now()) {
      await ctx.reply("Data non valida o nel passato.\n\n" + HELP);
      return;
    }
    await addReminder({
      telegram_user_id: ctx.from!.id,
      user_id: ctx.binding.user_id,
      fire_at: when,
      message: parts[1],
    });
    await ctx.reply(`⏰ Reminder fissato per ${when.toLocaleString("it-IT")}.`);
  });

  bot.command("reminders", async (ctx) => {
    const items = await listReminders(ctx.from!.id);
    if (items.length === 0) {
      await ctx.reply("Nessun reminder attivo.");
      return;
    }
    const lines = items.map(
      (r) => `#${r.id} — ${new Date(r.fire_at).toLocaleString("it-IT")}\n  ${r.message}`,
    );
    await ctx.reply(["⏰ Reminder attivi:", ...lines, "", "Cancella con /rmreminder <id>"].join("\n"));
  });

  bot.command("rmreminder", async (ctx) => {
    const id = Number((ctx.match ?? "").toString().trim());
    if (!Number.isFinite(id)) {
      await ctx.reply("Uso: /rmreminder <id>");
      return;
    }
    await deleteReminder(id, ctx.from!.id);
    await ctx.reply("Rimosso.");
  });

  bot.callbackQuery("rem:wizard", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.reply(HELP);
  });
}
