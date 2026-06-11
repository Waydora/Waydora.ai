import { createClient } from "@supabase/supabase-js";
 
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
 
if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Mancano le variabili VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY");
}
 
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
 
export type UserProfile = {
  id: string;
  email: string | undefined;
  name: string | undefined;
  avatar: string | undefined;
  tier: "free" | "paid";
};
 
export function toUserProfile(user: any): UserProfile {
  return {
    id: user.id,
    email: user.email,
    name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split("@")[0],
    avatar: user.user_metadata?.avatar_url || user.user_metadata?.picture,
    // tier impostato lato server (webhook Stripe → app_metadata.tier). Default free.
    tier: user.app_metadata?.tier === "paid" ? "paid" : "free",
  };
}
 