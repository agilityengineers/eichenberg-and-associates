// Form builder → Publish: replaces a landing page's step-2 questions in one transaction.
import type { APIRoute } from 'astro';
import { z } from 'zod';
import { one, tx } from '../../../lib/db';
import { json } from '../../../lib/http';
const Q = z.object({ key: z.string().regex(/^[a-z0-9_]{1,40}$/), label: z.string().trim().min(1).max(200), type: z.enum(['text', 'textarea', 'email', 'number', 'date', 'select', 'radio']), required: z.boolean(), options: z.array(z.string().trim().min(1).max(120)).max(30) });
export const PUT: APIRoute = async ({ request }) => {
  const b = z.object({ slug: z.string().max(60), questions: z.array(Q).max(30) }).safeParse(await request.json().catch(() => null));
  if (!b.success) { const i = b.error.issues[0]; return json({ error: `Check question ${Number(i.path[1]) + 1 || ''}: ${i.message}` }, 400); }
  const { slug, questions } = b.data;
  if (!(await one('select 1 from landing_pages where slug = $1', [slug]))) return json({ error: 'Unknown page' }, 404);
  const keys = new Set<string>();
  for (const x of questions) { if (keys.has(x.key)) return json({ error: `Two questions share the key “${x.key}”.` }, 400); keys.add(x.key); if ((x.type === 'select' || x.type === 'radio') && x.options.length < 2) return json({ error: `“${x.label}” needs at least two options.` }, 400); }
  const reserved = ['name', 'email', 'company', 'title', 'grid', 'page_slug', 'website'];
  if (questions.some((x) => reserved.includes(x.key))) return json({ error: 'Name, email, company and title are already asked in step 1.' }, 400);
  await tx(async (c) => {
    await c.query('delete from form_questions where page_slug = $1 and step = 2', [slug]);
    for (const [i, x] of questions.entries()) await c.query('insert into form_questions (page_slug, step, position, key, label, type, options, required) values ($1, 2, $2, $3, $4, $5, $6, $7)',
      [slug, i, x.key, x.label, x.type, x.type === 'select' || x.type === 'radio' ? JSON.stringify(x.options) : null, x.required]);
  });
  return json({ ok: true });
};
