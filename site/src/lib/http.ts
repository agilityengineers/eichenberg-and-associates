// Small helpers shared by the API routes.
import { createHash } from 'node:crypto';
export const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
/** Client IP behind Replit's proxy (first X-Forwarded-For hop), falling back to the socket address. */
export const clientIp = (request: Request, clientAddress?: string) => request.headers.get('x-forwarded-for')?.split(',')[0].trim() || (() => { try { return clientAddress || ''; } catch { return ''; } })();
export const ipHash = (ip: string) => createHash('sha256').update('ea:' + ip).digest('hex').slice(0, 32);
/** The origin the visitor used (Replit terminates HTTPS in front of the app). */
export const publicOrigin = (request: Request) => {
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || new URL(request.url).host;
  const proto = request.headers.get('x-forwarded-proto')?.split(',')[0] || new URL(request.url).protocol.replace(':', '');
  return `${proto}://${host}`;
};
/** Only same-site relative paths are allowed as post-login destinations. */
export const safeNext = (n: unknown) => (typeof n === 'string' && /^\/(?!\/)/.test(n) && !n.startsWith('/api') ? n : '/dashboard');
