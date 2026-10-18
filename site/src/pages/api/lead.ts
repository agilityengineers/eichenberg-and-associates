import type { APIRoute } from 'astro';
import { z } from 'zod';
import { Resend } from 'resend';
import { adminDb, publicDb } from '../../lib/supabase';
import { rateLimit } from '../../lib/ratelimit';
import { clean, escapeHtml } from '../../lib/sanitize';
import { verifyTurnstile } from '../../lib/turnstile';
export const prerender = false;
const json = (d: unknown, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'content-type': 'application/json' } });
const sha = async (s: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))).map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);

export const POST: APIRoute = async ({ request, clientAddress }) => {
  const ip = request.headers.get('x-nf-client-connection-ip') || request.headers.get('x-forwarded-for')?.split(',')[0] || clientAddress;
  if (!rateLimit('lead:' + ip, 5).ok) return json({ error: 'Too many requests. Try again in a few minutes.' }, 429);
  const fd = await request.formData(); if (fd.get('website')) return json({ ok: true });
  if (!(await verifyTurnstile(fd.get('cf-turnstile-response') as string | null, ip)).ok) return json({ error: 'Spam check failed. Please try again.' }, 400);

  const slug = clean(fd.get('page_slug'), 60);
  const { data: page } = await publicDb().from('landing_pages').select('slug,eyebrow,magnet_title,magnet_url,booking_url').eq('slug', slug).eq('published', true).maybeSingle();
  if (!page) return json({ error: 'Unknown page.' }, 400);
  const { data: qs } = await publicDb().from('form_questions').select('key,label,type,required,options,step').eq('page_slug', slug);

  // Validate against the live question schema, so admin edits are enforced server-side too.
  const base = z.object({ name: z.string().min(1).max(120), email: z.string().email().max(200), company: z.string().max(160).optional().default(''), title: z.string().max(120).optional().default(''), grid: z.enum(['nn', 'nd', 'ln', 'ld']), grid_result: z.string().max(80) });
  const parsed = base.safeParse({ name: clean(fd.get('name'), 120), email: clean(fd.get('email'), 200), company: clean(fd.get('company'), 160), title: clean(fd.get('title'), 120), grid: fd.get('grid'), grid_result: clean(fd.get('grid_result'), 80) });
  if (!parsed.success) return json({ error: 'Please check the required fields.' }, 400);
  const answers: Record<string, string> = {}; const missing: string[] = [];
  for (const q of (qs || []).filter((q) => q.step === 2)) { const v = clean(fd.get(q.key), q.type === 'textarea' ? 4000 : 300); if (q.required && !v) missing.push(q.label); if ((q.type === 'select' || q.type === 'radio') && v && !(q.options || []).includes(v)) return json({ error: 'Invalid option.' }, 400); if (v) answers[q.key] = v; }
  if (missing.length) return json({ error: 'Missing: ' + missing.join(', ') }, 400);
  const d = parsed.data;

  const db = adminDb();
  const { data: lead, error } = await db.from('leads').insert({ page_slug: slug, name: d.name, email: d.email, company: d.company, title: d.title, answers, grid: d.grid, grid_result: d.grid_result, source: 'landing', ip_hash: await sha(ip || ''), user_agent: request.headers.get('user-agent')?.slice(0, 200) }).select('id').single();
  if (error) { console.error('[lead]', error); return json({ error: 'Could not save right now.' }, 502); }
  // Every submission opens an Exploration-stage deal so nothing is lost before the first call.
  const { data: deal } = await db.from('deals').insert({ company: d.company || d.name, contact: `${d.name}${d.title ? ', ' + d.title : ''}`, lead_id: lead.id, stage: 'Exploration', grid: d.grid, source: 'Content', next_step: 'Exploration call', next_due: new Date(Date.now() + 5 * 864e5).toISOString().slice(0, 10) }).select('id').single();
  if (deal) await db.from('leads').update({ deal_id: deal.id }).eq('id', lead.id);
  if (page.magnet_title) await db.from('subscribers').upsert({ email: d.email, source: page.magnet_title, in_profile: 'unknown' }, { onConflict: 'email', ignoreDuplicates: true });

  const key = import.meta.env.RESEND_API_KEY, to = import.meta.env.CONTACT_TO_EMAIL, from = import.meta.env.CONTACT_FROM_EMAIL;
  if (key && to && from) { try { const resend = new Resend(key);
    const rows = [['Page', page.eyebrow], ['Name', d.name], ['Email', d.email], ['Company', d.company], ['Title', d.title], ['Grid', d.grid_result], ...Object.entries(answers).map(([k, v]) => [(qs || []).find((q) => q.key === k)?.label || k, v])];
    await resend.emails.send({ from, to, replyTo: d.email, subject: `New lead — ${page.eyebrow} — ${d.name}`, html: `<h2 style="font-family:Georgia,serif">${escapeHtml(d.grid_result)}</h2><table cellpadding="6">${rows.map(([k, v]) => `<tr><td><b>${escapeHtml(k)}</b></td><td>${escapeHtml(v || '—')}</td></tr>`).join('')}</table><p><a href="${import.meta.env.PUBLIC_SITE_URL}/dashboard/inbox">Open in dashboard</a></p>` });
    await resend.emails.send({ from, to: d.email, subject: 'Thanks — Eichenberg & Associates', html: `<p>Thanks, ${escapeHtml(d.name.split(' ')[0])}. We've got your answers and will reply within two business days.</p>${page.magnet_url ? `<p>Here's <a href="${page.magnet_url}">${escapeHtml(page.magnet_title || 'the guide')}</a>.</p>` : ''}${page.booking_url ? `<p>Want to talk sooner? <a href="${page.booking_url}">Pick a time</a>.</p>` : ''}<p>— Jennifer Eichenberg</p>` });
  } catch (e) { console.error('[lead] email', e); } }
  return json({ ok: true, id: lead.id });
};
