// Dashboard → Settings → Email delivery → "Send a test email". Signed-in users only (middleware), same-origin only.
// Returns the provider's error text so a misconfigured Secret can be fixed without reading the deployment logs.
import type { APIRoute } from 'astro';
import { z } from 'zod';
import { json } from '../../../lib/http';
import { rateLimit } from '../../../lib/ratelimit';
import { defaultReplyTo, fromAddress, mailProvider, sendMail, type Mail } from '../../../lib/mail';
import { siteUrl } from '../../../lib/env';

export const POST: APIRoute = async ({ request, locals }) => {
  const b = z.object({
    to: z.string().trim().email().max(200),
    allTemplates: z.boolean().optional().default(false),
  }).safeParse(await request.json().catch(() => null));
  if (!b.success) return json({ error: 'Enter a valid email address to send the test to.' }, 400);
  if (!rateLimit('mailtest:' + locals.user!.id, 10, 15 * 60_000).ok) return json({ error: 'Too many test emails. Wait 15 minutes.' }, 429);
  const provider = mailProvider(); const from = fromAddress();
  if (!provider || !from.email) return json({ error: 'Email is not set up yet: add SENDGRID_API_KEY and CONTACT_FROM_EMAIL in Replit Secrets, then restart.' }, 400);
  const messages: Mail[] = [{
    to: b.data.to, category: 'test', subject: '[TEST] Email delivery check',
    html: `<p>This is a test from ${siteUrl()}, sent by ${locals.user!.email}.</p><p>From: ${from.name} &lt;${from.email}&gt;<br>Reply-to: ${defaultReplyTo() || '(not set)'}<br>Provider: ${provider}</p><p>If this arrived in your inbox (not spam), email delivery is working.</p>`,
  }];
  if (b.data.allTemplates) {
    const resetLink = 'https://example.invalid/test-only-password-reset-link';
    const hello = `<p>This is a sample test email. No lead, contact request, subscription, or password reset was created.</p>`;
    messages.push(
      {
        to: b.data.to, category: 'lead-notify', subject: '[TEST] New lead notification',
        html: `${hello}<h2>Ready for the change</h2><table cellpadding="6"><tr><td><b>Page</b></td><td>Test persona page</td></tr><tr><td><b>Name</b></td><td>Alex Example</td></tr><tr><td><b>Email</b></td><td>alex@example.invalid</td></tr><tr><td><b>Company</b></td><td>Example Company</td></tr><tr><td><b>Grid</b></td><td>Can lead and can do</td></tr></table><p><a href="${siteUrl()}/dashboard/inbox">Open in the dashboard</a></p>`,
      },
      {
        to: b.data.to, category: 'lead-ack', subject: '[TEST] Lead acknowledgment',
        html: `${hello}<p>Thanks, Alex. We've got your answers and will reply within two business days.</p><p>— Jennifer Eichenberg</p>`,
      },
      {
        to: b.data.to, category: 'contact-notify', subject: '[TEST] Website inquiry notification',
        html: `${hello}<h2>New inquiry</h2><table cellpadding="6"><tr><td><b>Name</b></td><td>Alex Example</td></tr><tr><td><b>Email</b></td><td>alex@example.invalid</td></tr><tr><td><b>Company</b></td><td>Example Company</td></tr><tr><td><b>Situation</b></td><td>Planning a change</td></tr><tr><td><b>Message</b></td><td>This is a sample contact inquiry.</td></tr></table><p><a href="${siteUrl()}/dashboard/inbox">Open the Lead inbox</a></p>`,
      },
      {
        to: b.data.to, category: 'contact-ack', subject: '[TEST] Contact acknowledgment',
        html: `${hello}<p>Thanks, Alex. We've got your note and will reply within two business days.</p><p>— Jennifer Eichenberg</p>`,
      },
      {
        to: b.data.to, category: 'password-reset', subject: '[TEST] Dashboard password reset',
        html: `${hello}<p>This sample shows the password-reset email format. The link below is deliberately non-functional and does not reset any account:</p><p><a href="${resetLink}">${resetLink}</a></p><p>If you didn't ask for this, you can ignore this test email.</p>`,
      },
    );
  }
  try {
    for (const message of messages) await sendMail(message);
    return json({ ok: true, provider, sent: messages.length });
  } catch (e) {
    console.error('[mail-test]', e);
    return json({ error: (e as Error).message }, 502);
  }
};
