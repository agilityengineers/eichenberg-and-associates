import type { APIRoute } from 'astro';
import { z } from 'zod';
import { q } from '../../../lib/db';
import { consumeResetToken, createSession } from '../../../lib/auth';
import { hashPassword, passwordOk, PASSWORD_RULE } from '../../../lib/password';
import { json } from '../../../lib/http';

export const POST: APIRoute = async ({ request, cookies }) => {
  const parsed = z.object({ token: z.string().min(20).max(100), password: z.string().max(200) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: 'That link is not valid.' }, 400);
  if (!passwordOk(parsed.data.password)) return json({ error: 'Password: ' + PASSWORD_RULE }, 400);
  const userId = await consumeResetToken(parsed.data.token);
  if (!userId) return json({ error: 'That link has expired or was already used. Ask for a new one.' }, 400);
  await q('update users set password_hash = $2 where id = $1', [userId, await hashPassword(parsed.data.password)]);
  await q('delete from sessions where user_id = $1', [userId]);
  await createSession(userId, cookies, request);
  return json({ ok: true, next: '/dashboard' });
};
