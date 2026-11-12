// Send one test email from the Replit Shell (uses the workspace Secrets):
//   npm run mail:test -- you@example.com
import { sendMail, mailProvider, fromAddress, defaultReplyTo } from '../src/lib/mail';

try { (process as any).loadEnvFile?.('.env'); } catch {}
const to = process.argv[2];
if (!to) { console.error('Usage: npm run mail:test -- <to-address>'); process.exit(1); }
const from = fromAddress();
console.log(`Provider: ${mailProvider() || 'none'} · From: ${from.name} <${from.email || 'CONTACT_FROM_EMAIL not set'}> · Reply-to: ${defaultReplyTo() || '(not set)'}`);
if (!mailProvider() || !from.email) { console.error('Set SENDGRID_API_KEY and CONTACT_FROM_EMAIL in Replit Secrets first.'); process.exit(1); }
try {
  await sendMail({ to, category: 'test', subject: 'Test email from the Eichenberg & Associates website (Shell)', html: `<p>Test from the Replit Shell at ${new Date().toISOString()}.</p><p>If this is in your inbox (not spam), email delivery works.</p>` });
  console.log('Accepted by', mailProvider(), '→', to, '(check the inbox, the spam folder, and SendGrid → Activity)');
} catch (e) { console.error('Failed:', (e as Error).message); process.exit(1); }
