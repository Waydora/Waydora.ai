import crypto from "node:crypto";
import { env } from "./env.js";

// Verifica Telegram Login Widget data:
// https://core.telegram.org/widgets/login#checking-authorization
//
// 1. data_check_string = sorted "k=v" joined by \n (esclude "hash")
// 2. secret_key = SHA256(bot_token)
// 3. hmac = HMAC_SHA256(data_check_string, secret_key) hex
// 4. confronta con campo hash
// 5. auth_date deve essere < 24h (sliding window per evitare replay)

export type TelegramAuthData = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
};

export function verifyTelegramAuth(data: TelegramAuthData): { ok: true } | { ok: false; reason: string } {
  if (!data.hash || !data.auth_date || !data.id) return { ok: false, reason: "missing fields" };

  const ageSec = Math.floor(Date.now() / 1000) - Number(data.auth_date);
  if (ageSec > 24 * 3600) return { ok: false, reason: "auth_date too old" };
  if (ageSec < -60) return { ok: false, reason: "auth_date in future" };

  const { hash, ...rest } = data;
  const dataCheckString = Object.keys(rest)
    .filter((k) => (rest as any)[k] !== undefined && (rest as any)[k] !== null)
    .sort()
    .map((k) => `${k}=${(rest as any)[k]}`)
    .join("\n");

  const secretKey = crypto.createHash("sha256").update(env.TELEGRAM_BOT_TOKEN).digest();
  const expected = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  if (expected !== hash) return { ok: false, reason: "bad hash" };
  return { ok: true };
}
