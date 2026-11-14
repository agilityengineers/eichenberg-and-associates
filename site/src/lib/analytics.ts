// Google Analytics (GA4) + Search Console configuration. Each value can be set in the dashboard
// (Website content → Site-wide → Google Analytics & Search Console) or as a Replit Secret; the dashboard wins.
// Both values end up in the page <head>, so anything that is not the expected shape is ignored.
import { setting } from './content';
import { env } from './env';

const gaId = (v: unknown) => { const s = String(v ?? '').trim().toUpperCase(); return /^G-[A-Z0-9]{4,20}$/.test(s) ? s : ''; };
/** Accepts the bare code or the whole <meta name="google-site-verification" content="…"> tag pasted from Search Console. */
const verification = (v: unknown) => { const s = String(v ?? '').trim(); const code = s.match(/content\s*=\s*["']([^"']+)["']/i)?.[1] ?? s; return /^[A-Za-z0-9_-]{10,200}$/.test(code) ? code : ''; };

export type Consent = { enabled: boolean; text: string; acceptLabel: string; declineLabel: string; privacyLabel: string; manageLabel: string; regionLabel: string };
export async function analytics(): Promise<{ gaId: string; verification: string; consent: Consent; banner: boolean }> {
  const a = await setting('analytics');
  const id = gaId(a.gaId) || gaId(env('PUBLIC_GA_MEASUREMENT_ID'));
  return { gaId: id, verification: verification(a.searchConsole) || verification(env('GOOGLE_SITE_VERIFICATION')), consent: a.consent, banner: !!id && a.consent.enabled !== false };
}
