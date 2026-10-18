import type { APIRoute } from 'astro';
import { rateLimit } from '../../lib/ratelimit';
import { clean } from '../../lib/sanitize';
export const prerender = false;
const json = (d: unknown, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'content-type': 'application/json' } });

export const POST: APIRoute = async ({ request, clientAddress }) => {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || clientAddress;
  if (!rateLimit('nl:' + ip, 5).ok) return json({ error: 'Too many requests.' }, 429);
  const fd = await request.formData(); if (fd.get('website')) return json({ ok: true });
  const email = clean(fd.get('email'), 200);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: 'Enter a valid email.' }, 400);
  const provider = import.meta.env.NEWSLETTER_PROVIDER || 'none';
  try {
    if (provider === 'buttondown') {
      const r = await fetch('https://api.buttondown.email/v1/subscribers', { method: 'POST', headers: { Authorization: `Token ${import.meta.env.BUTTONDOWN_API_KEY}`, 'content-type': 'application/json' }, body: JSON.stringify({ email_address: email, tags: ['website'] }) });
      if (!r.ok && r.status !== 400) throw new Error('provider');
    } else if (provider === 'resend-audience') {
      const { Resend } = await import('resend'); const resend = new Resend(import.meta.env.RESEND_API_KEY);
      await resend.contacts.create({ email, audienceId: import.meta.env.RESEND_AUDIENCE_ID });
    } else { console.log('[newsletter] (no provider) subscribe:', email); }
  } catch (e) { console.error('[newsletter]', e); return json({ error: 'Could not subscribe right now.' }, 502); }
  return json({ ok: true });
};
