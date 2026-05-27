import { supabase } from "./supabase.js";
import { env } from "./env.js";

const BUCKET = "trip-media";

// Telegram bot getFile() ritorna file_path → URL pubblico:
//   https://api.telegram.org/file/bot<TOKEN>/<file_path>
async function downloadTelegramFile(filePath: string): Promise<{ data: Buffer; mime: string } | null> {
  const url = `https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${filePath}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const ab = await res.arrayBuffer();
  const mime = res.headers.get("content-type") ?? "application/octet-stream";
  return { data: Buffer.from(ab), mime };
}

// Upload su Supabase Storage. Bucket "trip-media" deve esistere (public read).
// Path: <shareSlug>/<timestamp>-<filename>.
export async function uploadTelegramMedia(opts: {
  filePath: string;
  fileName: string;
  shareSlug: string;
}): Promise<{ publicUrl: string; mime: string } | null> {
  const dl = await downloadTelegramFile(opts.filePath);
  if (!dl) return null;
  const objectPath = `${opts.shareSlug}/${Date.now()}-${opts.fileName}`;
  const { error } = await supabase.storage.from(BUCKET).upload(objectPath, dl.data, {
    contentType: dl.mime,
    upsert: false,
  });
  if (error) {
    console.error("[media] upload err", error);
    return null;
  }
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(objectPath);
  return { publicUrl: data.publicUrl, mime: dl.mime };
}

// Registra il media in trip_messages così appare nella sezione Media della webapp.
export async function recordMediaInTrip(opts: {
  shareSlug: string;
  publicUrl: string;
  mime: string;
  caption?: string;
}): Promise<void> {
  await supabase.from("trip_messages").insert({
    share_slug: opts.shareSlug,
    author: "telegram",
    type: "media",
    text: opts.caption ? `${opts.publicUrl}\n${opts.caption}` : opts.publicUrl,
  });
}
