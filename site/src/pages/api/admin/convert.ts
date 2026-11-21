// Lead inbox → "Add to pipeline": opens a deal for the lead in the first stage of the sales process.
import type { APIRoute } from 'astro';
import { z } from 'zod';
import { tx } from '../../../lib/db';
import { json } from '../../../lib/http';
import { getSettings } from '../../../lib/settings';
export const POST: APIRoute = async ({ request }) => {
  const b = z.object({ id: z.string().uuid() }).safeParse(await request.json().catch(() => null));
  if (!b.success) return json({ error: 'Missing lead' }, 400);
  const first = (await getSettings()).stages[0].name;
  const deal = await tx(async (c) => {
    const l = (await c.query('select * from leads where id = $1 for update', [b.data.id])).rows[0];
    if (!l) return null; if (l.deal_id) return { id: l.deal_id };
    const d = (await c.query('insert into deals (company, contact, lead_id, stage, grid, source, next_step, next_due) values ($1, $2, $3, 0, $4, $5, $6, current_date + 5) returning id',
      [l.company || l.name, l.name + (l.title ? ', ' + l.title : ''), l.id, l.grid, l.source === 'contact' ? 'Contact form' : 'Content', first + ' call'])).rows[0];
    await c.query('update leads set deal_id = $1 where id = $2', [d.id, l.id]); return d;
  });
  return deal ? json({ ok: true, id: deal.id }) : json({ error: 'Lead not found' }, 404);
};
