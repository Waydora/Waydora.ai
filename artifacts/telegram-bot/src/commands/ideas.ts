import type { Composer } from "grammy";
import type { BoundContext } from "../bot.js";
import { loadOrCreateSession } from "../lib/persistence.js";
import { addIdea, listIdeas, resolveIdeasSlug } from "../lib/ideas.js";

async function activeSlug(ctx: any): Promise<string> {
  const session = await loadOrCreateSession(ctx.binding.user_id, ctx.from!.id);
  const slug = (session.itinerary as any)?.shareSlug ?? null;
  return resolveIdeasSlug(ctx.binding.user_id, slug);
}

export function registerIdeas(bot: Composer<BoundContext>) {
  bot.command("idea", async (ctx) => {
    const text = (ctx.match ?? "").toString().trim();
    if (!text) {
      await ctx.reply("Uso: /idea <testo>. Es: /idea cena con vista al tramonto");
      return;
    }
    const slug = await activeSlug(ctx);
    await addIdea({ shareSlug: slug, text });
    const tied = slug.startsWith("tg-ideas-") ? "(salvata in idee personali)" : "(salvata nel viaggio attivo)";
    await ctx.reply(`💡 Idea salvata ${tied}. Vedi tutte con /idee.`);
  });

  bot.command("idee", async (ctx) => {
    const slug = await activeSlug(ctx);
    const items = await listIdeas(slug, 20);
    if (items.length === 0) {
      await ctx.reply("Nessuna idea salvata. Aggiungine una con /idea <testo>.");
      return;
    }
    const lines = items.map(
      (i, idx) => `${idx + 1}. ${i.text}  _(${new Date(i.created_at).toLocaleDateString("it-IT")})_`,
    );
    await ctx.reply(["💡 *Le tue idee*", ...lines].join("\n"), { parse_mode: "Markdown" });
  });

  bot.callbackQuery("ideas:list", async (ctx) => {
    const slug = await activeSlug(ctx);
    const items = await listIdeas(slug, 10);
    await ctx.answerCallbackQuery();
    if (items.length === 0) {
      await ctx.reply("Nessuna idea. Aggiungi con /idea <testo>.");
      return;
    }
    const lines = items.map((i, idx) => `${idx + 1}. ${i.text}`);
    await ctx.reply(["💡 Idee recenti:", ...lines].join("\n"));
  });
}
