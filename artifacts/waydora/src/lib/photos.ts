const cache = new Map<string, string>();

const FALLBACK_IMAGE =
  "https://images.pexels.com/photos/346885/pexels-photo-346885.jpeg";

export async function fetchPhoto(query: string): Promise<string> {
  const normalized = query.trim().toLowerCase();

  if (cache.has(normalized)) {
    return cache.get(normalized)!;
  }

  try {
    const apiKey = import.meta.env.VITE_PEXELS_API_KEY;

    if (!apiKey) {
      console.error("VITE_PEXELS_API_KEY non trovata");
      return FALLBACK_IMAGE;
    }

    const response = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(
        normalized
      )}&per_page=10&orientation=landscape`,
      {
        headers: {
          Authorization: apiKey,
        },
      }
    );

    if (!response.ok) {
      console.error("Errore Pexels:", response.status);
      return FALLBACK_IMAGE;
    }

    const data = await response.json();

    if (!data.photos || data.photos.length === 0) {
      return FALLBACK_IMAGE;
    }

    const randomIndex = Math.floor(Math.random() * data.photos.length);

    const selectedPhoto =
      data.photos[randomIndex]?.src?.large2x ||
      data.photos[randomIndex]?.src?.large ||
      FALLBACK_IMAGE;

    cache.set(normalized, selectedPhoto);

    return selectedPhoto;
  } catch (err) {
    console.error("Errore immagini:", err);

    return FALLBACK_IMAGE;
  }
}

// Compatibilità col resto del progetto
export async function pickPhoto(query: string): Promise<string> {
  return fetchPhoto(query);
}

export async function dayPhoto(
  destination: string,
  activity?: string
): Promise<string> {
  const search = activity
    ? `${destination} ${activity}`
    : destination;

  return fetchPhoto(search);
}

// Per eventuali componenti vecchi
export const PHOTO_POOL: string[] = [FALLBACK_IMAGE];