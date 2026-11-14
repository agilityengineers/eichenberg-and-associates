// Lead inbox → delete the selected submissions in one go (spam clean-up).
// Deals already opened from a submission stay in the pipeline; they just lose the link back to it.
import type { APIRoute } from 'astro';
import { z } from 'zod';
import { q } from '../../../lib/db';
import { json } from '../../../lib/http';

export const DELETE: APIRoute = async ({ request }) => {
  const b = z.object({ ids: z.array(z.string().uuid()).min(1).max(500) }).safeParse(await request.json().catch(() => null));
  if (!b.success) return json({ error: 'Select at least one submission.' }, 400);
  const removed = await q('delete from leads where id = any($1::uuid[]) returning id', [b.data.ids]);
  return json({ ok: true, removed: removed.length });
};
