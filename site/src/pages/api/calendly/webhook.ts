// Calendly → dashboard. Calendly posts here when a call is booked or canceled. Every request must carry a valid
// signature made with CALENDLY_WEBHOOK_SIGNING_KEY; anything else is refused before the body is looked at.
import type { APIRoute } from 'astro';
import { z } from 'zod';
import { dbConfigured } from '../../../lib/db';
import { applyBooking, signingKey, verifySignature } from '../../../lib/calendly';
import { rateLimit } from '../../../lib/ratelimit';
import { clientIp, json } from '../../../lib/http';

const Body = z.object({ event: z.enum(['invitee.created', 'invitee.canceled']), payload: z.object({ uri: z.string().min(1).max(400) }).passthrough() }).passthrough();

export const POST: APIRoute = async ({ request, clientAddress }) => {
  if (!rateLimit('calendly:' + clientIp(request, clientAddress), 300, 10 * 60 * 1000).ok) return json({ error: 'Too many requests.' }, 429);
  if (!dbConfigured() || !signingKey()) return json({ error: 'Calendly sync is not set up.' }, 503);
  const raw = await request.text();
  if (raw.length > 200_000) return json({ error: 'Too large.' }, 413);
  if (!verifySignature(request.headers.get('calendly-webhook-signature'), raw)) return json({ error: 'Bad signature.' }, 401);
  let data: unknown; try { data = JSON.parse(raw); } catch { return json({ error: 'Bad request.' }, 400); }
  const parsed = Body.safeParse(data);
  if (!parsed.success) return json({ ok: true, ignored: true });   // an event type we don't use: acknowledge so Calendly doesn't retry
  try { const r = await applyBooking(parsed.data.event, parsed.data.payload); return json({ ok: r.ok }); }
  catch (e) { console.error('[calendly] webhook failed:', (e as Error).message); return json({ error: 'Could not record the booking.' }, 500); }   // 500 → Calendly retries
};
