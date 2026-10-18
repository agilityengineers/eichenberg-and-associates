import { createClient } from '@supabase/supabase-js';
import { createServerClient, parseCookieHeader, serializeCookieHeader } from '@supabase/ssr';
import type { AstroCookies } from 'astro';
const url = import.meta.env.PUBLIC_SUPABASE_URL, anon = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
/** Anonymous client: reads published landing pages + questions (RLS). */
export const publicDb = () => createClient(url, anon, { auth: { persistSession: false } });
/** Service-role client: server-only writes (leads, subscribers, acknowledgement data). Never ship to the browser. */
export const adminDb = () => createClient(url, import.meta.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
/** Session-aware client for the dashboard (cookie-based auth). */
export const sessionDb = (request: Request, cookies: AstroCookies) => createServerClient(url, anon, {
  cookies: { getAll: () => parseCookieHeader(request.headers.get('Cookie') ?? ''), setAll: (list) => list.forEach(({ name, value, options }) => cookies.set(name, value, options)) },
});
export const ADMIN_EMAILS = (import.meta.env.ADMIN_EMAILS || '').split(',').map((s: string) => s.trim().toLowerCase()).filter(Boolean);
