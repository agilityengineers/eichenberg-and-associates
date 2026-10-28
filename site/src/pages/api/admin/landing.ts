import type { APIRoute } from 'astro';
import { z } from 'zod';
import { LANDING_FIELDS, docSchema } from '../../../lib/cms-schema';
import { q } from '../../../lib/db';
import { json } from '../../../lib/http';
export const PUT: APIRoute = async ({ request }) => {
  const b = z.object({ slug: z.string().max(60), data: z.unknown() }).safeParse(await request.json().catch(() => null));
  if (!b.success) return json({ error: 'Bad request' }, 400);
  const p = docSchema(LANDING_FIELDS).safeParse(b.data.data);
  if (!p.success) { const i = p.error.issues[0]; return json({ error: `Check “${i.path.join(' › ')}”: ${i.message}` }, 400); }
  const d = p.data as any;
  if (d.booking_url && !/^https:\/\//.test(d.booking_url)) return json({ error: 'The Calendly URL must start with https://' }, 400);
  if (d.hero_image && !/^(\/|https:\/\/)/.test(d.hero_image)) return json({ error: 'The hero image must be an upload or an https:// address' }, 400);
  const r = await q(`update landing_pages set eyebrow=$2, frame=$3, headline=$4, situation=$5, messages=$6, cta=$7, magnet_title=$8, magnet_url=$9, booking_url=$10, goals=$11, pains=$12, offer=$13, show_price=$14, published=$15, hero_image=$16, updated_at=now() where slug=$1 returning slug`,
    [b.data.slug, d.eyebrow, d.frame, d.headline, d.situation, JSON.stringify(d.messages), d.cta, d.magnet_title || null, d.magnet_url || null, d.booking_url || null, JSON.stringify(d.goals), JSON.stringify(d.pains), JSON.stringify(d.offer), !!d.show_price, !!d.published, d.hero_image || null]);
  return r[0] ? json({ ok: true }) : json({ error: 'Not found' }, 404);
};
