// Tracking "fatto" delle attivita' in-memory per (telegram_user_id, session_id).
// Persistenza non strettamente necessaria per M2; quando arriva il piano paid
// possiamo spostare in chat_sessions.itinerary stesso (campo .done[]).

const sets = new Map<string, Set<string>>();

function key(tgId: number, sessionId: string): string {
  return `${tgId}:${sessionId}`;
}

export function getDone(tgId: number, sessionId: string): Set<string> {
  const k = key(tgId, sessionId);
  let s = sets.get(k);
  if (!s) {
    s = new Set();
    sets.set(k, s);
  }
  return s;
}

export function toggleDone(tgId: number, sessionId: string, item: string): boolean {
  const s = getDone(tgId, sessionId);
  if (s.has(item)) {
    s.delete(item);
    return false;
  }
  s.add(item);
  return true;
}
