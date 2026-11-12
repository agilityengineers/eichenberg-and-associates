// Transactional email. SendGrid (SENDGRID_API_KEY) is the provider; Resend (RESEND_API_KEY) still works as a fallback
// so an existing deployment keeps sending while the Secrets are switched over. With neither key the message is logged
// instead of sent (local development). Everything is read from process.env per call, so a Secret change needs a restart only.
import { env } from './env';

export type Mail = {
  to: string; subject: string; html: string;
  /** Where a reply goes. Defaults to CONTACT_REPLY_TO (support@), so nobody replies into the noreply@ void. */
  replyTo?: string;
  /** SendGrid category, so Jennifer can see delivery stats per kind of message (Activity → filter by category). */
  category?: 'lead-notify' | 'lead-ack' | 'contact-notify' | 'contact-ack' | 'password-reset' | 'test';
};

export const mailProvider = (): 'sendgrid' | 'resend' | null =>
  env('SENDGRID_API_KEY') ? 'sendgrid' : env('RESEND_API_KEY') ? 'resend' : null;
export const mailConfigured = () => !!(mailProvider() && fromAddress().email);

/** CONTACT_FROM_EMAIL may be a bare address or "Name <address>"; CONTACT_FROM_NAME sets the display name. */
export function fromAddress() {
  const raw = env('CONTACT_FROM_EMAIL'); const m = raw.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  return { email: (m ? m[2] : raw).trim(), name: env('CONTACT_FROM_NAME', m?.[1]?.trim() || 'Eichenberg & Associates') };
}
export const defaultReplyTo = () => env('CONTACT_REPLY_TO');

/** Plain-text alternative: spam filters score HTML-only mail lower, and some people read text only. */
const toText = (html: string) => html
  .replace(/<a\s[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/gi, (_, href, label) => (label.replace(/<[^>]+>/g, '') === href ? href : `${label} (${href})`))
  .replace(/<\/(p|h\d|tr|div)>|<br\s*\/?>/gi, '\n').replace(/<\/td>/gi, '  ').replace(/<[^>]+>/g, '')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  .replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

export async function sendMail(m: Mail): Promise<boolean> {
  const provider = mailProvider(); const from = fromAddress(); const replyTo = m.replyTo || defaultReplyTo();
  if (!provider || !from.email) { console.log('[mail] (no SENDGRID_API_KEY / CONTACT_FROM_EMAIL) would send:', m.to, '·', m.subject); return false; }

  if (provider === 'resend') {
    const { Resend } = await import('resend');
    const r = await new Resend(env('RESEND_API_KEY')).emails.send({ from: `${from.name} <${from.email}>`, to: m.to, subject: m.subject, html: m.html, ...(replyTo ? { replyTo } : {}) });
    if (r.error) throw new Error(r.error.message);
    return true;
  }

  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env('SENDGRID_API_KEY')}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: m.to }] }],
      from, ...(replyTo ? { reply_to: { email: replyTo } } : {}),
      subject: m.subject,
      content: [{ type: 'text/plain', value: toText(m.html) }, { type: 'text/html', value: m.html }],
      ...(m.category ? { categories: [m.category] } : {}),
      // Transactional mail: no link rewriting (it breaks one-time reset links and looks like phishing without
      // link branding) and no tracking pixel.
      tracking_settings: { click_tracking: { enable: false, enable_text: false }, open_tracking: { enable: false } },
      // SENDGRID_SANDBOX=true validates the request at SendGrid without delivering anything (for the dev workspace).
      ...(env('SENDGRID_SANDBOX') === 'true' ? { mail_settings: { sandbox_mode: { enable: true } } } : {}),
    }),
  });
  if (res.ok) return true; // 202 Accepted (200 in sandbox mode)
  const body = await res.json().catch(() => null) as { errors?: { message: string; field?: string }[] } | null;
  const detail = body?.errors?.map((e) => e.message + (e.field ? ` (${e.field})` : '')).join('; ') || res.statusText;
  throw new Error(`SendGrid ${res.status}: ${detail}`);
}
