import type { APIRoute } from 'astro';
import { z } from 'zod';
import { dbConfigured, one, q, tx } from '../../lib/db';
import { setting } from '../../lib/content';
import { rateLimit } from '../../lib/ratelimit';
import { clean, escapeHtml } from '../../lib/sanitize';
import { verifyTurnstile } from '../../lib/turnstile';
import { sendMail } from '../../lib/mail';
import { env, siteUrl } from '../../lib/env';
import { clientIp, ipHash, json } from '../../lib/http';

type Q = { key: string; label: string; type: string; required: boolean; options: string[] | null; step: number };

export const POST: APIRoute = async ({ request, clientAddress }) => {
  if (!dbConfigured()) return json({ error: 'Lead storage is not configured.' }, 503);
  const ip = clientIp(request, clientAddress);
  if (!rateLimit('lead:' + ip, 5).ok) return json({ error: 'Too many requests. Try again in a few minutes.' }, 429);
  const fd = await request.formData(); if (fd.get('website')) return json({ ok: true });
  if (!(await verifyTurnstile(fd.get('cf-turnstile-response') as string | null, ip)).ok) return json({ error: 'Spam check failed. Please try again.' }, 400);

  const slug = clean(fd.get('page_slug'), 60);
  const page = await one('select slug, eyebrow, magnet_title, magnet_url, booking_url from landing_pages where slug = $1 and published', [slug]);
  if (!page) return json({ error: 'Unknown page.' }, 400);
  const qs = await q<Q>('select key, label, type, required, options, step from form_questions where page_slug = $1 order by step, position', [slug]);
  const grid = await setting('grid'); const cell = (grid.cells || []).find((c: any) => c.id === fd.get('grid'));

  // Validate against the live question list, so the Form builder's "required" is enforced here too.
  const base = z.object({ name: z.string().min(1).max(120), email: z.string().email().max(200), company: z.string().max(160), title: z.string().max(120) });
  const parsed = base.safeParse({ name: clean(fd.get('name'), 120), email: clean(fd.get('email'), 200), company: clean(fd.get('company'), 160), title: clean(fd.get('title'), 120) });
  if (!parsed.success || !cell) return json({ error: 'Please check the required fields.' }, 400);
  const d = parsed.data;
  const missing: string[] = []; const answers: Record<string, string> = {};
  for (const x of qs) {
    const v = clean(fd.get(x.key), x.type === 'textarea' ? 4000 : 300);
    if (x.required && !v) missing.push(x.label);
    if (x.step === 1) continue;                                   // name/email/company/title are stored in their own columns
    if ((x.type === 'select' || x.type === 'radio') && v && !(x.options || []).includes(v)) return json({ error: 'Invalid option.' }, 400);
    if (x.type === 'email' && v && !z.string().email().safeParse(v).success) return json({ error: `Check “${x.label}”.` }, 400);
    if (v) answers[x.key] = v;
  }
  if (missing.length) return json({ error: 'Missing: ' + missing.join(', ') }, 400);

  // Every submission opens an Exploration-stage deal so nothing is lost before the first call.
  const leadId = await tx(async (c) => {
    const lead = (await c.query("insert into leads (page_slug, name, email, company, title, answers, grid, grid_result, source, ip_hash, user_agent) values ($1,$2,$3,$4,$5,$6,$7,$8,'landing',$9,$10) returning id",
      [slug, d.name, d.email, d.company, d.title, JSON.stringify(answers), cell.id, cell.result, ipHash(ip), request.headers.get('user-agent')?.slice(0, 200) || null])).rows[0];
    const deal = (await c.query("insert into deals (company, contact, lead_id, stage, grid, source, next_step, next_due) values ($1,$2,$3,0,$4,'Content','Exploration call', current_date + 5) returning id",
      [d.company || d.name, d.name + (d.title ? ', ' + d.title : ''), lead.id, cell.id])).rows[0];
    await c.query('update leads set deal_id = $1 where id = $2', [deal.id, lead.id]);
    if (page.magnet_title) await c.query("insert into subscribers (email, source) values ($1, $2) on conflict (lower(email)) do nothing", [d.email, page.magnet_title]);
    return lead.id as string;
  });

  const site = await setting('site'); const to = env('CONTACT_TO_EMAIL', site.email);
  const rows = [['Page', page.eyebrow], ['Name', d.name], ['Email', d.email], ['Company', d.company], ['Title', d.title], ['Grid', cell.result], ...Object.entries(answers).map(([k, v]) => [qs.find((x) => x.key === k)?.label || k, v])];
  try {
    await sendMail({ to, replyTo: d.email, subject: `New lead — ${page.eyebrow} — ${d.name}`, html: `<h2 style="font-family:Georgia,serif">${escapeHtml(cell.result)}</h2><table cellpadding="6">${rows.map(([k, v]) => `<tr><td><b>${escapeHtml(k)}</b></td><td>${escapeHtml(v || '—')}</td></tr>`).join('')}</table><p><a href="${siteUrl()}/dashboard/inbox">Open in the dashboard</a></p>` });
    await sendMail({ to: d.email, subject: `Thanks — ${site.name}`, html: `<p>Thanks, ${escapeHtml(d.name.split(' ')[0])}. We've got your answers and will reply within ${escapeHtml(site.responseWindow || 'two business days')}.</p>${page.magnet_url ? `<p>Here's <a href="${escapeHtml(page.magnet_url.startsWith('/') ? siteUrl() + page.magnet_url : page.magnet_url)}">${escapeHtml(page.magnet_title || 'the guide')}</a>.</p>` : ''}${page.booking_url ? `<p>Want to talk sooner? <a href="${escapeHtml(page.booking_url)}">Pick a time</a>.</p>` : ''}<p>— Jennifer Eichenberg</p>` });
  } catch (e) { console.error('[lead] email', e); }
  return json({ ok: true, id: leadId });
};
