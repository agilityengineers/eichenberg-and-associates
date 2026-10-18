import type { APIRoute } from 'astro';
import { z } from 'zod';
import { Resend } from 'resend';
import { rateLimit } from '../../lib/ratelimit';
import { clean, escapeHtml } from '../../lib/sanitize';
import { verifyTurnstile } from '../../lib/turnstile';
export const prerender = false;

const Schema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email().max(200),
  company: z.string().max(160).optional().default(''),
  role: z.string().max(120).optional().default(''),
  situation: z.enum(['funded', '90days', 'portfolio', 'merger', 'partner', 'other']),
  message: z.string().max(4000).optional().default(''),
});
const SITUATION: Record<string, string> = { funded: 'Program funded, SI selected, go-live 6–12 months out', '90days': 'Go-live within 90 days and cracks are showing', portfolio: 'Several go-lives at once', merger: 'Deal closed; integration lead named', partner: 'SI partner with a won deal', other: 'Something else' };
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

export const POST: APIRoute = async ({ request, clientAddress }) => {
  const ip = request.headers.get('x-nf-client-connection-ip') || request.headers.get('x-forwarded-for')?.split(',')[0] || clientAddress;
  if (!rateLimit('contact:' + ip).ok) return json({ error: 'Too many requests. Try again in a few minutes.' }, 429);

  const fd = await request.formData();
  if (fd.get('website')) return json({ ok: true }); // honeypot: pretend success
  const ts = await verifyTurnstile(fd.get('cf-turnstile-response') as string | null, ip);
  if (!ts.ok) return json({ error: 'Spam check failed. Please try again.' }, 400);

  const parsed = Schema.safeParse({ name: clean(fd.get('name'), 120), email: clean(fd.get('email'), 200), company: clean(fd.get('company'), 160), role: clean(fd.get('role'), 120), situation: fd.get('situation'), message: clean(fd.get('message'), 4000) });
  if (!parsed.success) return json({ error: 'Please check the required fields.' }, 400);
  const d = parsed.data;

  const to = import.meta.env.CONTACT_TO_EMAIL; const from = import.meta.env.CONTACT_FROM_EMAIL; const key = import.meta.env.RESEND_API_KEY;
  const subject = `Website inquiry — ${SITUATION[d.situation]} — ${d.name}`;
  const rows = [['Name', d.name], ['Email', d.email], ['Company', d.company], ['Role', d.role], ['Situation', SITUATION[d.situation]], ['Message', d.message]];
  const html = `<h2 style="font-family:Georgia,serif">New inquiry</h2><table cellpadding="6">${rows.map(([k, v]) => `<tr><td><b>${k}</b></td><td>${escapeHtml(v || '—').replace(/\n/g, '<br>')}</td></tr>`).join('')}</table>`;

  if (key && to && from) {
    try {
      const resend = new Resend(key);
      await resend.emails.send({ from, to, replyTo: d.email, subject, html });
      // Acknowledgement to the sender (plain, no marketing)
      await resend.emails.send({ from, to: d.email, subject: 'Thanks — Eichenberg & Associates', html: `<p>Thanks, ${escapeHtml(d.name)}. We've got your note and will reply within two business days.</p><p>If your go-live is inside 90 days, reply to this email and say so — we'll move faster.</p><p>— Jennifer Eichenberg</p>` });
    } catch (e) { console.error('[contact] email failed', e); return json({ error: 'Could not send right now.' }, 502); }
  } else {
    console.log('[contact] (email not configured) submission:', JSON.stringify(d)); // visible in function logs
  }
  return json({ ok: true });
};
