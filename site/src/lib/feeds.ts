// Server-side RSS/Atom/JSON Feed reader with in-memory cache. Works with standard feeds and rss.app
// (rss.app exposes .xml RSS and .json JSON Feed URLs — both parse here). Fetched at request time via /api/feed
// and at build time for the static pages; never from the browser, so no CORS issues.
import { XMLParser } from 'fast-xml-parser';
import feeds from '../content/settings/feeds.json';
import { getCollection } from 'astro:content';

export type FeedItem = { title: string; link: string; excerpt: string; date: string; source: string; local?: boolean };
const cache = new Map<string, { at: number; items: FeedItem[] }>();
const strip = (s: unknown) => String(s ?? '').replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim();
const text = (v: any) => typeof v === 'string' ? v : v?.['#text'] ?? v?.href ?? '';

export async function fetchFeed(url: string, name?: string): Promise<FeedItem[]> {
  const hit = cache.get(url); if (hit && Date.now() - hit.at < (feeds.cacheMinutes || 30) * 60_000) return hit.items;
  const r = await fetch(url, { headers: { 'user-agent': 'EichenbergSite/1.0 (+https://eichenbergassociates.com)', accept: 'application/rss+xml, application/atom+xml, application/feed+json, application/json, text/xml, */*' } });
  if (!r.ok) throw new Error(`feed ${url} → ${r.status}`);
  const body = await r.text(); let items: FeedItem[] = [];
  if (body.trim().startsWith('{')) {                       // JSON Feed
    const j = JSON.parse(body); const src = name || j.title || new URL(url).hostname;
    items = (j.items || []).map((it: any) => ({ title: strip(it.title), link: it.url || it.external_url, excerpt: strip(it.summary || it.content_text || it.content_html).slice(0, 200), date: it.date_published || it.date_modified || '', source: src }));
  } else {                                                  // RSS 2.0 / Atom
    const x = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', textNodeName: '#text' }).parse(body);
    const ch = x.rss?.channel; const atom = x.feed; const src = name || strip(text(ch?.title ?? atom?.title)) || new URL(url).hostname;
    const list = ch ? [].concat(ch.item || []) : [].concat(atom?.entry || []);
    items = list.map((it: any) => { const linkRaw = Array.isArray(it.link) ? (it.link.find((l: any) => !l.rel || l.rel === 'alternate') ?? it.link[0]) : it.link;
      return { title: strip(text(it.title)), link: text(linkRaw) || text(it.guid), excerpt: strip(it.description ?? it.summary ?? it['content:encoded'] ?? text(it.content)).slice(0, 200), date: it.pubDate ?? it.published ?? it.updated ?? it['dc:date'] ?? '', source: src }; });
  }
  items = items.filter((i) => i.title && i.link);
  cache.set(url, { at: Date.now(), items }); return items;
}

/** All enabled remote feeds + local Insights posts, newest first. Errors in one feed never break the page. */
export async function allPosts(limit = 50): Promise<{ items: FeedItem[]; errors: string[] }> {
  const errors: string[] = [];
  const remote = await Promise.all(feeds.sources.filter((s) => s.enabled && s.url && !s.url.includes('PLACEHOLDER')).map((s) => fetchFeed(s.url, s.name).catch((e) => { errors.push(`${s.name}: ${e.message}`); return [] as FeedItem[]; })));
  const local = (await getCollection('insights', ({ data }) => !data.draft)).map((p) => ({ title: p.data.title, link: '/insights/' + p.slug, excerpt: p.data.description, date: p.data.date.toISOString(), source: 'Eichenberg & Associates', local: true }));
  const items = [...local, ...remote.flat()].sort((a, b) => +new Date(b.date || 0) - +new Date(a.date || 0)).slice(0, limit);
  return { items, errors };
}
export const fmtDate = (d: string) => { const x = new Date(d); return isNaN(+x) ? '' : x.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); };
