/**
 * Rate limiter פשוט בזיכרון
 * מגביל כל IP ל-MAX_REQUESTS בקשות בתוך WINDOW_MS מילישניות
 */

const WINDOW_MS = 60 * 1000  // חלון של דקה
const MAX_REQUESTS = 300      // מקסימום 300 בקשות לדקה לכל IP

interface RateEntry {
  count: number
  resetAt: number
}

const store = new Map<string, RateEntry>()

// ניקוי entries ישנות כל 5 דקות
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store.entries()) {
    if (entry.resetAt < now) store.delete(key)
  }
}, 5 * 60 * 1000)

export function checkRateLimit(ip: string): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now()
  const entry = store.get(ip)

  if (!entry || entry.resetAt < now) {
    store.set(ip, { count: 1, resetAt: now + WINDOW_MS })
    return { allowed: true, remaining: MAX_REQUESTS - 1, resetAt: now + WINDOW_MS }
  }

  entry.count++
  const remaining = Math.max(0, MAX_REQUESTS - entry.count)
  return {
    allowed: entry.count <= MAX_REQUESTS,
    remaining,
    resetAt: entry.resetAt,
  }
}
