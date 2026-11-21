import type { APIRoute } from 'astro';
import { z } from 'zod';
import { rateLimit } from '../../lib/ratelimit';
import { clean, escapeHtml } from '../../lib/sanitize';
import { verifyTurnstile } from '../../lib/turnstile';
import { getSettings } from '../../lib/settings';
import { setting } from '../../lib/content';
import { dbConfigured, tx } from '../../lib/db';
import { sendMail } from '../../lib/mail';
import { fillText, paragraph } from '../../lib/email-template';
import { env, siteUrl } from '../../lib/env';
import { clientIp, ipHash, json } from '../../lib/http';
import { refuse } from '../../lib/spam';

export const POST: APIRoute = async ({ request, clientAddress }) => {
  const ip = clientIp(request, clientAddress);
  if (!rateLimit('contact:' + ip).ok) return json({ error: 'Too many requests. Try again in a few minutes.' }, 429);
  const fd = await request.formData();
  if (fd.get('website')) return json({ ok: true }); // honeypot: pretend success
  const refused = await refuse(ip); if (refused) return refused; // blocked sender, or over the daily limit
  if (!(await verifyTurnstile(fd.get('cf-turnstile-response') as string | null, ip)).ok) return json({ error: 'Spam check failed. Please try again.' }, 400);

  const { lists, stages } = await getSettings();
  const values = lists.situations.map((s) => s.value);
  const Schema = z.object({
    name: z.string().min(1).max(120), email: z.string().email().max(200), company: z.string().max(160), role: z.string().max(120),
    situation: z.string().refine((v) => values.includes(v)), message: z.string().max(4000),
  });
  const parsed = Schema.safeParse({ name: clean(fd.get('name'), 120), email: clean(fd.get('email'), 200), company: clean(fd.get('company'), 160), role: clean(fd.get('role'), 120), situation: clean(fd.get('situation'), 40), message: clean(fd.get('message'), 4000) });
  if (!parsed.success) return json({ error: 'Please check the required fields.' }, 400);
  const d = parsed.data; const situation = lists.situations.find((s) => s.value === d.situation)!.label;

  // Store it and route it, so nothing waits on a manual step: an SI partner goes to the partner tracker (the partner track
  // sits outside the sales process); everyone else gets a deal in the first stage, the same as the landing pages.
  let link = '/dashboard/inbox', linkText = 'Open the Lead inbox';
  let leadId: string | undefined;   // rides along on the Calendly booking that follows
  if (dbConfigured()) {
    try {
      await tx(async (c) => {
        const lead = (await c.query("insert into leads (page_slug, name, email, company, title, answers, source, ip_hash, user_agent) values (null, $1, $2, $3, $4, $5, 'contact', $6, $7) returning id",
          [d.name, d.email, d.company, d.role, JSON.stringify({ situation, ...(d.message ? { message: d.message } : {}) }), ipHash(ip), request.headers.get('user-agent')?.slice(0, 200) || null])).rows[0];
        leadId = lead.id;
        const contact = d.name + (d.role ? ', ' + d.role : '');
        if (d.situation === 'partner') {
          const known = (await c.query('select id from partners where lower(email) = lower($1) limit 1', [d.email])).rows[0];
          const partner = known || (await c.query('insert into partners (firm, contact, email, status, last_touch, notes) values ($1, $2, $3, 0, current_date, $4) returning id',
            [d.company || d.name, contact, d.email, ['From the contact form.', d.message].filter(Boolean).join(' ')])).rows[0];
          await c.query('update leads set partner_id = $1 where id = $2', [partner.id, lead.id]);
          link = '/dashboard/partners'; linkText = 'Open SI partners';
        } else {
          const deal = (await c.query("insert into deals (company, contact, lead_id, stage, source, next_step, next_due) values ($1, $2, $3, 0, 'Contact form', $4, current_date + 5) returning id",
            [d.company || d.name, contact, lead.id, stages[0].name + ' call'])).rows[0];
          await c.query('update leads set deal_id = $1 where id = $2', [deal.id, lead.id]);
          link = '/dashboard/deal?id=' + deal.id; linkText = 'Open the deal';
        }
      });
    } catch (e) { console.error('[contact] could not store lead', e); }
  }

  const site = await setting('site'); const to = env('CONTACT_TO_EMAIL', site.email);
  const rows = [['Name', d.name], ['Email', d.email], ['Company', d.company], ['Role', d.role], ['Situation', situation], ['Message', d.message]];
  try {
    await sendMail({ to, replyTo: d.email, category: 'contact-notify', subject: `Website inquiry — ${situation} — ${d.name}`,
      html: `<h2 style="font-family:Georgia,serif">New inquiry</h2><table cellpadding="6">${rows.map(([k, v]) => `<tr><td><b>${k}</b></td><td>${escapeHtml(v || '—').replace(/\n/g, '<br>')}</td></tr>`).join('')}</table><p><a href="${siteUrl()}${link}">${linkText}</a></p>` });
    const em = await setting('emails'); const c = em.contact || {};
    const vars = { name: d.name, first: d.name.split(' ')[0], window: site.responseWindow || 'two business days', site: site.name };
    await sendMail({ to: d.email, category: 'contact-ack', subject: fillText(c.subject, vars), html: paragraph(c.thanks, vars) + paragraph(c.faster, vars) + paragraph(em.signoff, vars) });
  } catch (e) { console.error('[contact] email failed', e); if (!dbConfigured()) return json({ error: 'Could not send right now.' }, 502); }
  return json({ ok: true, id: leadId });   // the id rides along on the Calendly booking that follows
};
