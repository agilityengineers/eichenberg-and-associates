// Website content: save, create and delete documents. Signed-in users only (see middleware).
import type { APIRoute } from 'astro';
import { z } from 'zod';
import { DOCS, docSchema, blank, type DocType } from '../../../lib/cms-schema';
import { SINGLETON_COLLECTIONS, invalidate } from '../../../lib/content';
import { one, q } from '../../../lib/db';
import { json } from '../../../lib/http';

const slugRe = /^[a-z0-9][a-z0-9-]{0,79}$/;
const typeFor = (collection: string, slug: string): DocType | undefined => DOCS.find((d) => d.collection === collection && (d.entry ? true : d.slug === slug));

export const PUT: APIRoute = async ({ request }) => {
  const b = z.object({ collection: z.string(), slug: z.string(), newSlug: z.string().optional(), data: z.unknown(), body: z.string().max(200_000).optional() }).safeParse(await request.json().catch(() => null));
  if (!b.success) return json({ error: 'Bad request' }, 400);
  const { collection, slug } = b.data; const t = typeFor(collection, slug);
  if (!t) return json({ error: 'Unknown document' }, 404);
  const parsed = docSchema(t.fields).safeParse(b.data.data);
  if (!parsed.success) { const i = parsed.error.issues[0]; return json({ error: `Check “${i.path.join(' › ')}”: ${i.message}` }, 400); }
  let target = slug;
  if (t.entry && b.data.newSlug !== undefined && b.data.newSlug !== slug) {
    if (!t.entry.slugEditable) return json({ error: 'This address can’t be changed.' }, 400);
    if (!slugRe.test(b.data.newSlug)) return json({ error: 'Web address: lowercase letters, numbers and hyphens only.' }, 400);
    if (await one('select 1 from content where collection = $1 and slug = $2', [collection, b.data.newSlug])) return json({ error: 'That address is already used.' }, 400);
    target = b.data.newSlug;
  }
  const body = t.body ? b.data.body ?? '' : '';
  const r = await q(`insert into content (collection, slug, data, body, updated_at) values ($1, $2, $3, $4, now())
    on conflict (collection, slug) do update set data = excluded.data, body = excluded.body, updated_at = now() returning slug`, [collection, slug, JSON.stringify(parsed.data), body]);
  if (target !== slug) await q('update content set slug = $3 where collection = $1 and slug = $2', [collection, slug, target]);
  invalidate(collection);
  return json({ ok: true, slug: r[0].slug, ...(target !== slug ? { redirect: `/dashboard/website?c=${collection}&slug=${target}` } : {}) });
};

export const POST: APIRoute = async ({ request }) => {
  const b = z.object({ collection: z.string() }).safeParse(await request.json().catch(() => null));
  const t = b.success ? DOCS.find((d) => d.collection === b.data.collection && d.entry) : undefined;
  if (!t) return json({ error: 'Unknown collection' }, 404);
  const data: Record<string, any> = blank({ name: '', label: '', widget: 'object', fields: t.fields });
  const last = await one<{ n: number }>("select coalesce(max((data->>'order')::numeric), 0) as n from content where collection = $1 and data ? 'order'", [t.collection]);
  if ('order' in data) data.order = Number(last?.n || 0) + 1;
  if (t.collection === 'insights') Object.assign(data, { date: new Date().toISOString().slice(0, 10), tag: 'Readiness', author: 'Jennifer Eichenberg', draft: true });
  if (t.collection === 'custom-pages') data.blocks = [];
  data[t.entry!.titleKey] = 'Untitled ' + t.entry!.singular;
  const slug = `new-${t.entry!.singular.replace(/\W+/g, '-')}-${Date.now().toString(36)}`;
  await q('insert into content (collection, slug, data, body) values ($1, $2, $3, $4)', [t.collection, slug, JSON.stringify(data), '']);
  invalidate(t.collection);
  return json({ ok: true, redirect: `/dashboard/website?c=${t.collection}&slug=${slug}` });
};

export const DELETE: APIRoute = async ({ request }) => {
  const b = z.object({ collection: z.string(), slug: z.string() }).safeParse(await request.json().catch(() => null));
  if (!b.success || SINGLETON_COLLECTIONS.includes(b.data.collection) || !DOCS.some((d) => d.collection === b.data.collection && d.entry)) return json({ error: 'Not allowed' }, 400);
  await q('delete from content where collection = $1 and slug = $2', [b.data.collection, b.data.slug]);
  invalidate(b.data.collection);
  return json({ ok: true, redirect: `/dashboard/website?c=${b.data.collection}` });
};
