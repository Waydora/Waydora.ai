import * as ics from "ics";

// Converte i giorni del trip in eventi .ics.
// L'AI restituisce time come "09:00-11:00" o "Pranzo 12:30-14:00".
// Senza una data base, il calendario parte da "oggi" (l'utente non ha sempre date assolute).
// Se l'itinerario ha un campo startDate (futuro), lo useremo.

const TIME_RX = /(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/;

export function buildIcs(opts: {
  trip: { title?: string | null; destination?: string | null; days: any[] };
  startDate?: Date;
}): { error?: any; value?: string } {
  const base = opts.startDate ?? new Date();
  const events: ics.EventAttributes[] = [];

  opts.trip.days?.forEach((day: any, dayIdx: number) => {
    const dayDate = new Date(base);
    dayDate.setDate(base.getDate() + dayIdx);
    for (const a of day?.activities ?? []) {
      const m = String(a?.time ?? "").match(TIME_RX);
      const sh = m ? Number(m[1]) : 9 + (a?.activities ? 0 : 0);
      const sm = m ? Number(m[2]) : 0;
      const eh = m ? Number(m[3]) : sh + 1;
      const em = m ? Number(m[4]) : sm;
      events.push({
        title: a?.title ?? "Attivita'",
        description: a?.description ?? "",
        location: opts.trip.destination ?? "",
        start: [dayDate.getFullYear(), dayDate.getMonth() + 1, dayDate.getDate(), sh, sm],
        end: [dayDate.getFullYear(), dayDate.getMonth() + 1, dayDate.getDate(), eh, em],
        geo: a?.coordinates
          ? { lat: Number(a.coordinates.lat), lon: Number(a.coordinates.lng) }
          : undefined,
        productId: "Waydora/TelegramBot",
      });
    }
  });

  return ics.createEvents(events) as any;
}
