// Lead inbox: correct a submission's contact details, or delete submissions (one, or several for spam clean-up).
// Deals already opened from a submission stay in the pipeline; they just lose the link back to it.
import type { APIRoute } from 'astro';
import { z } from 'zod';
import { one, q } from '../../../lib/db';
import { json } from '../../../lib/http';

const blank = (max: number) => z.string().trim().max(max).transform((v) => v || null).nullable();
// Only the contact details: the visitor's answers stay exactly as submitted.
const Edit = z.object({ id: z.string().uuid(), name: z.string().trim().min(1).max(120), email: z.string().trim().email().max(200), company: blank(160), title: blank(120) }).strict();
const contactOf = (l: { name: string; title: string | null }) => l.name + (l.title ? ', ' + l.title : '');

export const PATCH: APIRoute = async ({ request }) => {
  const b = Edit.safeParse(await request.json().catch(() => null));
  if (!b.success) { const f = b.error.issues[0]?.path[0]; return json({ error: f === 'email' ? 'Enter a valid email address.' : f === 'name' ? 'Add a name.' : 'Check the fields.' }, 400); }
  const d = b.data;
  const was = await one('select * from leads where id = $1', [d.id]); if (!was) return json({ error: 'Not found' }, 404);
  const now = (await q('update leads set name = $2, email = $3, company = $4, title = $5 where id = $1 returning *', [d.id, d.name, d.email, d.company, d.title]))[0];
  // The deal or partner made from this submission follows, but only where it still holds the old value, so anything
  // already edited there is left alone.
  if (now.deal_id) {
    await q('update deals set company = $2, updated_at = now() where id = $1 and company = $3', [now.deal_id, now.company || now.name, was.company || was.name]);
    await q('update deals set contact = $2, updated_at = now() where id = $1 and contact = $3', [now.deal_id, contactOf(now), contactOf(was)]);
  }
  if (now.partner_id) {
    await q('update partners set firm = $2 where id = $1 and firm = $3', [now.partner_id, now.company || now.name, was.company || was.name]);
    await q('update partners set contact = $2 where id = $1 and contact = $3', [now.partner_id, contactOf(now), contactOf(was)]);
    await q('update partners set email = $2 where id = $1 and lower(email) = lower($3)', [now.partner_id, now.email, was.email]);
  }
  return json({ ok: true });
};

export const DELETE: APIRoute = async ({ request }) => {
  const b = z.union([z.object({ ids: z.array(z.string().uuid()).min(1).max(500) }), z.object({ id: z.string().uuid() }).transform((x) => ({ ids: [x.id] }))]).safeParse(await request.json().catch(() => null));
  if (!b.success) return json({ error: 'Select at least one submission.' }, 400);
  const removed = await q('delete from leads where id = any($1::uuid[]) returning id', [b.data.ids]);
  return json({ ok: true, removed: removed.length });
};
