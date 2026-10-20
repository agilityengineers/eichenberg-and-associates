import type { APIRoute } from 'astro';
import { z } from 'zod';
import { rateLimit } from '../../lib/ratelimit';
import { clean } from '../../lib/sanitize';
import { dbConfigured, q } from '../../lib/db';
import { env } from '../../lib/env';
import { clientIp, json } from '../../lib/http';

export const POST: APIRoute = async ({ request, clientAddress }) => {
  const ip = clientIp(request, clientAddress);
  if (!rateLimit('nl:' + ip, 5).ok) return json({ error: 'Too many requests.' }, 429);
  const fd = await request.formData(); if (fd.get('website')) return json({ ok: true });
  const parsed = z.string().email().max(200).safeParse(clean(fd.get('email'), 200));
  if (!parsed.success) return json({ error: 'Enter a valid email.' }, 400);
  const email = parsed.data;
  // Subscribers list in the dashboard.
  if (dbConfigured()) await q("insert into subscribers (email, source) values ($1, 'Insights page') on conflict (lower(email)) do nothing", [email]).catch((e) => console.error('[newsletter] store', e.message));
  // Optional: also add to the email provider that sends the newsletter.
  const provider = env('NEWSLETTER_PROVIDER', 'none');
  try {
    if (provider === 'buttondown') {
      const r = await fetch('https://api.buttondown.email/v1/subscribers', { method: 'POST', headers: { Authorization: `Token ${env('BUTTONDOWN_API_KEY')}`, 'content-type': 'application/json' }, body: JSON.stringify({ email_address: email, tags: ['website'] }) });
      if (!r.ok && r.status !== 400) throw new Error('provider ' + r.status);
    } else if (provider === 'resend-audience') {
      const { Resend } = await import('resend');
      await new Resend(env('RESEND_API_KEY')).contacts.create({ email, audienceId: env('RESEND_AUDIENCE_ID') });
    }
  } catch (e) { console.error('[newsletter]', e); if (!dbConfigured()) return json({ error: 'Could not subscribe right now.' }, 502); }
  return json({ ok: true });
};
