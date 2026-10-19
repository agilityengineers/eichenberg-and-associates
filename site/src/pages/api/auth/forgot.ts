import type { APIRoute } from 'astro';
import { z } from 'zod';
import { one } from '../../../lib/db';
import { createResetToken } from '../../../lib/auth';
import { sendMail, mailConfigured } from '../../../lib/mail';
import { rateLimit } from '../../../lib/ratelimit';
import { escapeHtml } from '../../../lib/sanitize';
import { clientIp, json, publicOrigin } from '../../../lib/http';

export const POST: APIRoute = async ({ request, clientAddress }) => {
  const parsed = z.object({ email: z.string().email().max(200) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: 'Enter the email you sign in with.' }, 400);
  if (!rateLimit('forgot:' + clientIp(request, clientAddress), 5, 15 * 60_000).ok) return json({ error: 'Too many requests. Try again later.' }, 429);
  const user = await one<{ id: string; name: string; email: string }>('select id, name, email from users where lower(email) = lower($1)', [parsed.data.email]);
  if (user) {
    const link = `${publicOrigin(request)}/login?token=${await createResetToken(user.id)}`;
    try { await sendMail({ to: user.email, subject: 'Reset your dashboard password', html: `<p>Hi${user.name ? ' ' + escapeHtml(user.name.split(' ')[0]) : ''},</p><p>Use this link within the next hour to choose a new password for the Eichenberg & Associates dashboard:</p><p><a href="${link}">${link}</a></p><p>If you didn’t ask for this, you can ignore this email.</p>` }); }
    catch (e) { console.error('[forgot] email failed', e); }
    if (!mailConfigured()) console.log('[forgot] reset link for', user.email, '→', link);
  }
  // Same answer either way, so the form can't be used to discover accounts.
  return json({ ok: true });
};
