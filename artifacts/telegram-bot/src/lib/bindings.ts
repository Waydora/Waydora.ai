import { supabase } from "./supabase.js";

export type Binding = {
  telegram_user_id: number;
  user_id: string;
  telegram_username: string | null;
  language_code: string | null;
  tier: "free" | "paid";
};

// Cache LRU minimale telegram_user_id -> Binding. TTL 5 minuti.
const cache = new Map<number, { value: Binding; expiresAt: number }>();
const TTL = 5 * 60 * 1000;

export async function getBindingByTelegramId(telegramUserId: number): Promise<Binding | null> {
  const hit = cache.get(telegramUserId);
  if (hit && hit.expiresAt > Date.now()) return hit.value;

  const { data, error } = await supabase
    .from("telegram_bindings")
    .select("telegram_user_id,user_id,telegram_username,language_code,tier")
    .eq("telegram_user_id", telegramUserId)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    cache.delete(telegramUserId);
    return null;
  }
  const value = data as Binding;
  cache.set(telegramUserId, { value, expiresAt: Date.now() + TTL });
  return value;
}

export async function getBindingByUserId(userId: string): Promise<Binding | null> {
  const { data, error } = await supabase
    .from("telegram_bindings")
    .select("telegram_user_id,user_id,telegram_username,language_code,tier")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data as Binding) ?? null;
}

export async function upsertBinding(input: {
  telegram_user_id: number;
  user_id: string;
  telegram_username?: string | null;
  language_code?: string | null;
  tier: "free" | "paid";
}): Promise<void> {
  // Onorare unique(user_id): se l'utente aveva un altro Telegram, lo sganciamo prima.
  await supabase.from("telegram_bindings").delete().eq("user_id", input.user_id);
  const { error } = await supabase.from("telegram_bindings").upsert({
    telegram_user_id: input.telegram_user_id,
    user_id: input.user_id,
    telegram_username: input.telegram_username ?? null,
    language_code: input.language_code ?? null,
    tier: input.tier,
    last_seen_at: new Date().toISOString(),
  });
  if (error) throw error;
  cache.delete(input.telegram_user_id);
}

export async function deleteBindingByTelegramId(telegramUserId: number): Promise<void> {
  await supabase.from("telegram_bindings").delete().eq("telegram_user_id", telegramUserId);
  cache.delete(telegramUserId);
}

// Email dell'account Supabase legato (via Auth admin). Serve a far capire
// all'utente SU QUALE account il bot sta salvando i viaggi: se sul sito non li
// vede, quasi sempre e' loggato con un account diverso da quello collegato qui.
export async function getAccountEmail(userId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.auth.admin.getUserById(userId);
    if (error) return null;
    return data.user?.email ?? null;
  } catch {
    return null;
  }
}

export async function touchLastSeen(telegramUserId: number): Promise<void> {
  await supabase
    .from("telegram_bindings")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("telegram_user_id", telegramUserId);
}
