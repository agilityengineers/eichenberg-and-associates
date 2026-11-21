// Settings → Calendly: connect the account, pull upcoming calls, disconnect, set the time zone for call times.
import type { APIRoute } from 'astro';
import { z } from 'zod';
import { connect, disconnect, setTimezone, syncUpcoming, validZone } from '../../../lib/calendly';
import { json } from '../../../lib/http';

const Body = z.discriminatedUnion('action', [
  z.object({ action: z.literal('connect') }), z.object({ action: z.literal('sync') }), z.object({ action: z.literal('disconnect') }),
  z.object({ action: z.literal('timezone'), timezone: z.string().trim().min(1).max(60) }),
]);
export const POST: APIRoute = async ({ request }) => {
  const b = Body.safeParse(await request.json().catch(() => null));
  if (!b.success) return json({ error: 'Bad request' }, 400);
  try {
    if (b.data.action === 'connect') { await connect(); const n = await syncUpcoming(); return json({ ok: true, message: `Connected. ${n} upcoming ${n === 1 ? 'call' : 'calls'} found.` }); }
    if (b.data.action === 'sync') { const n = await syncUpcoming(); return json({ ok: true, message: `${n} upcoming ${n === 1 ? 'call' : 'calls'} checked.` }); }
    if (b.data.action === 'disconnect') { await disconnect(); return json({ ok: true, message: 'Disconnected.' }); }
    if (!validZone(b.data.timezone)) return json({ error: 'That is not a time zone name. Use one like America/Chicago.' }, 400);
    await setTimezone(b.data.timezone); return json({ ok: true, message: 'Saved.' });
  } catch (e) { return json({ error: (e as Error).message || 'Calendly request failed.' }, 400); }
};
