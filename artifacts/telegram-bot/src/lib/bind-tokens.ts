import crypto from "node:crypto";
import { env } from "./env.js";

// Token di binding "one-shot" in-memory.
// Vivono 10 minuti. Restart del bot li invalida (accettabile: l'utente rigenera).
// Single-use: appena consumati vengono cancellati.

type Entry = { userId: string; expiresAt: number };
const store = new Map<string, Entry>();
const TTL_MS = 10 * 60 * 1000;

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of store) if (v.expiresAt < now) store.delete(k);
}, 60 * 1000).unref();

function sign(payload: string): string {
  return crypto.createHmac("sha256", env.TELEGRAM_BIND_TOKEN_SECRET).update(payload).digest("base64url");
}

export function issueBindToken(userId: string): string {
  const nonce = crypto.randomBytes(12).toString("base64url");
  const payload = `${userId}.${nonce}.${Date.now()}`;
  const token = `${Buffer.from(payload).toString("base64url")}.${sign(payload)}`;
  store.set(token, { userId, expiresAt: Date.now() + TTL_MS });
  return token;
}

export function consumeBindToken(token: string): string | null {
  const entry = store.get(token);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    store.delete(token);
    return null;
  }
  // Verifica HMAC (defense-in-depth: anche se il token e' in mappa, controlliamo firma)
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const payload = Buffer.from(parts[0], "base64url").toString();
  if (sign(payload) !== parts[1]) return null;

  store.delete(token); // single-use
  return entry.userId;
}
