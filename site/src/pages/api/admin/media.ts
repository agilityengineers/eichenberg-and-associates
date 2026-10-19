// Upload an image or PDF. Stored in Postgres and served from /media/<id>-<name>.
import type { APIRoute } from 'astro';
import { q } from '../../../lib/db';
import { json } from '../../../lib/http';
const TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/svg+xml': 'svg', 'application/pdf': 'pdf' };
const MAX = 8 * 1024 * 1024;
export const POST: APIRoute = async ({ request }) => {
  const file = (await request.formData()).get('file');
  if (!(file instanceof File)) return json({ error: 'Choose a file.' }, 400);
  if (!TYPES[file.type]) return json({ error: 'Use a JPEG, PNG, WebP, GIF, SVG or PDF.' }, 400);
  if (file.size > MAX) return json({ error: 'That file is over 8 MB. Make it smaller and try again.' }, 400);
  const bytes = Buffer.from(await file.arrayBuffer());
  // SVGs can carry scripts; they are served with nosniff and an image content type, and only admins can upload.
  const name = (file.name || 'file').toLowerCase().replace(/\.[a-z0-9]+$/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'file';
  const [row] = await q<{ id: string }>('insert into media (filename, mime, size, bytes) values ($1, $2, $3, $4) returning id', [`${name}.${TYPES[file.type]}`, file.type, file.size, bytes]);
  return json({ ok: true, url: `/media/${row.id}-${name}.${TYPES[file.type]}` });
};
