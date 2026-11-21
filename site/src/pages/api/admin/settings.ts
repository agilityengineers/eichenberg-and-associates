import type { APIRoute } from 'astro';
import { z } from 'zod';
import { SETTINGS_FIELDS, docSchema } from '../../../lib/cms-schema';
import { DEFAULT_SETTINGS, clearSettingsCache, getSettings, newId, normStage, type Settings } from '../../../lib/settings';
import { tx } from '../../../lib/db';
import { json } from '../../../lib/http';

const ID = /^[a-z0-9]{3,24}$/;
/** Keeps ids the page sent back, and gives new rows (blank or clashing ids) a fresh one. */
const withIds = <T extends { id?: string }>(rows: T[], taken: Set<string>) => rows.map((r) => { let id = r.id && ID.test(r.id) && !taken.has(r.id) ? r.id : newId(); while (taken.has(id)) id = newId(); taken.add(id); return { ...r, id }; });

export const PUT: APIRoute = async ({ request }) => {
  const b = z.object({ data: z.unknown() }).safeParse(await request.json().catch(() => null));
  const p = b.success ? docSchema(SETTINGS_FIELDS).safeParse(b.data.data) : null;
  if (!p?.success) { const i = p?.error.issues[0]; return json({ error: i ? `Check “${i.path.join(' › ')}”: ${i.message}` : 'Bad request' }, 400); }
  const d = p.data as Settings;
  if (d.stages.length < 2 || d.stages.length > 12) return json({ error: 'The sales process needs between 2 and 12 stages.' }, 400);
  if (d.stages.some((s) => !s.name.trim())) return json({ error: 'Every stage needs a name.' }, 400);
  const keys = DEFAULT_SETTINGS.measures.map((m) => m.key);
  if (d.measures.length !== keys.length || d.measures.some((m, i) => m.key !== keys[i])) return json({ error: 'Measures can be relabelled but not added or removed.' }, 400);
  if (new Set(d.lists.situations.map((s) => s.value)).size !== d.lists.situations.length || d.lists.situations.some((s) => !/^[a-z0-9-]+$/.test(s.value))) return json({ error: 'Each “Where are you?” code must be unique: lowercase letters, numbers, hyphens.' }, 400);
  const reasons = DEFAULT_SETTINGS.closeReasons.map((r) => r.value);
  if (d.closeReasons.length !== reasons.length || d.closeReasons.some((r, i) => r.value !== reasons[i])) return json({ error: 'Close reasons can be relabelled but not added or removed.' }, 400);

  // Stable ids: stages, gate checks and capture fields keep theirs; new rows get one.
  const stageIds = new Set<string>(), fieldIds = new Set<string>();
  d.stages = withIds(d.stages, stageIds).map((s) => normStage({ ...s, capture: withIds(s.capture || [], fieldIds), gate: { ...s.gate, checks: withIds(s.gate?.checks || [], fieldIds) } }));

  // Deals store their stage as a position, so when stages are reordered or removed the deals move with their stage.
  const before = (await getSettings()).stages;
  const moved = before.map((s, i) => ({ from: i, to: d.stages.findIndex((x) => x.id === s.id), name: s.name }));
  const result = await tx(async (c) => {
    const counts = (await c.query<{ stage: number; n: number }>('select stage, count(*)::int as n from deals group by stage')).rows;
    const stuck = moved.filter((m) => m.to < 0 && counts.some((x) => x.stage === m.from && x.n > 0));
    if (stuck.length) { const m = stuck[0], n = counts.find((x) => x.stage === m.from)!.n; return `“${m.name}” still holds ${n} deal${n === 1 ? '' : 's'} (open or closed). Move ${n === 1 ? 'it' : 'them'} to another stage first, then remove the stage.`; }
    const changes = moved.filter((m) => m.to >= 0 && m.to !== m.from);
    if (changes.length) await c.query(`update deals set stage = case stage ${changes.map((m) => `when ${m.from} then ${m.to}`).join(' ')} else stage end where stage in (${changes.map((m) => m.from).join(', ')})`);
    await c.query('update deals set stage = $1 where stage > $1', [d.stages.length - 1]);   // safety net for rows that pointed past the end
    const merged = { ...(await getSettings()), ...d };
    await c.query("insert into settings (key, data, updated_at) values ('dashboard', $1, now()) on conflict (key) do update set data = excluded.data, updated_at = now()", [JSON.stringify(merged)]);
    return null;
  });
  clearSettingsCache();
  if (result) return json({ error: result }, 400);
  return json({ ok: true, redirect: '/dashboard/settings' });   // reload so new rows show their saved ids
};
