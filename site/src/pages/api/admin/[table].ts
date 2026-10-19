// Generic create / update / delete for the dashboard's simple tables. Every column is whitelisted and validated with zod.
import type { APIRoute } from 'astro';
import { z } from 'zod';
import { one, q } from '../../../lib/db';
import { json } from '../../../lib/http';

const str = (max = 300) => z.string().trim().max(max).transform((v) => v || null).nullable();
const date = z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal('').transform(() => null), z.null()]);
const month = z.union([z.string().regex(/^\d{4}-\d{2}$/).transform((v) => v + '-01'), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]);
const numOrNull = z.union([z.number(), z.string().trim().regex(/^-?\d+(\.\d+)?$/).transform(Number), z.literal('').transform(() => null), z.null()]);
const uuidOrNull = z.union([z.string().uuid(), z.literal('').transform(() => null), z.null()]);

const TABLES: Record<string, { cols: z.ZodRawShape; required?: string[]; stamp?: boolean }> = {
  deals: { cols: { company: str(160), contact: str(200), stage: z.coerce.number().int().min(0).max(4), offer: str(120), fee_estimate: numOrNull, go_live: str(60), source: str(60), partner_id: uuidOrNull, grid: z.union([z.enum(['nn', 'nd', 'ln', 'ld']), z.literal('').transform(() => null), z.null()]), next_step: str(200), next_due: date, bd_hours: z.coerce.number().min(0).max(10000), notes: str(5000) }, required: ['company'], stamp: true },
  partners: { cols: { firm: str(160), platform: str(80), contact: str(160), email: str(200), status: z.coerce.number().int().min(0).max(2), last_touch: date, next_step: str(200), notes: str(5000) }, required: ['firm'] },
  subscribers: { cols: { email: z.string().email().max(200), source: str(160), in_profile: z.enum(['in', 'out', 'unknown', 'partner']) }, required: ['email'] },
  content_items: { cols: { month, title: str(300), status: z.coerce.number().int().min(0).max(2), cuts: z.coerce.number().int().min(1).max(20), cuts_done: z.coerce.number().int().min(0).max(20), newsletter: str(200), url: str(500) }, required: ['month', 'title'] },
  activities: { cols: { deal_id: uuidOrNull, partner_id: uuidOrNull, kind: z.enum(['bd', 'bridge']).default('bd'), hours: z.coerce.number().min(0).max(200), note: str(300) }, required: ['hours'] },
  leads: { cols: {} },
};

const table = (t?: string) => (t && TABLES[t] ? t : null);
const clean = (t: string, body: unknown, partial: boolean) => {
  const shape = z.object(TABLES[t].cols); const s = partial ? shape.partial() : shape.partial().required(Object.fromEntries((TABLES[t].required || []).map((k) => [k, true])) as any);
  return s.strict().safeParse(body);
};

export const POST: APIRoute = async ({ params, request }) => {
  const t = table(params.table); if (!t || t === 'leads') return json({ error: 'No such table' }, 404);
  const parsed = clean(t, await request.json().catch(() => null), false);
  if (!parsed.success) return json({ error: 'Check the fields: ' + parsed.error.issues.map((i) => i.path.join('.')).join(', ') }, 400);
  const row = parsed.data as Record<string, unknown>; const keys = Object.keys(row);
  try {
    const r = await q(`insert into ${t} (${keys.join(', ')}) values (${keys.map((_, i) => '$' + (i + 1)).join(', ')}) returning *`, keys.map((k) => row[k]));
    return json(r[0]);
  } catch (e: any) { return json({ error: e.code === '23505' ? 'That already exists.' : 'Could not save.' }, 400); }
};

export const PATCH: APIRoute = async ({ params, request }) => {
  const t = table(params.table); if (!t || t === 'leads') return json({ error: 'No such table' }, 404);
  const { id, ...rest } = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  if (!z.string().uuid().safeParse(id).success) return json({ error: 'Missing id' }, 400);
  const parsed = clean(t, rest, true);
  if (!parsed.success) return json({ error: 'Check the fields: ' + parsed.error.issues.map((i) => i.path.join('.')).join(', ') }, 400);
  const row = parsed.data as Record<string, unknown>;
  if (t === 'partners' && 'status' in row && !('last_touch' in row)) row.last_touch = new Date().toISOString().slice(0, 10);   // advancing a partner counts as a touch
  if (t === 'deals' && 'bd_hours' in row) {   // log the extra hours so "BD hours this week" and the tripwire see them
    const prev = await one<{ bd_hours: string }>('select bd_hours from deals where id = $1', [id]);
    const delta = Number(row.bd_hours) - Number(prev?.bd_hours || 0);
    if (delta > 0) await q("insert into activities (deal_id, kind, hours, note) values ($1, 'bd', $2, 'From deal')", [id, delta]);
  }
  const keys = Object.keys(row); if (!keys.length) return json({ ok: true });
  const sets = keys.map((k, i) => `${k} = $${i + 2}`).concat(TABLES[t].stamp ? ['updated_at = now()'] : []);
  const r = await q(`update ${t} set ${sets.join(', ')} where id = $1 returning *`, [id, ...keys.map((k) => row[k])]);
  return r[0] ? json(r[0]) : json({ error: 'Not found' }, 404);
};

export const DELETE: APIRoute = async ({ params, request }) => {
  const t = table(params.table); if (!t) return json({ error: 'No such table' }, 404);
  const { id } = (await request.json().catch(() => ({}))) as { id?: string };
  if (!z.string().uuid().safeParse(id).success) return json({ error: 'Missing id' }, 400);
  await q(`delete from ${t} where id = $1`, [id]);
  return json({ ok: true });
};
