import type { APIRoute } from 'astro';
import { z } from 'zod';
import { one } from '../../../lib/db';
import { verifyPassword } from '../../../lib/password';
import { createSession } from '../../../lib/auth';
import { rateLimit } from '../../../lib/ratelimit';
import { clientIp, json, safeNext } from '../../../lib/http';

const Body = z.object({ email: z.string().email().max(200), password: z.string().min(1).max(200), next: z.string().max(300).optional() });
export const POST: APIRoute = async ({ request, cookies, clientAddress }) => {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: 'Enter your email and password.' }, 400);
  const { email, password, next } = parsed.data;
  const ip = clientIp(request, clientAddress);
  if (!rateLimit('login:' + ip, 10, 15 * 60_000).ok || !rateLimit('login:' + email.toLowerCase(), 10, 15 * 60_000).ok) return json({ error: 'Too many attempts. Wait 15 minutes and try again.' }, 429);
  const user = await one<{ id: string; password_hash: string }>('select id, password_hash from users where lower(email) = lower($1)', [email]);
  // Same message and similar timing whether or not the email exists.
  const ok = await verifyPassword(password, user?.password_hash || 'scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAA');
  if (!user || !ok) return json({ error: 'That email and password don’t match.' }, 401);
  await createSession(user.id, cookies, request);
  return json({ ok: true, next: safeNext(next) });
};
