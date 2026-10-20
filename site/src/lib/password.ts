// Password hashing with Node's built-in scrypt (no native dependency, works on Replit as-is).
import { scrypt, randomBytes, timingSafeEqual, createHash } from 'node:crypto';
const N = 16384, r = 8, p = 1, LEN = 64;
const run = (pw: string, salt: Buffer) => new Promise<Buffer>((ok, no) => scrypt(pw.normalize('NFKC'), salt, LEN, { N, r, p, maxmem: 64 * 1024 * 1024 }, (e, k) => (e ? no(e) : ok(k))));
export async function hashPassword(pw: string) { const salt = randomBytes(16); return `scrypt$${N}$${r}$${p}$${salt.toString('base64')}$${(await run(pw, salt)).toString('base64')}`; }
export async function verifyPassword(pw: string, stored: string) {
  const [alg, , , , s, h] = stored.split('$'); if (alg !== 'scrypt' || !s || !h) return false;
  const want = Buffer.from(h, 'base64'), got = await run(pw, Buffer.from(s, 'base64'));
  return want.length === got.length && timingSafeEqual(want, got);
}
export const newToken = () => randomBytes(32).toString('base64url');
export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
export const PASSWORD_RULE = 'At least 10 characters.';
export const passwordOk = (pw: string) => typeof pw === 'string' && pw.length >= 10 && pw.length <= 200;
