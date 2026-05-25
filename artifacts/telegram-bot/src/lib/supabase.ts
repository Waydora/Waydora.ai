import { createClient } from "@supabase/supabase-js";
import { env } from "./env.js";

// Client service-role: bypassa RLS. Vive solo nel processo bot.
// Non logghiamo MAI la key. Non la esponiamo MAI a payload utente.
export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { params: { eventsPerSecond: 10 } },
});
