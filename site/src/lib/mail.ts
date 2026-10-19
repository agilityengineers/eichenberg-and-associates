// Transactional email through Resend. Without RESEND_API_KEY the message is logged instead (local development).
import { Resend } from 'resend';
import { env } from './env';
export const mailConfigured = () => !!(env('RESEND_API_KEY') && env('CONTACT_FROM_EMAIL'));
export async function sendMail(m: { to: string; subject: string; html: string; replyTo?: string }) {
  if (!mailConfigured()) { console.log('[mail] (RESEND_API_KEY not set) would send:', m.to, '·', m.subject); return false; }
  const r = await new Resend(env('RESEND_API_KEY')).emails.send({ from: env('CONTACT_FROM_EMAIL'), ...m });
  if (r.error) throw new Error(r.error.message);
  return true;
}
