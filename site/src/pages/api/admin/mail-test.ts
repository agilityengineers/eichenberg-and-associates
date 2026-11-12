// Dashboard → Settings → Email delivery → "Send a test email". Signed-in users only (middleware), same-origin only.
// Returns the provider's error text so a misconfigured Secret can be fixed without reading the deployment logs.
import type { APIRoute } from 'astro';
import { z } from 'zod';
import { json } from '../../../lib/http';
import { rateLimit } from '../../../lib/ratelimit';
import { defaultReplyTo, fromAddress, mailProvider, sendMail } from '../../../lib/mail';
import { siteUrl } from '../../../lib/env';

export const POST: APIRoute = async ({ request, locals }) => {
  const b = z.object({ to: z.string().trim().email().max(200) }).safeParse(await request.json().catch(() => null));
  if (!b.success) return json({ error: 'Enter a valid email address to send the test to.' }, 400);
  if (!rateLimit('mailtest:' + locals.user!.id, 10, 15 * 60_000).ok) return json({ error: 'Too many test emails. Wait 15 minutes.' }, 429);
  const provider = mailProvider(); const from = fromAddress();
  if (!provider || !from.email) return json({ error: 'Email is not set up yet: add SENDGRID_API_KEY and CONTACT_FROM_EMAIL in Replit Secrets, then restart.' }, 400);
  try {
    await sendMail({ to: b.data.to, category: 'test', subject: 'Test email from the Eichenberg & Associates website',
      html: `<p>This is a test from ${siteUrl()}, sent by ${locals.user!.email}.</p><p>From: ${from.name} &lt;${from.email}&gt;<br>Reply-to: ${defaultReplyTo() || '(not set)'}<br>Provider: ${provider}</p><p>If this arrived in your inbox (not spam), email delivery is working.</p>` });
    return json({ ok: true, provider });
  } catch (e) {
    console.error('[mail-test]', e);
    return json({ error: (e as Error).message }, 502);
  }
};
