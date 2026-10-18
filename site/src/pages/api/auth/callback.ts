import type { APIRoute } from 'astro';
import { sessionDb } from '../../../lib/supabase';
export const prerender = false;
export const GET: APIRoute = async ({ request, cookies, redirect, url }) => {
  const code = url.searchParams.get('code'); const next = url.searchParams.get('next') || '/dashboard';
  if (code) { const { error } = await sessionDb(request, cookies).auth.exchangeCodeForSession(code); if (error) return redirect('/login?error=1'); }
  return redirect(next.startsWith('/') ? next : '/dashboard');
};
export const POST: APIRoute = async ({ request, cookies, redirect }) => { await sessionDb(request, cookies).auth.signOut(); return redirect('/login'); };
