// Dashboard logins: add, remove, set password. Every user can manage the site.
import type { APIRoute } from 'astro';
import { z } from 'zod';
import { one, q } from '../../../lib/db';
import { hashPassword, passwordOk, verifyPassword, PASSWORD_RULE } from '../../../lib/password';
import { json } from '../../../lib/http';

export const POST: APIRoute = async ({ request }) => {
  const b = z.object({ email: z.string().email().max(200), name: z.string().max(120).default(''), password: z.string().max(200) }).safeParse(await request.json().catch(() => null));
  if (!b.success) return json({ error: 'Enter a name, a valid email and a password.' }, 400);
  if (!passwordOk(b.data.password)) return json({ error: 'Password: ' + PASSWORD_RULE }, 400);
  if (await one('select 1 from users where lower(email) = lower($1)', [b.data.email])) return json({ error: 'That email already has a login.' }, 400);
  await q('insert into users (email, name, password_hash) values (lower($1), $2, $3)', [b.data.email, b.data.name, await hashPassword(b.data.password)]);
  return json({ ok: true });
};

export const PATCH: APIRoute = async ({ request, locals }) => {
  // Change your own password (needs the current one).
  const b = z.object({ current: z.string().max(200), password: z.string().max(200) }).safeParse(await request.json().catch(() => null));
  if (!b.success) return json({ error: 'Bad request' }, 400);
  const u = await one<{ password_hash: string }>('select password_hash from users where id = $1', [locals.user!.id]);
  if (!u || !(await verifyPassword(b.data.current, u.password_hash))) return json({ error: 'Your current password is not right.' }, 400);
  if (!passwordOk(b.data.password)) return json({ error: 'New password: ' + PASSWORD_RULE }, 400);
  await q('update users set password_hash = $2 where id = $1', [locals.user!.id, await hashPassword(b.data.password)]);
  return json({ ok: true });
};

export const DELETE: APIRoute = async ({ request, locals }) => {
  const b = z.object({ id: z.string().uuid() }).safeParse(await request.json().catch(() => null));
  if (!b.success) return json({ error: 'Bad request' }, 400);
  if (b.data.id === locals.user!.id) return json({ error: 'You can’t remove your own login.' }, 400);
  await q('delete from users where id = $1', [b.data.id]);
  return json({ ok: true });
};
