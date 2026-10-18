import type { APIRoute } from 'astro';
export const prerender = false;
const ALLOWED = ['landing_pages', 'form_questions', 'leads', 'deals', 'partners', 'activities', 'subscribers', 'content_items'];
const json = (d: unknown, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'content-type': 'application/json' } });
// Session client (locals.sb) runs under RLS: only the allow-listed admin can read/write.
export const GET: APIRoute = async ({ params, locals, url }) => { if (!ALLOWED.includes(params.table!)) return json({ error: 'No such table' }, 404);
  let q = (locals as any).sb.from(params.table).select('*'); for (const [k, v] of url.searchParams) if (k !== 'order') q = q.eq(k, v); if (url.searchParams.get('order')) q = q.order(url.searchParams.get('order')!);
  const { data, error } = await q; return error ? json({ error: error.message }, 400) : json(data); };
export const POST: APIRoute = async ({ params, locals, request }) => { if (!ALLOWED.includes(params.table!)) return json({ error: 'No such table' }, 404);
  const body = await request.json(); const { data, error } = await (locals as any).sb.from(params.table).upsert(body).select(); return error ? json({ error: error.message }, 400) : json(data); };
export const PATCH: APIRoute = async ({ params, locals, request }) => { if (!ALLOWED.includes(params.table!)) return json({ error: 'No such table' }, 404);
  const { id, slug, ...patch } = await request.json(); const key = params.table === 'landing_pages' ? ['slug', slug] : ['id', id];
  const { data, error } = await (locals as any).sb.from(params.table).update({ ...patch, ...(params.table !== 'form_questions' && params.table !== 'partners' ? { updated_at: new Date().toISOString() } : {}) }).eq(key[0], key[1]).select(); return error ? json({ error: error.message }, 400) : json(data); };
export const DELETE: APIRoute = async ({ params, locals, request }) => { if (!ALLOWED.includes(params.table!)) return json({ error: 'No such table' }, 404);
  const { id } = await request.json(); if (params.table === 'form_questions') { const { data } = await (locals as any).sb.from('form_questions').select('locked').eq('id', id).single(); if (data?.locked) return json({ error: 'Name and email are fixed.' }, 400); }
  const { error } = await (locals as any).sb.from(params.table).delete().eq('id', id); return error ? json({ error: error.message }, 400) : json({ ok: true }); };
