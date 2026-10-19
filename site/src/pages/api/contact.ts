import type { APIRoute } from 'astro';
import { z } from 'zod';
import { rateLimit } from '../../lib/ratelimit';
import { clean, escapeHtml } from '../../lib/sanitize';
import { verifyTurnstile } from '../../lib/turnstile';
import { getSettings } from '../../lib/settings';
import { setting } from '../../lib/content';
import { dbConfigured, q } from '../../lib/db';
import { sendMail } from '../../lib/mail';
import { env, siteUrl } from '../../lib/env';
import { clientIp, ipHash, json } from '../../lib/http';

export const POST: APIRoute = async ({ request, clientAddress }) => {
  const ip = clientIp(request, clientAddress);
  if (!rateLimit('contact:' + ip).ok) return json({ error: 'Too many requests. Try again in a few minutes.' }, 429);
  const fd = await request.formData();
  if (fd.get('website')) return json({ ok: true }); // honeypot: pretend success
  if (!(await verifyTurnstile(fd.get('cf-turnstile-response') as string | null, ip)).ok) return json({ error: 'Spam check failed. Please try again.' }, 400);

  const { lists } = await getSettings();
  const values = lists.situations.map((s) => s.value);
  const Schema = z.object({
    name: z.string().min(1).max(120), email: z.string().email().max(200), company: z.string().max(160), role: z.string().max(120),
    situation: z.string().refine((v) => values.includes(v)), message: z.string().max(4000),
  });
  const parsed = Schema.safeParse({ name: clean(fd.get('name'), 120), email: clean(fd.get('email'), 200), company: clean(fd.get('company'), 160), role: clean(fd.get('role'), 120), situation: clean(fd.get('situation'), 40), message: clean(fd.get('message'), 4000) });
  if (!parsed.success) return json({ error: 'Please check the required fields.' }, 400);
  const d = parsed.data; const situation = lists.situations.find((s) => s.value === d.situation)!.label;

  // Store it in the Lead inbox (not auto-added to the pipeline: contact-form leads are triaged by hand).
  if (dbConfigured()) {
    try { await q("insert into leads (page_slug, name, email, company, title, answers, source, ip_hash, user_agent) values (null, $1, $2, $3, $4, $5, 'contact', $6, $7)",
      [d.name, d.email, d.company, d.role, JSON.stringify({ situation, ...(d.message ? { message: d.message } : {}) }), ipHash(ip), request.headers.get('user-agent')?.slice(0, 200) || null]); }
    catch (e) { console.error('[contact] could not store lead', e); }
  }

  const site = await setting('site'); const to = env('CONTACT_TO_EMAIL', site.email);
  const rows = [['Name', d.name], ['Email', d.email], ['Company', d.company], ['Role', d.role], ['Situation', situation], ['Message', d.message]];
  try {
    await sendMail({ to, replyTo: d.email, subject: `Website inquiry — ${situation} — ${d.name}`,
      html: `<h2 style="font-family:Georgia,serif">New inquiry</h2><table cellpadding="6">${rows.map(([k, v]) => `<tr><td><b>${k}</b></td><td>${escapeHtml(v || '—').replace(/\n/g, '<br>')}</td></tr>`).join('')}</table><p><a href="${siteUrl()}/dashboard/inbox">Open the Lead inbox</a></p>` });
    await sendMail({ to: d.email, subject: `Thanks — ${site.name}`, html: `<p>Thanks, ${escapeHtml(d.name)}. We've got your note and will reply within ${escapeHtml(site.responseWindow || 'two business days')}.</p><p>If your go-live is inside 90 days, reply to this email and say so — we'll move faster.</p><p>— Jennifer Eichenberg</p>` });
  } catch (e) { console.error('[contact] email failed', e); if (!dbConfigured()) return json({ error: 'Could not send right now.' }, 502); }
  return json({ ok: true });
};
