// Runs once per server process before the first request: creates tables, copies default content into the database,
// seeds the five landing pages, applies any pending copy updates, and creates the first admin from ADMIN_EMAIL /
// ADMIN_PASSWORD if there are no users yet.
import schemaSql from '../../db/schema.sql?raw';
import { db, dbConfigured, one, q } from './db';
import { DEFAULTS, SINGLETON_COLLECTIONS, invalidate } from './content';
import { DEFAULT_SETTINGS, OLD_OFFERS, clearSettingsCache, normStage } from './settings';
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
      await q(`insert into landing_pages (slug, persona, eyebrow, frame, headline, situation, awareness, goals, pains, messages, offer, cta, magnet_title, booking_url, hero_image)
               values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) on conflict do nothing`,
        [p.slug, p.internal, p.eyebrow, p.frame, p.headline, p.situation, p.awareness, JSON.stringify(p.goals), JSON.stringify(p.pains), JSON.stringify(p.messages), JSON.stringify(p.offer), p.cta, p.magnet || null, env('CALENDLY_URL') || null, p.heroImage || null]);
      const rows = [...BASE_QUESTIONS.map((x, i) => ({ ...x, step: 1, position: i })), ...p.questions.map((x, i) => ({ ...x, step: 2, position: i }))];
      for (const x of rows as any[]) await q('insert into form_questions (page_slug, step, position, key, label, type, options, required, locked) values ($1,$2,$3,$4,$5,$6,$7,$8,$9) on conflict do nothing',
        [p.slug, x.step, x.position, x.id, x.label, x.type, x.options ? JSON.stringify(x.options) : null, !!x.required, !!x.locked]);
    }
    console.log('[boot] seeded', PERSONAS.length, 'landing pages');
  }
  await applyCopyUpdates();
  await applySalesProcess();
  invalidate();

  const email = env('ADMIN_EMAIL').toLowerCase(), pw = env('ADMIN_PASSWORD');
  if (email && !(await one('select 1 from users limit 1'))) {
    if (!passwordOk(pw)) console.warn('[boot] ADMIN_PASSWORD must be at least 10 characters; no admin created.');
    else { await q('insert into users (email, name, password_hash) values ($1, $2, $3)', [email, env('ADMIN_NAME'), await hashPassword(pw)]); console.log('[boot] created admin', email); }
  }
}

// ---------- Copy updates ----------
// Wording changes from the client's review of the live site (October 2026). A database seeded earlier still holds the
// previous wording, so each change below is applied on boot — but only while the stored text still equals the wording it
// replaces. Anything already changed in the dashboard is left exactly as it is. Safe to run on every boot.
const norm = (s: unknown) => String(s ?? '').replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"').replace(/\s+/g, ' ').trim();
const matches = (current: unknown, from: string[]) => from.some((f) => norm(f) === norm(current));
const getPath = (o: any, path: (string | number)[]) => path.reduce((v, k) => (v == null ? undefined : v[k]), o);

/** Text in a Website-content document: pages/landing, pages/partners, settings/hero … */
const DOC_UPDATES: { collection: string; slug: string; path: (string | number)[]; from: string[]; to: string }[] = [
  // The lead-in went to "The Gap:" in October; after reworking the landing copy the client asked for the original back (November 2026).
  { collection: 'pages', slug: 'landing', path: ['soundFamiliar'], from: ['The Gap:'], to: 'Sound familiar?' },
  { collection: 'pages', slug: 'landing', path: ['stepsHint'], from: ['4 short steps · about 2 minutes', '4 quick steps · about 2 minutes'], to: '4 short questions · a 15-min call to see if there’s a fit' },
  { collection: 'pages', slug: 'landing', path: ['proof', 0, 'text'], from: ['Readiness across ERP, PM, and HR'], to: 'Readiness across ERP, CRM, and HR' },
  { collection: 'pages', slug: 'landing', path: ['proof', 1, 'title'], from: ['Senior lead, flexible bench'], to: 'One accountable lead' },
  { collection: 'pages', slug: 'landing', path: ['proof', 1, 'text'], from: ['Contract associates for production work'], to: 'Associates handle build work under my direction.' },
  { collection: 'pages', slug: 'partners', path: ['chartNote'], from: ['PLACEHOLDER: replace this two-column summary with the final “what we cover, what you cover” chart.'], to: '' },
  // Go-live slider (November 2026 live check): the far-right readout still carried the old right-hand label, and the kickoff advice had a typo.
  { collection: 'settings', slug: 'golive', path: ['afterGoLive'], from: ['Kickoff · 12 months'], to: 'After go-live' },
  { collection: 'settings', slug: 'golive', path: ['advice', 'kickoff'], from: ['Program funded, SI selected, date set. Start preparing the change, before deign sessions begins.'], to: 'Program funded, SI selected, date set. Start preparing the change, before design sessions begin.' },
  // Home hero, line 2: "ready?" in teal instead of "Will they be" (runs after the two-line conversion below).
  { collection: 'settings', slug: 'hero', path: ['headlineLine2'], from: ['*Will they be* ready?'], to: 'Will they be *ready?*' },
];
/** The lead message (hero quote + first card) of a landing page. `from` lists every earlier wording it may still hold. */
const MESSAGE_UPDATES: { slug: string; index: number; from: string[]; to: string }[] = [
  { slug: 'operations', index: 0, from: ['Your Systems Integrator (SI) will get the system live. Who’s making sure your people can run the operation on day one?'],
    to: 'One senior change lead, accountable to you from the first design session to go-live. No team for you to manage.' },
  { slug: 'integration', index: 0, from: ['Integration plans cover systems and contracts. Synergies depend on whether two workforces actually work as one.', 'Jennifer Eichenberg, Change Management Lead. One owner for the people side of the integration, alongside finance, legal and IT. No team for you to manage.'],
    to: 'Integration plans cover systems and contracts. I own the people side, so two workforces can work as one.' },
  { slug: 'si-partners', index: 0, from: ['When adoption stalls, the client blames the implementation. A readiness check protects your go-live and your relationship.', 'When adoption stalls, the client blames the implementation. I add the people side to your delivery, under your SOW or your brand.'],
    to: 'Jennifer Eichenberg, Change Management Lead. Preparing people for new systems since 2007; Prosci, CMCP and CCP certified. References on request.' },
];
/** Contact form "Where are you?" choices (Dashboard → Settings → Pick-lists), matched by code. */
const SITUATION_UPDATES: { value: string; from: string[]; to: string }[] = [
  { value: 'funded', from: ['Program funded, Systems Integrator (SI) selected, go-live 6–12 months out'], to: 'Program funded, SI selected, go-live 6–12 months out' },
  { value: 'partner', from: ["I'm an SI partner with a won deal"], to: "I'm an SI partner" },
];
// Scale labels still in the old right-to-left order: the shipped originals, and the live relabelling ("After go-live").
const OLD_TICK_SETS = [['Go-live + 90 days', '≤ 90 days', 'Kickoff · 12 months'], ['After go-live', '≤ 90 days', 'Kickoff · 12 months']];

async function applyCopyUpdates() {
  let n = 0;
  const applied = (what: string) => { n++; console.log('[boot] copy update:', what); };
  const doc = (collection: string, slug: string) => one<{ data: any }>('select data from content where collection = $1 and slug = $2', [collection, slug]);
  const saveDoc = (collection: string, slug: string, data: any) => q('update content set data = $3, updated_at = now() where collection = $1 and slug = $2', [collection, slug, JSON.stringify(data)]);

  // Homepage hero: the four "teal word / rest" fields became two lines with the teal words in *asterisks*.
  const hero = await doc('settings', 'hero');
  if (hero && hero.data.headlineLine1 === undefined && (hero.data.headlineAccent1 !== undefined || hero.data.headlineRest1 !== undefined)) {
    const compose = (teal?: string, rest?: string) => [teal ? `*${teal}*` : '', rest || ''].filter(Boolean).join(' ').trim();
    hero.data.headlineLine1 = compose(hero.data.headlineAccent1, hero.data.headlineRest1);
    hero.data.headlineLine2 = compose(hero.data.headlineAccent2, hero.data.headlineRest2);
    await saveDoc('settings', 'hero', hero.data); applied('hero headline → two lines');
  }
  // Go-live slider: the scale now runs kickoff (left) → go-live + 90 days (right). Flip the labels if they are still the originals.
  const golive = await doc('settings', 'golive');
  const oldTicks = golive && Array.isArray(golive.data.ticks) && golive.data.ticks.length === 3 ? OLD_TICK_SETS.find((set) => golive.data.ticks.every((t: unknown, i: number) => norm(t) === norm(set[i]))) : undefined;
  if (golive && oldTicks) {
    golive.data.ticks = [...oldTicks].reverse();
    await saveDoc('settings', 'golive', golive.data); applied('go-live slider labels reversed');
  }
  for (const u of DOC_UPDATES) {
    const row = await doc(u.collection, u.slug);
    if (!row || !matches(getPath(row.data, u.path), u.from)) continue;
    const parent = getPath(row.data, u.path.slice(0, -1)); if (parent == null || typeof parent !== 'object') continue;
    parent[u.path[u.path.length - 1]] = u.to;
    await saveDoc(u.collection, u.slug, row.data); applied(`${u.collection}/${u.slug} ${u.path.join('.')}`);
  }
  for (const u of MESSAGE_UPDATES) {
    const row = await one<{ messages: any }>('select messages from landing_pages where slug = $1', [u.slug]);
    const messages = Array.isArray(row?.messages) ? row!.messages : null;
    if (!messages || !messages[u.index] || !matches(messages[u.index].text, u.from)) continue;
    messages[u.index].text = u.to;
    await q('update landing_pages set messages = $2, updated_at = now() where slug = $1', [u.slug, JSON.stringify(messages)]); applied(`landing ${u.slug} message ${u.index + 1}`);
  }
  // Lead-magnet titles that are still the shipped placeholders: clear them, so the thank-you panel shows no guide box until a real title is set.
  for (const r of await q<{ slug: string }>("update landing_pages set magnet_title = null, updated_at = now() where magnet_title like 'PLACEHOLDER:%' returning slug")) applied(`landing ${r.slug} placeholder guide title cleared`);
  // Per-page hero photos, for pages that have none yet.
  for (const p of PERSONAS as any[]) if (p.heroImage) {
    const r = await q('update landing_pages set hero_image = $2, updated_at = now() where slug = $1 and hero_image is null returning slug', [p.slug, p.heroImage]);
    if (r.length) applied(`landing ${p.slug} hero image`);
  }
  const dash = await one<{ data: any }>("select data from settings where key = 'dashboard'");
  const situations = dash?.data?.lists?.situations;
  if (Array.isArray(situations)) {
    let changed = false;
    for (const u of SITUATION_UPDATES) for (const s of situations) if (s?.value === u.value && matches(s.label, u.from)) { s.label = u.to; changed = true; applied(`contact choice “${u.value}”`); }
    if (changed) await q("update settings set data = $1, updated_at = now() where key = 'dashboard'", [JSON.stringify(dash!.data)]);
  }
  if (n) console.log('[boot] applied', n, 'copy update(s)');
}

// ---------- Sales process (November 2026) ----------
// The pipeline used to be five fixed stages with a name and a question each. Stages now carry their call guide, gate and
// capture fields, and can be added or removed in Settings. This runs once per database (marker row in `settings`): it
// upgrades the stored stages in place, keeping any name or question the admin had already changed, and renames the offers
// to the ones in the client's sales-process deck — but only while the stored offer list is still the one that shipped.
const OLD_STAGES = [['Exploration', 'What are the reasons to talk?'], ['Discovery', 'What are the needs?'], ['Scoping', 'What could we do together?'], ['Preparation', 'What else do you need before we start?'], ['Continuation', 'What comes next for us?']];
const OFFER_RENAMES: [string, string][] = [['Anchor + Role Readiness', 'OCM Leadership + Project Role Readiness'], ['Anchor', 'OCM Leadership'], ['Role Readiness', 'Project Role Readiness']];
async function applySalesProcess() {
  if (await one("select 1 from settings where key = 'sales_process_v2'")) return;
  const row = await one<{ data: any }>("select data from settings where key = 'dashboard'");
  const data = row?.data;
  if (data && Array.isArray(data.stages) && data.stages.some((s: any) => !s?.id)) {
    const untouched = data.stages.length === 5 && data.stages.every((s: any, i: number) => norm(s?.name) === norm(OLD_STAGES[i][0]) && norm(s?.question) === norm(OLD_STAGES[i][1]));
    const signedFrom = Math.max(0, Number(data.signedFromStage || 4) - 1);
    data.stages = data.stages.map((s: any, i: number) => {
      const def: any = DEFAULT_SETTINGS.stages[i] || {}; const old = OLD_STAGES[i] || [];
      return normStage({ ...def, id: def.id,
        name: !s?.name || norm(s.name) === norm(old[0]) ? def.name || s?.name : s.name,
        question: !s?.question || norm(s.question) === norm(old[1]) ? def.question ?? s?.question : s.question,
        countsAsSigned: untouched ? !!def.countsAsSigned : i >= signedFrom });
    });
    delete data.signedFromStage;
    const offers = data.lists?.offers;
    if (Array.isArray(offers) && offers.length === OLD_OFFERS.length && offers.every((o: unknown, i: number) => norm(o) === norm(OLD_OFFERS[i]))) {
      data.lists.offers = DEFAULT_SETTINGS.lists.offers;
      for (const [from, to] of OFFER_RENAMES) await q('update deals set offer = $2 where offer = $1', [from, to]);
    }
    if (Array.isArray(data.lists?.sources) && !data.lists.sources.includes('Contact form')) data.lists.sources.push('Contact form');
    await q("update settings set data = $1, updated_at = now() where key = 'dashboard'", [JSON.stringify(data)]);
    console.log('[boot] sales process: stages upgraded' + (untouched ? ' to the four-stage process plus onboarding' : ' (custom stage names kept)'));
  }
  await q("insert into settings (key, data) values ('sales_process_v2', 'true') on conflict do nothing");
  clearSettingsCache();
}
