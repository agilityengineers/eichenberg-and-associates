// Simple fixed-window limiter. Per serverless instance; good enough to blunt
// form abuse on a small firm site when combined with Turnstile. Swap for
// Upstash Redis (@upstash/ratelimit) if you need a shared limit across instances.
const hits = new Map<string, { n: number; reset: number }>();
export function rateLimit(key: string, limit = 5, windowMs = 10 * 60 * 1000) {
  const now = Date.now(); const h = hits.get(key);
  if (!h || h.reset < now) { hits.set(key, { n: 1, reset: now + windowMs }); return { ok: true, remaining: limit - 1 }; }
  h.n++; return { ok: h.n <= limit, remaining: Math.max(0, limit - h.n) };
}
