const cache = new Map<string, string>();

export async function fetchPhoto(query: string): Promise<string> {
  const normalized = query.trim().toLowerCase();

  if (cache.has(normalized)) {
    return cache.get(normalized)!;
  }

  try {
    const response = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(
        normalized
      )}&per_page=1`,
      {
        headers: {
          Authorization: import.meta.env.VITE_PEXELS_API_KEY,
        },
      }
    );

    const data = await response.json();

    const photo =
      data.photos?.[0]?.src?.large ||
      "https://images.pexels.com/photos/346885/pexels-photo-346885.jpeg";

    cache.set(normalized, photo);

    return photo;
  } catch (err) {
    console.error("Errore immagini:", err);

    return "https://images.pexels.com/photos/346885/pexels-photo-346885.jpeg";
  }
}