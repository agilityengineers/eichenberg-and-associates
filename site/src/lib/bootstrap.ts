// Runs once per server process before the first request: creates tables, copies default content into the database,
// seeds the five landing pages, and creates the first admin from ADMIN_EMAIL / ADMIN_PASSWORD if there are no users yet.
import schemaSql from '../../db/schema.sql?raw';
import { db, dbConfigured, one, q } from './db';
import { DEFAULTS, SINGLETON_COLLECTIONS, invalidate } from './content';
import { DEFAULT_SETTINGS } from './settings';
import { PERSONAS, BASE_QUESTIONS } from './personas.js';
import { hashPassword, passwordOk } from './password';
import { env } from './env';

let ready: Promise<void> | null = null;
export function ensureReady(): Promise<void> {
  if (!dbConfigured()) return Promise.resolve();
  if (!ready) ready = boot().catch((e) => { ready = null; console.error('[boot] database setup failed:', e.message); });
  return ready;
}

async function boot() {
  await db().query(schemaSql);
  // Content: page/settings documents are added whenever a new one ships; collection entries are copied only once,
  // so entries the admin deletes stay deleted.
  const seeded = await one("select 1 from settings where key = 'content_seeded'");
  for (const d of DEFAULTS) {
    if (!SINGLETON_COLLECTIONS.includes(d.collection) && seeded) continue;
    await q('insert into content (collection, slug, data, body) values ($1, $2, $3, $4) on conflict do nothing', [d.collection, d.slug, JSON.stringify(d.data), d.body]);
  }
  if (!seeded) await q("insert into settings (key, data) values ('content_seeded', 'true') on conflict do nothing");
  // Databases seeded before the blog feed was known still hold the placeholder feed sources; swap those (and only those)
  // for the shipped defaults. Sources the admin has edited to a real address are left alone.
  const feedsDefault = DEFAULTS.find((d) => d.collection === 'settings' && d.slug === 'feeds');
  const feedsRow = await one<{ data: any }>("select data from content where collection = 'settings' and slug = 'feeds'");
  const stored = feedsRow?.data?.sources;
  if (feedsDefault && Array.isArray(stored) && stored.every((x: any) => !x?.url || String(x.url).includes('PLACEHOLDER'))) {
    await q("update content set data = jsonb_set(data, '{sources}', $1::jsonb), updated_at = now() where collection = 'settings' and slug = 'feeds'", [JSON.stringify(feedsDefault.data.sources)]);
    console.log('[boot] replaced placeholder feed sources with the default blog feed');
  }
  await q("insert into settings (key, data) values ('dashboard', $1) on conflict do nothing", [JSON.stringify(DEFAULT_SETTINGS)]);
  invalidate();

  if (!(await one('select 1 from landing_pages limit 1'))) {
    for (const p of PERSONAS) {
      await q(`insert into landing_pages (slug, persona, eyebrow, frame, headline, situation, awareness, goals, pains, messages, offer, cta, magnet_title, booking_url)
               values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) on conflict do nothing`,
        [p.slug, p.internal, p.eyebrow, p.frame, p.headline, p.situation, p.awareness, JSON.stringify(p.goals), JSON.stringify(p.pains), JSON.stringify(p.messages), JSON.stringify(p.offer), p.cta, p.magnet, env('CALENDLY_URL') || null]);
      const rows = [...BASE_QUESTIONS.map((x, i) => ({ ...x, step: 1, position: i })), ...p.questions.map((x, i) => ({ ...x, step: 2, position: i }))];
      for (const x of rows as any[]) await q('insert into form_questions (page_slug, step, position, key, label, type, options, required, locked) values ($1,$2,$3,$4,$5,$6,$7,$8,$9) on conflict do nothing',
        [p.slug, x.step, x.position, x.id, x.label, x.type, x.options ? JSON.stringify(x.options) : null, !!x.required, !!x.locked]);
    }
    console.log('[boot] seeded', PERSONAS.length, 'landing pages');
  }

  const email = env('ADMIN_EMAIL').toLowerCase(), pw = env('ADMIN_PASSWORD');
  if (email && !(await one('select 1 from users limit 1'))) {
    if (!passwordOk(pw)) console.warn('[boot] ADMIN_PASSWORD must be at least 10 characters; no admin created.');
    else { await q('insert into users (email, name, password_hash) values ($1, $2, $3)', [email, env('ADMIN_NAME'), await hashPassword(pw)]); console.log('[boot] created admin', email); }
  }
}
