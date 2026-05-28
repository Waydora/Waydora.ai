import type { Composer } from "grammy";
import { InputFile, InlineKeyboard } from "grammy";
import type { BoundContext } from "../bot.js";
import { loadOrCreateSession } from "../lib/persistence.js";
import { buildIcs } from "../lib/calendar.js";

// Costruisce un Google Calendar render URL per UN evento "viaggio" all-day
// che copre tutta la durata. Quick-add immediato; il .ics resta per i dettagli.
function buildGoogleCalRenderUrl(it: any): string | null {
  const days = Array.isArray(it?.days) ? it.days.length : 0;
  if (!days) return null;
  const start = new Date();
  const end = new Date();
  end.setDate(start.getDate() + days);
  const fmt = (d: Date) =>
    `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `🌐 ${it.title ?? "Viaggio Waydora"}`,
    dates: `${fmt(start)}/${fmt(end)}`,
    details: `Itinerario completo: importa il file .ics ricevuto su Telegram per tutti i dettagli giorno per giorno.${it.shareSlug ? `\n\nApri su Waydora: https://www.waydora.com/trip/${it.shareSlug}` : ""}`,
    location: it.destination ?? "",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

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

    const kb = new InlineKeyboard();
    const gcalUrl = buildGoogleCalRenderUrl(it);
    if (gcalUrl) kb.url("📅 Aggiungi a Google Calendar", gcalUrl).row();

    await ctx.replyWithDocument(new InputFile(buf, name), {
      caption: [
        "📆 *Il tuo itinerario in calendario*",
        "",
        "📱 *iPhone/iPad*: tocca il file qui sopra → \"Aggiungi tutto\" → Calendario.",
        "🤖 *Android*: tocca il file → apri con Google Calendar → Importa.",
        "💻 *Desktop*: scarica il file e importalo da Google Calendar → ⚙️ Impostazioni → Importa.",
        "",
        "Per un'aggiunta veloce, usa il bottone qui sotto 👇",
      ].join("\n"),
      parse_mode: "Markdown",
      reply_markup: kb,
    });
  }
}
