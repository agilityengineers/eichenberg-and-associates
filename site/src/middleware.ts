import { defineMiddleware } from 'astro:middleware';
import { sessionDb, ADMIN_EMAILS, SUPABASE_CONFIGURED } from './lib/supabase';
export const onRequest = defineMiddleware(async ({ request, cookies, locals, redirect, url }, next) => {
  const protectedPath = url.pathname.startsWith('/dashboard') || url.pathname.startsWith('/api/admin');
  if (!protectedPath) return next();
  const sb = SUPABASE_CONFIGURED ? sessionDb(request, cookies) : null;
  const user = sb ? (await sb.auth.getUser()).data.user : null;
  if (!sb || !user || !ADMIN_EMAILS.includes((user.email || '').toLowerCase())) return url.pathname.startsWith('/api') ? new Response('Unauthorized', { status: 401 }) : redirect('/login?next=' + encodeURIComponent(url.pathname));
  locals.sb = sb; locals.user = user;
  return next();
});
