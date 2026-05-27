import type { Composer } from "grammy";
import { InlineKeyboard } from "grammy";
import type { BoundContext } from "../bot.js";
import { callAI, type ChatMessage } from "../lib/chat-bridge.js";
import { loadOrCreateSession, saveSession, trimHistory } from "../lib/persistence.js";
import { summarizeItinerary, formatDay } from "../lib/format.js";
import { getDone } from "../lib/done-set.js";

export function registerChatAI(bot: Composer<BoundContext>) {
  // Catch-all per testo libero (ULTIMO da registrare nel bot principale).
  bot.on("message:text", async (ctx) => {
    const text = ctx.message.text;
    if (text.startsWith("/")) return; // comandi gestiti altrove

    const tgId = ctx.from!.id;
    const userId = ctx.binding.user_id;

    // Typing persistente: Telegram dimentica dopo ~5s, ripetiamo finche' arriva la risposta
    await ctx.replyWithChatAction("typing");
    const typingInterval = setInterval(() => {
      ctx.replyWithChatAction("typing").catch(() => {});
    }, 4000);

    const session = await loadOrCreateSession(userId, tgId);

    const userMsg: ChatMessage = { role: "user", content: text };
    const history = trimHistory([...session.api_messages, userMsg], 16);

    let resp;
    try {
      resp = await callAI({
        messages: history,
        existingItinerary: session.itinerary,
        userTier: ctx.binding.tier,
      });
    } catch (e: any) {
      clearInterval(typingInterval);
      const detail = String(e?.message ?? e);
      console.error("[chat-ai]", detail);
      // 502 dall'api-server = JSON malformato dall'AI (transitorio).
      // Suggeriamo retry invece di mostrare detail tecnico.
      if (detail.includes("502") || detail.includes("Risposta non valida")) {
        await ctx.reply("Non sono riuscito a costruire la risposta (errore temporaneo dell'AI). Riformula il messaggio piu' breve o riprova fra qualche secondo.");
      } else {
        await ctx.reply(`Errore AI: ${detail.slice(0, 200)}`);
      }
      return;
    }
    clearInterval(typingInterval);

    // Aggiorna sessione
    session.turns.push({ role: "user", content: text });
    session.turns.push({ role: "assistant", content: resp.reply });
    session.api_messages = [...history, { role: "assistant", content: resp.reply }];
    if (resp.itinerary) session.itinerary = resp.itinerary;
    await saveSession(session);

    // Reply
    await ctx.reply(resp.reply);

    if (resp.itinerary) {
      const it = resp.itinerary;
      await ctx.reply(summarizeItinerary(it), {
        parse_mode: "Markdown",
        reply_markup: buildItineraryKeyboard(it),
      });
    }
  });

  // Navigazione giorni
  bot.callbackQuery(/^day:(\d+)$/, async (ctx) => {
    const dayN = Number(ctx.match![1]);
    const tgId = ctx.from!.id;
    const session = await loadOrCreateSession(ctx.binding.user_id, tgId);
    const it = session.itinerary;
    const day = it?.days?.[dayN - 1];
    if (!day) {
      await ctx.answerCallbackQuery({ text: "Giorno non trovato" });
      return;
    }
    const done = getDone(tgId, session.id);
    await ctx.answerCallbackQuery();
    await ctx.reply(formatDay(day, dayN, done), {
      parse_mode: "Markdown",
      reply_markup: buildDayKeyboard(it, dayN),
    });
  });

  // Toggle "fatto" attivita'
  bot.callbackQuery(/^done:(\d+):(.+)$/, async (ctx) => {
    const dayN = Number(ctx.match![1]);
    const actTitle = ctx.match![2];
    const tgId = ctx.from!.id;
    const session = await loadOrCreateSession(ctx.binding.user_id, tgId);
    const done = getDone(tgId, session.id);
    const k = `${dayN}:${actTitle}`;
    const nowDone = done.has(k) ? (done.delete(k), false) : (done.add(k), true);
    await ctx.answerCallbackQuery({ text: nowDone ? "Segnato come fatto ✅" : "Rimosso" });
    const day = session.itinerary?.days?.[dayN - 1];
    if (day) {
      try {
        await ctx.editMessageText(formatDay(day, dayN, done), {
          parse_mode: "Markdown",
          reply_markup: buildDayKeyboard(session.itinerary, dayN),
        });
      } catch {}
    }
  });

  // Reset chat
  bot.command("nuovo", async (ctx) => {
    const tgId = ctx.from!.id;
    const { resetSession } = await import("../lib/persistence.js");
    await resetSession(ctx.binding.user_id, tgId);
    await ctx.reply("✨ Nuova conversazione. Dimmi dove vuoi andare!");
  });
}

export function buildItineraryKeyboard(it: any): InlineKeyboard {
  const kb = new InlineKeyboard();
  const days: any[] = Array.isArray(it?.days) ? it.days : [];
  for (let i = 0; i < days.length; i++) {
    kb.text(`G${i + 1}`, `day:${i + 1}`);
    if ((i + 1) % 4 === 0) kb.row();
  }
  kb.row();
  kb.text("☁️ Meteo", "weather:cur").text("💡 Idee", "ideas:list");
  kb.row();
  kb.text("📆 Calendario .ics", "cal:export").text("⏰ Reminder", "rem:wizard");
  return kb;
}

function buildDayKeyboard(it: any, dayN: number): InlineKeyboard {
  const kb = new InlineKeyboard();
  const day = it?.days?.[dayN - 1];
  const acts: any[] = Array.isArray(day?.activities) ? day.activities : [];
  for (const a of acts.slice(0, 6)) {
    const label = `✓ ${truncate(a.title, 22)}`;
    kb.text(label, `done:${dayN}:${a.title}`).row();
  }
  const total = it?.days?.length ?? 0;
  if (dayN > 1) kb.text("◀️ Prec", `day:${dayN - 1}`);
  if (dayN < total) kb.text("Succ ▶️", `day:${dayN + 1}`);
  kb.row();
  kb.text(`☁️ Meteo G${dayN}`, `weather:day:${dayN}`);
  return kb;
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + "…";
}
