import cron from "node-cron";
import { supabase } from "./supabase.js";
import { bot } from "../bot.js";

// Loop di scheduling: ogni minuto carica reminder con fire_at <= now e sent_at null,
// li manda su Telegram, marca sent_at. Semplice, niente coda esterna.

export async function addReminder(opts: {
  telegram_user_id: number;
  user_id: string;
  trip_id?: string | null;
  fire_at: Date;
  message: string;
}): Promise<void> {
  const { error } = await supabase.from("telegram_reminders").insert({
    telegram_user_id: opts.telegram_user_id,
    user_id: opts.user_id,
    trip_id: opts.trip_id ?? null,
    fire_at: opts.fire_at.toISOString(),
    message: opts.message,
  });
  if (error) throw error;
}

export async function listReminders(telegramUserId: number) {
  const { data } = await supabase
    .from("telegram_reminders")
    .select("id,fire_at,message,sent_at")
    .eq("telegram_user_id", telegramUserId)
    .is("sent_at", null)
    .order("fire_at", { ascending: true })
    .limit(20);
  return (data as Array<{ id: number; fire_at: string; message: string; sent_at: string | null }>) ?? [];
}

export async function deleteReminder(id: number, telegramUserId: number): Promise<void> {
  await supabase.from("telegram_reminders").delete().eq("id", id).eq("telegram_user_id", telegramUserId);
}

async function tick() {
  const nowIso = new Date().toISOString();
  const { data } = await supabase
    .from("telegram_reminders")
    .select("id,telegram_user_id,message")
    .lte("fire_at", nowIso)
    .is("sent_at", null)
    .limit(50);
  const due = (data as Array<{ id: number; telegram_user_id: number; message: string }>) ?? [];
  for (const r of due) {
    try {
      await bot.api.sendMessage(r.telegram_user_id, `⏰ ${r.message}`);
      await supabase.from("telegram_reminders").update({ sent_at: new Date().toISOString() }).eq("id", r.id);
    } catch (e) {
      console.error("[reminders] send err", e);
    }
  }
}

export function startReminderLoop() {
  cron.schedule("* * * * *", () => {
    tick().catch((e) => console.error("[reminders] tick err", e));
  });
}

// "tra 2h", "tra 30m", "domani 18:00", "2026-06-01 09:00"
export function parseWhen(input: string): Date | null {
  const t = input.trim().toLowerCase();
  const rel = t.match(/^tra\s+(\d+)\s*(m|min|h|ore|ora)\b/);
  if (rel) {
    const n = Number(rel[1]);
    const isHours = /h|or/.test(rel[2]);
    return new Date(Date.now() + n * (isHours ? 3600_000 : 60_000));
  }
  const dom = t.match(/^domani\s+(\d{1,2}):(\d{2})/);
  if (dom) {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(Number(dom[1]), Number(dom[2]), 0, 0);
    return d;
  }
  const abs = t.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2})/);
  if (abs) {
    return new Date(Number(abs[1]), Number(abs[2]) - 1, Number(abs[3]), Number(abs[4]), Number(abs[5]));
  }
  return null;
}
