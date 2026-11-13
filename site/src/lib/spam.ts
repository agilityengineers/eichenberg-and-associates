// Shared spam checks for the public form endpoints (contact, landing-page leads, newsletter).
// Everything here is stored in Postgres, so it holds across restarts and across Autoscale instances,
// unlike the in-memory limiter in ratelimit.ts.
import { dbConfigured, one, q } from './db';
import { env, isProd } from './env';
import { ipHash, json } from './http';

/** Submissions one address may store in 24 hours before the forms stop accepting more from it. */
export const DAILY_LIMIT = 5;

export const turnstileOn = () => !!env('PUBLIC_TURNSTILE_SITE_KEY') && !!env('TURNSTILE_SECRET_KEY');

let warned = false;
/** Returns a refusal Response when this sender is blocked or over the daily limit; null when the request may go on. */
export async function refuse(ip: string, table: 'leads' | 'none' = 'leads'): Promise<Response | null> {
  if (isProd() && !turnstileOn() && !warned) { warned = true; console.warn('[spam] Turnstile is not fully configured (PUBLIC_TURNSTILE_SITE_KEY + TURNSTILE_SECRET_KEY): the captcha is OFF.'); }
  if (!ip || !dbConfigured()) return null;
  const hash = ipHash(ip);
  try {
    if (await one('select 1 from blocked_senders where ip_hash = $1', [hash])) return json({ error: 'We could not accept this submission.' }, 403);
    if (table === 'leads') {
      const r = await one<{ n: number }>("select count(*)::int as n from leads where ip_hash = $1 and created_at > now() - interval '24 hours'", [hash]);
      if ((r?.n || 0) >= DAILY_LIMIT) return json({ error: 'Too many requests. Try again tomorrow.' }, 429);
    }
  } catch (e) { console.error('[spam] check failed', (e as Error).message); }   // never take the forms down over a failed lookup
  return null;
}

export const blockedSenders = () => q<{ ip_hash: string; note: string | null; created_at: Date }>('select ip_hash, note, created_at from blocked_senders order by created_at desc');
