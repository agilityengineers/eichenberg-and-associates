import { env } from './env';
export async function verifyTurnstile(token: string | null, ip: string | undefined) {
  const secret = env('TURNSTILE_SECRET_KEY');
  if (!secret) return { ok: true, skipped: true }; // not configured (local dev)
  if (!token) return { ok: false };
  const body = new URLSearchParams({ secret, response: token }); if (ip) body.set('remoteip', ip);
  try { const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body, signal: AbortSignal.timeout(8000) }); const j = await r.json(); return { ok: !!j.success }; }
  catch { return { ok: false }; }
}
