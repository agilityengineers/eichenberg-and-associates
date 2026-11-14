// Block or unblock a sender on the public forms. Senders are identified by the one-way hash of their IP address:
// either taken from a stored lead ("Block sender" in the Lead inbox) or computed from an address typed in Settings.
import type { APIRoute } from 'astro';
import { isIP } from 'node:net';
import { z } from 'zod';
import { one, q } from '../../../lib/db';
import { ipHash, json } from '../../../lib/http';

const Body = z.object({ leadId: z.string().uuid().optional(), ip: z.string().trim().max(60).optional(), note: z.string().trim().max(200).optional(), purge: z.boolean().optional() });

export const POST: APIRoute = async ({ request }) => {
  const b = Body.safeParse(await request.json().catch(() => null));
  if (!b.success || (!b.data.leadId && !b.data.ip)) return json({ error: 'Choose a submission or enter an IP address.' }, 400);
  let hash = ''; let note = b.data.note || '';
  if (b.data.leadId) {
    const lead = await one<{ ip_hash: string | null; name: string; email: string }>('select ip_hash, name, email from leads where id = $1', [b.data.leadId]);
    if (!lead) return json({ error: 'That submission no longer exists.' }, 404);
    if (!lead.ip_hash) return json({ error: 'No address was recorded with that submission, so it cannot be blocked.' }, 400);
    hash = lead.ip_hash; note ||= `${lead.name} <${lead.email}>`.slice(0, 200);
  } else {
    const ip = b.data.ip!;
    if (!isIP(ip)) return json({ error: 'That is not a valid IP address. Example: 203.0.113.25' }, 400);
    hash = ipHash(ip);
    // The address itself is not stored; keep just enough of it to recognise the entry later.
    note ||= 'Added by address ' + (ip.includes(':') ? ip.split(':').slice(0, 3).join(':') + ':…' : ip.split('.').slice(0, 2).join('.') + '.…');
  }
  await q('insert into blocked_senders (ip_hash, note) values ($1, $2) on conflict (ip_hash) do nothing', [hash, note]);
  // Optional clean-up: remove this sender's submissions that were never added to the pipeline.
  const removed = b.data.purge ? (await q('delete from leads where ip_hash = $1 and deal_id is null returning id', [hash])).length : 0;
  return json({ ok: true, removed });
};

export const DELETE: APIRoute = async ({ request }) => {
  const b = z.object({ ip_hash: z.string().regex(/^[a-f0-9]{32}$/) }).safeParse(await request.json().catch(() => null));
  if (!b.success) return json({ error: 'Bad request' }, 400);
  await q('delete from blocked_senders where ip_hash = $1', [b.data.ip_hash]);
  return json({ ok: true });
};
