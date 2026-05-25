// Stato di sessione conversazionale in-memory per telegram_user_id.
// "Trip attivo" selezionato con /viaggi → usato da /viaggio /oggi /giorno ecc.

type Session = { activeTripId?: string };
const sessions = new Map<number, Session>();

export function getSession(telegramUserId: number): Session {
  let s = sessions.get(telegramUserId);
  if (!s) {
    s = {};
    sessions.set(telegramUserId, s);
  }
  return s;
}

export function setActiveTrip(telegramUserId: number, tripId: string): void {
  getSession(telegramUserId).activeTripId = tripId;
}

export function clearSession(telegramUserId: number): void {
  sessions.delete(telegramUserId);
}
