const cache = new Map<string, string>();

const FALLBACK_IMAGE =
  "https://images.pexels.com/photos/346885/pexels-photo-346885.jpeg";

export async function fetchPhoto(query: string): Promise<string> {
  const normalized = query.trim().toLowerCase();

  // Cache
  if (cache.has(normalized)) {
    return cache.get(normalized)!;
  }

  try {
    const apiKey = import.meta.env.VITE_PEXELS_API_KEY;

    // Se manca la key
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

    // Se Pexels risponde con errore
    if (!response.ok) {
      console.error("Errore Pexels:", response.status);
      return FALLBACK_IMAGE;
    }

    const data = await response.json();

    // Nessuna foto trovata
    if (!data.photos || data.photos.length === 0) {
      return FALLBACK_IMAGE;
    }

    // Foto casuale tra le prime 10
    const randomIndex = Math.floor(Math.random() * data.photos.length);

    const selectedPhoto =
      data.photos[randomIndex]?.src?.large2x ||
      data.photos[randomIndex]?.src?.large ||
      FALLBACK_IMAGE;

    // Salva in cache
    cache.set(normalized, selectedPhoto);

    return selectedPhoto;
  } catch (err) {
    console.error("Errore immagini:", err);

    return FALLBACK_IMAGE;
  }
}