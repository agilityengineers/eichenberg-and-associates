// Website copy. The files in src/content/** are the version-controlled defaults; on first boot they are copied into
// the `content` table, and from then on the dashboard's Website content editor is the source of truth.
import matter from 'gray-matter';
import { marked } from 'marked';
import { dbConfigured, q } from './db';

export type Doc = { collection: string; slug: string; data: any; body: string; updatedAt?: string };

const files = import.meta.glob('/src/content/**/*.{json,md}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
export const DEFAULTS: Doc[] = Object.entries(files).map(([path, raw]) => {
  const [, collection, file] = path.match(/^\/src\/content\/([^/]+)\/(.+)\.(?:json|md)$/) || [];
  if (path.endsWith('.json')) return { collection, slug: file, data: JSON.parse(raw), body: '' };
  const fm = matter(raw); const { slug, ...data } = fm.data;   // a front-matter `slug` (page builder) wins over the file name
  return { collection, slug: slug || file, data: JSON.parse(JSON.stringify(data)), body: fm.content.replace(/<!--[\s\S]*?-->/g, '').trim() };
}).filter((d) => d.collection);

/** Collections with one row per page/settings file. Everything else is a list of entries. */
export const SINGLETON_COLLECTIONS = ['pages', 'settings'];

const isObj = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
/** Stored values win; keys missing from an older stored row fall back to the current default (arrays replace wholesale). */
export function withDefaults(base: any, over: any): any {
  if (!isObj(base) || !isObj(over)) return over === undefined ? base : over;
  const out: Record<string, any> = { ...base };
  for (const [k, v] of Object.entries(over)) out[k] = withDefaults(base[k], v);
  return out;
}

const TTL = 10_000;
const cache = new Map<string, { at: number; docs: Doc[] }>();
export const invalidate = (collection?: string) => (collection ? cache.delete(collection) : cache.clear());

async function load(collection: string): Promise<Doc[]> {
  const defaults = DEFAULTS.filter((d) => d.collection === collection);
  if (!dbConfigured()) return defaults;
  const hit = cache.get(collection); if (hit && Date.now() - hit.at < TTL) return hit.docs;
  try {
    const rows = await q<{ slug: string; data: any; body: string; updated_at: Date }>('select slug, data, body, updated_at from content where collection = $1', [collection]);
    const docs: Doc[] = rows.map((r) => { const def = defaults.find((d) => d.slug === r.slug); return { collection, slug: r.slug, data: def ? withDefaults(def.data, r.data) : r.data, body: r.body, updatedAt: r.updated_at.toISOString() }; });
    if (SINGLETON_COLLECTIONS.includes(collection)) for (const d of defaults) if (!docs.some((x) => x.slug === d.slug)) docs.push(d);
    cache.set(collection, { at: Date.now(), docs }); return docs;
  } catch (e) { console.error('[content] falling back to defaults:', (e as Error).message); return defaults; }
}

export async function getDoc(collection: string, slug: string): Promise<Doc> {
  const d = (await load(collection)).find((x) => x.slug === slug) || DEFAULTS.find((x) => x.collection === collection && x.slug === slug);
  if (!d) throw new Error(`Missing content ${collection}/${slug}`);
  return d;
}
/** Shortcut for a singleton's data object. */
export const page = async (slug: string) => (await getDoc('pages', slug)).data;
export const setting = async (slug: string) => (await getDoc('settings', slug)).data;

export async function getDocs(collection: string, filter?: (d: Doc) => boolean): Promise<Doc[]> {
  return (await load(collection)).filter(filter || (() => true)).sort((a, b) => (Number(a.data.order) || 0) - (Number(b.data.order) || 0) || a.slug.localeCompare(b.slug));
}

export const md = (s: string) => marked.parse(s || '', { async: false }) as string;
