import type { APIRoute } from 'astro';
import { z } from 'zod';
import { SETTINGS_FIELDS, docSchema } from '../../../lib/cms-schema';
import { DEFAULT_SETTINGS, getSettings, saveSettings, type Settings } from '../../../lib/settings';
import { json } from '../../../lib/http';
export const PUT: APIRoute = async ({ request }) => {
  const b = z.object({ data: z.unknown() }).safeParse(await request.json().catch(() => null));
  const p = b.success ? docSchema(SETTINGS_FIELDS).safeParse(b.data.data) : null;
  if (!p?.success) { const i = p?.error.issues[0]; return json({ error: i ? `Check “${i.path.join(' › ')}”: ${i.message}` : 'Bad request' }, 400); }
  const d = p.data as Settings;
  if (d.stages.length !== 5) return json({ error: 'There must be five stages.' }, 400);
  const keys = DEFAULT_SETTINGS.measures.map((m) => m.key);
  if (d.measures.length !== keys.length || d.measures.some((m, i) => m.key !== keys[i])) return json({ error: 'Measures can be relabelled but not added or removed.' }, 400);
  if (new Set(d.lists.situations.map((s) => s.value)).size !== d.lists.situations.length || d.lists.situations.some((s) => !/^[a-z0-9-]+$/.test(s.value))) return json({ error: 'Each “Where are you?” code must be unique: lowercase letters, numbers, hyphens.' }, 400);
  await saveSettings({ ...(await getSettings()), ...d });
  return json({ ok: true });
};
