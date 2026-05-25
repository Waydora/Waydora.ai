import { supabase } from "./supabase.js";

// Unica funzione che decide se un user puo' usare il bot.
// Oggi: accetta tutti gli utenti loggati. Quando arrivera' il piano paid basta
// cambiare questa funzione (es. leggere da una tabella subscriptions).
//
// Ritorna il tier risolto ('free' | 'paid') oppure lancia errore "forbidden".

export type GateResult = { tier: "free" | "paid" };

const PAID_GATE_ENABLED = process.env.TELEGRAM_REQUIRE_PAID === "1";

export async function assertCanUseBot(userId: string): Promise<GateResult> {
  // Verifica che l'utente esista davvero (no JWT spoofing)
  const { data, error } = await supabase.auth.admin.getUserById(userId);
  if (error || !data?.user) throw new Error("forbidden: user not found");

  // Tier dal raw_app_meta_data (impostato lato server quando arrivera' Stripe/billing)
  const tier = ((data.user.app_metadata as any)?.tier as "free" | "paid" | undefined) ?? "free";

  if (PAID_GATE_ENABLED && tier !== "paid") {
    throw new Error("forbidden: paid plan required");
  }
  return { tier };
}

// Verifica JWT Supabase (Bearer) e restituisce user_id.
export async function userIdFromJwt(jwt: string): Promise<string> {
  const { data, error } = await supabase.auth.getUser(jwt);
  if (error || !data?.user) throw new Error("unauthorized");
  return data.user.id;
}
