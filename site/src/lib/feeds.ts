// Server-side feed fetching with an in-memory cache, merged with the site's own Insights posts. Parsing lives in
// feed-parse.ts. Fetched on the server only — page render + /api/feed — never from the browser, so no CORS issues.
import { getDocs, setting } from './content';
import { iso, parseFeed, type FeedItem } from './feed-parse';
export { fmtDate, type FeedItem } from './feed-parse';

type Cached = { at: number; items: FeedItem[]; okAt?: number; error?: string };
const cache = new Map<string, Cached>();
const inflight = new Map<string, Promise<FeedItem[]>>();
const RETRY_MS = 5 * 60_000;

export async function fetchFeed(url: string, name?: string, cacheMinutes = 30): Promise<FeedItem[]> {
  const ttl = (Number(cacheMinutes) || 30) * 60_000;
  const hit = cache.get(url); if (hit && Date.now() - hit.at < ttl) { if (hit.error && !hit.okAt) throw new Error(hit.error); return hit.items; }
  const running = inflight.get(url); if (running) return running;
  const job = (async () => {
    try {
      if (!/^https?:$/.test(new URL(url).protocol)) throw new Error('not an http(s) address');
      const r = await fetch(url, { signal: AbortSignal.timeout(8000), redirect: 'follow', headers: { 'user-agent': 'EichenbergSite/1.0 (+https://eichenbergassociates.com)', accept: 'application/rss+xml, application/atom+xml, application/feed+json, application/json, text/xml, application/xml, */*' } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const items = parseFeed(await r.text(), url, name);
      cache.set(url, { at: Date.now(), okAt: Date.now(), items }); return items;
    } catch (e) {
      const msg = e instanceof Error ? (e.name === 'TimeoutError' ? 'timed out after 8 seconds' : e.message) : String(e);
      // Keep showing the last good copy and try again in a few minutes rather than blanking the page.
      if (hit?.okAt) { cache.set(url, { ...hit, at: Date.now() - ttl + RETRY_MS, error: msg }); return hit.items; }
      cache.set(url, { at: Date.now() - ttl + RETRY_MS, items: [], error: msg });
      throw new Error(msg);
    } finally { inflight.delete(url); }
  })();
  inflight.set(url, job); return job;
}

type Source = { name?: string; url?: string; enabled?: boolean };
const sources = (feeds: any): Source[] => (Array.isArray(feeds?.sources) ? feeds.sources : []).filter((s: Source) => s && typeof s === 'object');
const live = (feeds: any) => sources(feeds).filter((s) => s.enabled && s.url && !String(s.url).includes('PLACEHOLDER'));

/** All enabled remote feeds + local Insights posts, newest first. Errors in one feed never break the page. */
export async function allPosts(limit = 50): Promise<{ items: FeedItem[]; errors: string[] }> {
  const errors: string[] = [];
  const [feeds, site] = await Promise.all([setting('feeds'), setting('site')]);
  const remote = await Promise.all(live(feeds).map((s) => fetchFeed(String(s.url).trim(), s.name, feeds.cacheMinutes).catch((e) => { errors.push(`${s.name || s.url}: ${e.message}`); return [] as FeedItem[]; })));
  const local = (await getDocs('insights', (d) => !d.data.draft)).map((p): FeedItem => ({ title: p.data.title, link: '/insights/' + p.slug, excerpt: p.data.description, date: iso(p.data.date), source: site.name || 'Eichenberg & Associates', tag: p.data.tag, local: true }));
  const seen = new Set<string>();
  const items = [...local, ...remote.flat()].filter((i) => { const k = i.link.replace(/\/+$/, ''); if (seen.has(k)) return false; seen.add(k); return true; })
    .sort((a, b) => +new Date(b.date || 0) - +new Date(a.date || 0)).slice(0, limit);
  return { items, errors };
}

export type FeedHealth = { name: string; url: string; enabled: boolean; count: number; images: number; error?: string; fetchedAt?: string };
/** Per-source health for the dashboard's Insights feed page. Never throws. */
export async function checkFeeds(feeds: any): Promise<FeedHealth[]> {
  return Promise.all(sources(feeds).map(async (s): Promise<FeedHealth> => {
    const url = String(s.url || '').trim(), name = String(s.name || url || 'Untitled feed');
    const base = { name, url, enabled: !!s.enabled, count: 0, images: 0 };
    if (!s.enabled || !url) return base;
    if (url.includes('PLACEHOLDER')) return { ...base, error: 'placeholder address — replace it with the real feed URL' };
    try { const items = await fetchFeed(url, s.name, feeds.cacheMinutes); const c = cache.get(url);
      return { ...base, count: items.length, images: items.filter((i) => i.image).length, error: c?.error, fetchedAt: c?.okAt ? new Date(c.okAt).toISOString() : undefined };
    } catch (e) { return { ...base, error: (e as Error).message }; }
  }));
}
