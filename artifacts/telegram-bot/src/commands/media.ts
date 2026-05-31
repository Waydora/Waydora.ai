import type { Composer } from "grammy";
import type { BoundContext } from "../bot.js";
import { loadOrCreateSession, shareSlugForSession, ensurePersonalContainer } from "../lib/persistence.js";
import { uploadTelegramMedia, recordMediaInTrip } from "../lib/media.js";
import type { Session } from "../lib/persistence.js";

// Risolve lo share_slug dove registrare il media:
// - con viaggio attivo → usa il suo shareSlug (padre saved_trips gia' is_public,
//   garantito da upsertSavedTripFromSession);
// - senza viaggio attivo → slug personale tg-<hash> della sessione. In quel caso
//   garantiamo (idempotente) un saved_trips padre is_public=true, altrimenti il
//   media finirebbe orfano e invisibile alla webapp (policy RLS trip_messages).
async function resolveMediaSlug(userId: string, session: Session): Promise<string> {
  const active = (session.itinerary as { shareSlug?: string } | null)?.shareSlug;
  if (active) return active;
  const slug = shareSlugForSession(session.id);
  await ensurePersonalContainer({
    userId,
    shareSlug: slug,
    title: "I miei media da Telegram",
  });
  return slug;
}

// Gestisce foto, video, documenti inviati al bot.
// L'utente deve avere un trip attivo (con shareSlug) altrimenti il media va
// in un contenitore "personale" della sessione (tg-<hash>).
export function registerMedia(bot: Composer<BoundContext>) {
  bot.on(":photo", async (ctx) => {
    const session = await loadOrCreateSession(ctx.binding.user_id, ctx.from!.id);
    const slug = await resolveMediaSlug(ctx.binding.user_id, session);

    // photo e' un array di taglie; prendiamo la piu' grande
    const photo = ctx.message!.photo!.at(-1)!;
    const file = await ctx.api.getFile(photo.file_id);
    if (!file.file_path) {
      await ctx.reply("Errore nel recupero del file.");
      return;
    }
    await ctx.replyWithChatAction("upload_photo");

    const uploaded = await uploadTelegramMedia({
      filePath: file.file_path,
      fileName: `photo-${photo.file_unique_id}.jpg`,
      shareSlug: slug,
    });
    if (!uploaded) {
      await ctx.reply("Upload fallito. Verifica che il bucket 'trip-media' esista su Supabase Storage con read pubblico.");
      return;
    }
    await recordMediaInTrip({
      shareSlug: slug,
      publicUrl: uploaded.publicUrl,
      mime: uploaded.mime,
      caption: ctx.message?.caption ?? undefined,
    });
    await ctx.reply("📸 Foto salvata nel viaggio. La vedi su waydora.com → Media.");
  });

  bot.on(":video", async (ctx) => {
    await handleFile(ctx, ctx.message!.video!, "video");
  });
  bot.on(":animation", async (ctx) => {
    await handleFile(ctx, ctx.message!.animation!, "gif");
  });
  bot.on(":document", async (ctx) => {
    const doc = ctx.message!.document!;
    // Limite ragionevole: 20MB
    if ((doc.file_size ?? 0) > 20 * 1024 * 1024) {
      await ctx.reply("Documento troppo grande (max 20MB).");
      return;
    }
    await handleFile(ctx, doc, doc.file_name ?? "document");
  });
}

async function handleFile(ctx: any, fileObj: { file_id: string; file_unique_id: string; mime_type?: string }, kindOrName: string) {
  const session = await loadOrCreateSession(ctx.binding.user_id, ctx.from!.id);
  const slug = await resolveMediaSlug(ctx.binding.user_id, session);

  const file = await ctx.api.getFile(fileObj.file_id);
  if (!file.file_path) {
    await ctx.reply("Errore nel recupero del file.");
    return;
  }
  await ctx.replyWithChatAction("upload_document");

  const ext = (fileObj.mime_type ?? "").split("/")[1]?.split(";")[0] ?? "bin";
  const fileName = `${kindOrName}-${fileObj.file_unique_id}.${ext}`;
  const uploaded = await uploadTelegramMedia({
    filePath: file.file_path,
    fileName,
    shareSlug: slug,
  });
  if (!uploaded) {
    await ctx.reply("Upload fallito. Verifica il bucket 'trip-media' su Supabase Storage.");
    return;
  }
  await recordMediaInTrip({
    shareSlug: slug,
    publicUrl: uploaded.publicUrl,
    mime: uploaded.mime,
    caption: ctx.message?.caption ?? undefined,
  });
  await ctx.reply("✅ File caricato nel viaggio.");
}
