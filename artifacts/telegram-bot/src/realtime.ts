import { supabase } from "./lib/supabase.js";
import { getBindingByUserId } from "./lib/bindings.js";
import { bot } from "./bot.js";

// Sottoscrizione globale a user_trips e trip_messages.
// Per ogni evento risolviamo l'owner → binding → push Telegram.
// Filtriamo lato Node (non lato Postgres) per non dover tenere lista subscription per user.

export function startRealtimeBridge() {
  supabase
    .channel("tg-bridge-user-trips")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "user_trips" },
      async (payload) => {
        const row: any = payload.new ?? payload.old;
        if (!row?.user_id) return;
        const binding = await getBindingByUserId(row.user_id).catch(() => null);
        if (!binding) return;
        const title = row.title ?? row.destination ?? "viaggio";
        const event =
          payload.eventType === "INSERT"
            ? `🆕 Nuovo viaggio: *${title}*`
            : payload.eventType === "DELETE"
              ? `🗑 Viaggio rimosso: *${title}*`
              : `✏️ Aggiornato: *${title}*`;
        await bot.api
          .sendMessage(binding.telegram_user_id, event, { parse_mode: "Markdown" })
          .catch(() => {});
      },
    )
    .subscribe((status) => {
      if (status === "SUBSCRIBED") console.log("[realtime] user_trips OK");
    });

  supabase
    .channel("tg-bridge-trip-messages")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "trip_messages" },
      async (payload) => {
        const row: any = payload.new;
        if (!row?.share_slug) return;
        // share_slug -> trip -> owner. Lookup via saved_trips.
        const { data: saved } = await supabase
          .from("saved_trips")
          .select("user_id,title")
          .eq("share_slug", row.share_slug)
          .maybeSingle();
        if (!saved?.user_id) return;
        const binding = await getBindingByUserId(saved.user_id).catch(() => null);
        if (!binding) return;
        // Evita echo: i messaggi creati dal bot stesso hanno author='telegram'
        if (row.author === "telegram") return;
        // NON notificare le modifiche AI fatte dalla webapp: la chat "Modifica con
        // l'AI" dentro il viaggio salvato scrive righe ai_request (✨ richiesta utente)
        // e ai_update (risposta AI) in trip_messages. Sono azioni del proprietario
        // sul SUO viaggio, non messaggi dei compagni → rispedirgliele su Telegram è
        // solo rumore (vedi feedback utente). Il bridge notifica solo collaborazione
        // reale: messaggi dei compagni, idee e media.
        if (row.type === "ai_request" || row.type === "ai_update") return;
        const preview = String(row.text ?? "").slice(0, 200);
        const label =
          row.type === "idea" ? "💡 Idea" :
          row.type === "media" ? "📸 Media" :
          "💬 Messaggio";
        await bot.api
          .sendMessage(
            binding.telegram_user_id,
            `${label} su *${saved.title ?? "viaggio"}*:\n${preview}`,
            { parse_mode: "Markdown" },
          )
          .catch(() => {});
      },
    )
    .subscribe((status) => {
      if (status === "SUBSCRIBED") console.log("[realtime] trip_messages OK");
    });
}
