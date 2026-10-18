import type { APIRoute } from 'astro';
export const prerender = false;
const ALLOWED = ['landing_pages', 'form_questions', 'leads', 'deals', 'partners', 'activities', 'subscribers', 'content_items'];
const json = (d: unknown, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'content-type': 'application/json' } });
const tableOf = (t: string | undefined) => (t && ALLOWED.includes(t) ? t : null);
// Session client (locals.sb) runs under RLS: only the allow-listed admin can read/write.
export const GET: APIRoute = async ({ params, locals, url }) => { const table = tableOf(params.table); if (!table) return json({ error: 'No such table' }, 404);
  let q = locals.sb.from(table).select('*'); for (const [k, v] of url.searchParams) if (k !== 'order') q = q.eq(k, v); if (url.searchParams.get('order')) q = q.order(url.searchParams.get('order')!);
  const { data, error } = await q; return error ? json({ error: error.message }, 400) : json(data); };
export const POST: APIRoute = async ({ params, locals, request }) => { const table = tableOf(params.table); if (!table) return json({ error: 'No such table' }, 404);
  const body = await request.json(); const { data, error } = await locals.sb.from(table).upsert(body).select(); return error ? json({ error: error.message }, 400) : json(data); };
export const PATCH: APIRoute = async ({ params, locals, request }) => { const table = tableOf(params.table); if (!table) return json({ error: 'No such table' }, 404);
  const { id, slug, ...patch } = await request.json(); const col = table === 'landing_pages' ? 'slug' : 'id'; const val = String(table === 'landing_pages' ? slug : id);
  const row: Record<string, unknown> = { ...patch }; if (table !== 'form_questions' && table !== 'partners') row.updated_at = new Date().toISOString();
  const { data, error } = await locals.sb.from(table).update(row).eq(col, val).select(); return error ? json({ error: error.message }, 400) : json(data); };
export const DELETE: APIRoute = async ({ params, locals, request }) => { const table = tableOf(params.table); if (!table) return json({ error: 'No such table' }, 404);
  const { id } = await request.json(); if (table === 'form_questions') { const { data } = await locals.sb.from('form_questions').select('locked').eq('id', id).single(); if (data?.locked) return json({ error: 'Name and email are fixed.' }, 400); }
  const { error } = await locals.sb.from(table).delete().eq('id', id); return error ? json({ error: error.message }, 400) : json({ ok: true }); };
