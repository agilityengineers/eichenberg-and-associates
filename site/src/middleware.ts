import { defineMiddleware } from 'astro:middleware';
import { sessionDb, ADMIN_EMAILS } from './lib/supabase';
export const onRequest = defineMiddleware(async ({ request, cookies, locals, redirect, url }, next) => {
  const protectedPath = url.pathname.startsWith('/dashboard') || url.pathname.startsWith('/api/admin');
  if (!protectedPath) return next();
  const sb = sessionDb(request, cookies); const { data: { user } } = await sb.auth.getUser();
  const ok = user && ADMIN_EMAILS.includes((user.email || '').toLowerCase());
  if (!ok) return url.pathname.startsWith('/api') ? new Response('Unauthorized', { status: 401 }) : redirect('/login?next=' + encodeURIComponent(url.pathname));
  (locals as any).sb = sb; (locals as any).user = user;
  return next();
});
