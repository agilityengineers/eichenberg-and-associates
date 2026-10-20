import type { APIRoute } from 'astro';
import { dbConfigured, one } from '../../lib/db';
// Uploaded images and PDFs, stored in Postgres (Replit deployments have no persistent disk). URL: /media/<uuid>-<name>
export const GET: APIRoute = async ({ params }) => {
  const id = (params.file || '').slice(0, 36);
  if (!dbConfigured() || !/^[0-9a-f-]{36}$/.test(id)) return new Response('Not found', { status: 404 });
  const m = await one<{ mime: string; bytes: Buffer; filename: string }>('select mime, bytes, filename from media where id = $1', [id]);
  if (!m) return new Response('Not found', { status: 404 });
  return new Response(new Uint8Array(m.bytes), { headers: { 'content-type': m.mime, 'cache-control': 'public, max-age=31536000, immutable', 'content-disposition': `inline; filename="${m.filename.replace(/[^\w.-]/g, '_')}"`, 'x-content-type-options': 'nosniff' } });
};
