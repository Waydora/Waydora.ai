import express from "express";
import { env } from "./lib/env.js";
import { bot, setupBotMenu } from "./bot.js";
import { issueBindToken } from "./lib/bind-tokens.js";
import { userIdFromJwt, assertCanUseBot } from "./lib/auth-gate.js";
import { verifyTelegramAuth, type TelegramAuthData } from "./lib/widget-verify.js";
import { upsertBinding } from "./lib/bindings.js";
import { startRealtimeBridge } from "./realtime.js";
import { startReminderLoop } from "./lib/reminders.js";

const app = express();
app.use(express.json({ limit: "1mb" }));

// ── CORS minimo per il frontend ───────────────────────────────────────────
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", env.WEB_ORIGIN);
  res.header("Access-Control-Allow-Headers", "authorization,content-type");
  res.header("Access-Control-Allow-Methods", "POST,GET,OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.get("/health", (_req, res) => res.json({ ok: true }));

// ── Webhook Telegram ──────────────────────────────────────────────────────
// Path con secret + header check (anti-spoofing).
//
// CRITICO: acknowledge a Telegram IMMEDIATAMENTE (200), poi processa async.
// Le chiamate AI possono durare 30-50s, ben oltre il timeout webhook 10s di
// grammY (e i ~10-30s di tolleranza di Telegram). Se non rispondiamo subito,
// Telegram ritrasmette in loop e il container crasha.
const webhookPath = `/telegram/webhook/${env.TELEGRAM_WEBHOOK_SECRET}`;
app.post(webhookPath, (req, res) => {
  const headerSecret = req.header("X-Telegram-Bot-Api-Secret-Token");
  if (headerSecret !== env.TELEGRAM_WEBHOOK_SECRET) {
    return res.sendStatus(401);
  }
  // Ack subito a Telegram
  res.sendStatus(200);
  // Processa l'update in background
  bot.handleUpdate(req.body).catch((e) => {
    console.error("[webhook handler]", e);
  });
});

// ── Bind token endpoint ──────────────────────────────────────────────────
// Frontend chiama POST /api/telegram/bind-token con Authorization: Bearer <supabase_jwt>
// Risposta: { url: "https://t.me/<bot>?start=<token>", expiresIn: 600 }
app.post("/api/telegram/bind-token", async (req, res) => {
  try {
    const auth = req.header("authorization") ?? "";
    const jwt = auth.replace(/^Bearer\s+/i, "");
    if (!jwt) return res.status(401).json({ error: "missing token" });

    const userId = await userIdFromJwt(jwt);
    await assertCanUseBot(userId); // gate paid centralizzato

    const token = issueBindToken(userId);
    res.json({
      url: `https://t.me/${env.PUBLIC_BOT_USERNAME}?start=${token}`,
      expiresIn: 600,
    });
  } catch (e: any) {
    const msg = String(e?.message ?? e);
    if (msg.includes("paid plan required")) {
      return res.status(402).json({ error: "paid_required" });
    }
    if (msg.includes("unauthorized") || msg.includes("forbidden")) {
      return res.status(401).json({ error: "unauthorized" });
    }
    console.error("[bind-token]", e);
    res.status(500).json({ error: "internal" });
  }
});

// ── Telegram Login Widget — REDIRECT mode (mobile-safe) ─────────────────
// Telegram chiama questo endpoint via redirect del browser dopo la conferma
// dell'utente. Niente JWT in header → identifichiamo l'utente col `state`
// (token in-memory generato da /api/telegram/bind-token).
app.get("/api/telegram/bind-callback", async (req, res) => {
  try {
    const state = String(req.query.state ?? "");
    const { consumeBindToken } = await import("./lib/bind-tokens.js");
    const userId = consumeBindToken(state);
    if (!userId) {
      return res.redirect(`${env.WEB_ORIGIN}/?telegram=expired`);
    }

    const data = {
      id: Number(req.query.id),
      first_name: req.query.first_name as string | undefined,
      last_name: req.query.last_name as string | undefined,
      username: req.query.username as string | undefined,
      photo_url: req.query.photo_url as string | undefined,
      auth_date: Number(req.query.auth_date),
      hash: String(req.query.hash ?? ""),
    };
    const v = verifyTelegramAuth(data);
    if (!v.ok) {
      console.warn("[bind-callback] verify failed:", v.reason);
      return res.redirect(`${env.WEB_ORIGIN}/?telegram=invalid`);
    }

    const { tier } = await assertCanUseBot(userId);
    await upsertBinding({
      telegram_user_id: data.id,
      user_id: userId,
      telegram_username: data.username ?? null,
      language_code: null,
      tier,
    });

    bot.api
      .sendMessage(
        data.id,
        `✅ Collegato a Waydora dal sito (piano: ${tier}).\n\nScrivimi dove vuoi andare. /help per i comandi.`,
      )
      .catch(() => {});

    res.redirect(`${env.WEB_ORIGIN}/?telegram=connected`);
  } catch (e: any) {
    console.error("[bind-callback]", e);
    res.redirect(`${env.WEB_ORIGIN}/?telegram=error`);
  }
});

// ── Telegram Login Widget — JS callback mode (legacy, fallback) ─────────
// Frontend: dopo che il widget mostra il popup di conferma Telegram, riceve
// i dati firmati e li manda qui. Verifichiamo la firma HMAC, controlliamo il
// JWT Supabase, applichiamo il gate paid e creiamo il binding. Zero /start.
app.post("/api/telegram/bind-from-widget", async (req, res) => {
  try {
    const auth = req.header("authorization") ?? "";
    const jwt = auth.replace(/^Bearer\s+/i, "");
    if (!jwt) return res.status(401).json({ error: "missing token" });

    const userId = await userIdFromJwt(jwt);
    const { tier } = await assertCanUseBot(userId);

    const data = req.body as TelegramAuthData;
    const v = verifyTelegramAuth(data);
    if (!v.ok) {
      console.warn("[widget-bind] verify failed:", v.reason);
      return res.status(400).json({ error: "invalid telegram signature" });
    }

    await upsertBinding({
      telegram_user_id: data.id,
      user_id: userId,
      telegram_username: data.username ?? null,
      language_code: null,
      tier,
    });

    // Manda saluto su Telegram (best-effort, non blocca la risposta)
    bot.api
      .sendMessage(
        data.id,
        `✅ Collegato a Waydora dal sito (piano: ${tier}).\n\nScrivimi dove vuoi andare, ti aiuto a costruire l'itinerario. /help per i comandi.`,
      )
      .catch((e) => console.warn("[widget-bind] greeting failed:", e?.description ?? e));

    res.json({ ok: true });
  } catch (e: any) {
    const msg = String(e?.message ?? e);
    if (msg.includes("paid plan required")) return res.status(402).json({ error: "paid_required" });
    if (msg.includes("unauthorized")) return res.status(401).json({ error: "unauthorized" });
    console.error("[widget-bind]", e);
    res.status(500).json({ error: "internal" });
  }
});

// ── Boot ─────────────────────────────────────────────────────────────────
async function main() {
  await setupBotMenu();

  const webhookUrl = `${env.PUBLIC_BOT_URL}${webhookPath}`;
  await bot.api.setWebhook(webhookUrl, {
    secret_token: env.TELEGRAM_WEBHOOK_SECRET,
    allowed_updates: ["message", "callback_query"],
  });
  console.log(`[bot] webhook set: ${webhookUrl}`);

  startRealtimeBridge();
  startReminderLoop();

  app.listen(env.PORT, () => {
    console.log(`[bot] listening on :${env.PORT}`);
  });
}

main().catch((e) => {
  console.error("[boot] fatal", e);
  process.exit(1);
});
