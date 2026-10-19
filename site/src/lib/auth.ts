// Email + password sign-in for /login. Sessions live in Postgres; the browser holds only an opaque, httpOnly cookie.
import type { AstroCookies } from 'astro';
import { q, one } from './db';
import { newToken, sha256 } from './password';
import { isProd } from './env';

export const SESSION_COOKIE = 'ea_session';
const DAYS = 30;
export type User = { id: string; email: string; name: string };

const secureFor = (request: Request) => (request.headers.get('x-forwarded-proto') || new URL(request.url).protocol.replace(':', '')) === 'https';

export async function createSession(userId: string, cookies: AstroCookies, request: Request) {
  const token = newToken(); const expires = new Date(Date.now() + DAYS * 864e5);
  await q('insert into sessions (id, user_id, expires_at) values ($1, $2, $3)', [sha256(token), userId, expires]);
  await q('update users set last_login_at = now() where id = $1', [userId]);
  // The Replit workspace previews the dev server inside an iframe on replit.com, where a SameSite=Lax cookie is never
  // sent back. Dev over HTTPS therefore uses SameSite=None; the deployed site keeps Lax.
  const secure = secureFor(request);
  cookies.set(SESSION_COOKIE, token, { path: '/', httpOnly: true, sameSite: !isProd() && secure ? 'none' : 'lax', secure, expires });
}

export async function userFromCookies(cookies: AstroCookies): Promise<User | null> {
  const token = cookies.get(SESSION_COOKIE)?.value; if (!token) return null;
  return one<User>('select u.id, u.email, u.name from sessions s join users u on u.id = s.user_id where s.id = $1 and s.expires_at > now()', [sha256(token)]);
}

export async function destroySession(cookies: AstroCookies) {
  const token = cookies.get(SESSION_COOKIE)?.value;
  if (token) await q('delete from sessions where id = $1', [sha256(token)]);
  cookies.delete(SESSION_COOKIE, { path: '/' });
}

export async function createResetToken(userId: string) {
  const token = newToken();
  await q("insert into password_resets (id, user_id, expires_at) values ($1, $2, now() + interval '1 hour')", [sha256(token), userId]);
  return token;
}
export async function consumeResetToken(token: string): Promise<string | null> {
  const row = await one<{ user_id: string }>('update password_resets set used_at = now() where id = $1 and used_at is null and expires_at > now() returning user_id', [sha256(token)]);
  return row?.user_id ?? null;
}
