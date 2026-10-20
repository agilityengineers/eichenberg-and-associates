import { defineMiddleware } from 'astro:middleware';
import { ensureReady } from './lib/bootstrap';
import { SESSION_COOKIE, userFromCookies } from './lib/auth';
import { dbConfigured } from './lib/db';
import { isProd } from './lib/env';

// Old WordPress URLs.
const REDIRECTS: Record<string, string> = { '/speaking-engagements': '/about', '/resources': '/insights', '/book-a-meeting': '/contact' };

const CSP = ["default-src 'self'", "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com https://plausible.io", "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com", "img-src 'self' data: https:", "media-src 'self' https:", "connect-src 'self' https://plausible.io",
  "frame-src https://challenges.cloudflare.com https://calendly.com https://*.calendly.com", "form-action 'self'", "base-uri 'self'", "frame-ancestors 'none'", "object-src 'none'"].join('; ');

const sameOrigin = (request: Request) => {
  const origin = request.headers.get('origin') || request.headers.get('referer'); if (!origin) return false;
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
  try { return new URL(origin).host === host; } catch { return false; }
};

export const onRequest = defineMiddleware(async ({ request, cookies, locals, redirect, url }, next) => {
  const path = url.pathname.replace(/\/+$/, '') || '/';
  if (REDIRECTS[path]) return redirect(REDIRECTS[path], 301);
  await ensureReady();

  const isAdmin = path.startsWith('/dashboard') || path.startsWith('/api/admin');
  const writes = !['GET', 'HEAD', 'OPTIONS'].includes(request.method);
  // Cross-site writes are refused outright on the authenticated API; public forms also carry Turnstile + honeypot.
  if (writes && (path.startsWith('/api/admin') || path.startsWith('/api/auth')) && !sameOrigin(request)) return new Response('Forbidden', { status: 403 });

  locals.user = null;
  if (dbConfigured() && (isAdmin || path === '/login' || path.startsWith('/api/auth') || cookies.has(SESSION_COOKIE))) {
    try { locals.user = await userFromCookies(cookies); } catch (e) { console.error('[auth]', (e as Error).message); }
  }
  if (isAdmin && !locals.user) return path.startsWith('/api') ? new Response(JSON.stringify({ error: 'Signed out. Reload and sign in again.' }), { status: 401, headers: { 'content-type': 'application/json' } }) : redirect('/login?next=' + encodeURIComponent(url.pathname + url.search));
  if (path === '/login' && locals.user && !url.searchParams.get('token')) return redirect('/dashboard');

  const res = await next();
  const h = res.headers;
  h.set('X-Content-Type-Options', 'nosniff'); h.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  h.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  // Framing is refused only on the deployed site: the Replit workspace shows the dev server inside an iframe.
  if (isProd()) { h.set('X-Frame-Options', 'DENY'); h.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains'); h.set('Content-Security-Policy', CSP); }
  if (isAdmin || path === '/login') { h.set('Cache-Control', 'no-store'); h.set('X-Robots-Tag', 'noindex'); }
  return res;
});
