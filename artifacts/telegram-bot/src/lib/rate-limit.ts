// Rate limit per telegram_user_id: 30 messaggi/min.
const buckets = new Map<number, { count: number; resetAt: number }>();
const WINDOW = 60 * 1000;
const MAX = 30;

export function checkRate(telegramUserId: number): boolean {
  const now = Date.now();
  const b = buckets.get(telegramUserId);
  if (!b || b.resetAt < now) {
    buckets.set(telegramUserId, { count: 1, resetAt: now + WINDOW });
    return true;
  }
  if (b.count >= MAX) return false;
  b.count += 1;
  return true;
}
