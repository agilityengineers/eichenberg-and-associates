// Pure RSS 2.0 / Atom / JSON Feed parsing — no network, no cache, no database — so it can be tested on its own.
// Handles standard feeds (WordPress, Ghost, Substack, Medium…) and rss.app (.xml RSS or .json JSON Feed), and finds
// each post's image wherever the feed puts it: media:content, media:thumbnail, enclosure, itunes:image, Atom
// link[rel=enclosure], JSON Feed image/banner_image/attachments, or the first real <img> in the post's HTML.
import { XMLParser } from 'fast-xml-parser';

export type FeedItem = {
  title: string; link: string; excerpt: string; date: string; source: string;
  tag?: string;            // first category (local posts: the post's tag); the card label falls back to `source`
  image?: string;          // absolute https URL, when the feed provides one
  local?: boolean;         // a post written in the dashboard (/insights/<slug>)
};

// ---------- text ----------
const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…', mdash: '—', ndash: '–', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', copy: '©', reg: '®', trade: '™', laquo: '«', raquo: '»' };
const cp = (n: number) => (n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : '');
const decode = (s: string) => s.replace(/&#x([0-9a-f]+);/gi, (_, h) => cp(parseInt(h, 16))).replace(/&#(\d+);/g, (_, d) => cp(+d)).replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);
/** HTML → plain text: drop tags, decode entities, collapse whitespace. */
export const strip = (v: unknown) => decode(String(v ?? '').replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').replace(/\s+([.,;:!?)\]])/g, '$1').trim();
/** Plain-text summary cut at a word boundary. Drops WordPress's trailing “[…]” and Yoast's “The post … appeared first on …”. */
export function excerpt(html: unknown, max = 180): string {
  const s = strip(html).replace(/\s*\[(…|\.{3})\]\s*$/, '…').replace(/\s*The post .+? appeared first on .+?\.?\s*$/, '').trim();
  if (s.length <= max) return s;
  const cut = s.slice(0, max + 1), sp = cut.lastIndexOf(' ');
  return (sp > max * 0.6 ? cut.slice(0, sp) : cut.slice(0, max)).replace(/[\s,;:–—-]+$/, '') + '…';
}
const text = (v: any): string => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : v?.['#text'] ?? v?.href ?? '');
const list = <T>(v: T | T[] | null | undefined): T[] => (v == null ? [] : Array.isArray(v) ? v : [v]);
export const iso = (d: unknown) => { const x = new Date(String(d ?? '')); return isNaN(+x) ? '' : x.toISOString(); };
export const fmtDate = (d: string) => { const x = new Date(d); return isNaN(+x) ? '' : x.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }); };

// ---------- URLs ----------
/** Absolute http(s) URL or nothing. Images are upgraded to https: the site's CSP (and browsers) refuse http images on an https page. */
const absUrl = (src: unknown, base: string, upgrade = false): string | undefined => {
  if (typeof src !== 'string' || !src.trim()) return;
  try { const u = new URL(src.trim(), base); if (upgrade && u.protocol === 'http:') u.protocol = 'https:'; return /^https?:$/.test(u.protocol) ? u.href : undefined; } catch { return; }
};
const IMG_EXT = /\.(jpe?g|png|gif|webp|avif)(\?|#|$)/i;
const isImg = (type: unknown, url?: string) => String(type || '').toLowerCase().startsWith('image/') || (!!url && IMG_EXT.test(url));
/** First real <img> in an HTML fragment: skips tracking pixels, emoji, icons and lazy-load placeholders. */
function imgFromHtml(html: unknown): string | undefined {
  for (const tag of String(html ?? '').match(/<img\b[^>]*>/gi) || []) {
    if (/\s(?:width|height)\s*=\s*["']?1(?:px)?["'\s/>]/i.test(tag)) continue;
    const attr = (n: string) => tag.match(new RegExp(`\\s${n}\\s*=\\s*["']([^"']+)["']`, 'i'))?.[1];
    const src = attr('data-lazy-src') || attr('data-src') || attr('src');
    if (!src || /^data:/i.test(src) || /pixel\.wp\.com|feedburner\.com|\/emoji\/|\.svg(\?|#|$)/i.test(src)) continue;
    return src;
  }
}
function mediaImage(it: any): string | undefined {
  for (const m of [...list<any>(it['media:content']), ...list<any>(it['media:group']?.['media:content'])]) {
    if (m?.url && (m.medium === 'image' || isImg(m.type, m.url))) return m.url;
    const t = list<any>(m?.['media:thumbnail'])[0]; if (t?.url) return t.url;
  }
  const th = list<any>(it['media:thumbnail'])[0]; if (th?.url) return th.url;
  for (const e of list<any>(it.enclosure)) if (e?.url && isImg(e.type, e.url)) return e.url;
  if (it['itunes:image']?.href) return it['itunes:image'].href;
}
const firstTag = (cats: unknown[]) => cats.map((c: any) => strip(c && typeof c === 'object' ? c.term || c.label || text(c) : c)).find((c) => c && !/^uncategori[sz]ed$/i.test(c));

// ---------- parsing ----------
/** Parse an RSS 2.0, Atom or JSON Feed document into posts, newest first as the feed lists them. */
export function parseFeed(body: string, url: string, name?: string): FeedItem[] {
  let items: FeedItem[] = [];
  const host = (() => { try { return new URL(url).hostname; } catch { return 'feed'; } })();
  if (body.trim().startsWith('{')) {                                                          // JSON Feed (rss.app offers this too)
    const j = JSON.parse(body); const src = name || strip(j.title) || host;
    items = list<any>(j.items).map((it) => { const link = absUrl(it.url || it.external_url, url) || '';
      return { title: strip(it.title), link, excerpt: excerpt(it.summary || it.content_text || it.content_html), date: iso(it.date_published || it.date_modified), source: src, tag: firstTag(list(it.tags)),
        image: absUrl(it.image || it.banner_image || list<any>(it.attachments).find((a) => isImg(a?.mime_type, a?.url))?.url || imgFromHtml(it.content_html), link || url, true) }; });
  } else {                                                                                    // RSS 2.0 / RSS 1.0 / Atom
    const x = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', textNodeName: '#text', parseTagValue: false }).parse(body);
    const ch = x.rss?.channel ?? x['rdf:RDF'], atom = x.feed;
    const src = name || strip(text(ch?.title ?? atom?.title)) || host;
    items = (ch ? list<any>(ch.item) : list<any>(atom?.entry)).map((it) => {
      const links = list<any>(it.link);
      const alt = links.find((l) => typeof l === 'string' || !l?.rel || l.rel === 'alternate') ?? links[0];
      const link = absUrl(text(alt) || text(it.guid), url) || '';
      const enclosure = links.find((l) => l?.rel === 'enclosure' && isImg(l.type, l.href))?.href;
      // Elements with attributes (e.g. <summary type="html">) parse as objects, so always go through text().
      const description = text(it.description), summary = text(it.summary), encoded = text(it['content:encoded']), content = text(it.content);
      return { title: strip(text(it.title)), link, excerpt: excerpt(description || summary || encoded || content), date: iso(text(it.pubDate) || text(it.published) || text(it.updated) || text(it['dc:date'])), source: src, tag: firstTag(list(it.category)),
        image: absUrl(mediaImage(it) || enclosure || imgFromHtml(encoded) || imgFromHtml(description) || imgFromHtml(content) || imgFromHtml(summary), link || url, true) };
    });
  }
  return items.filter((i) => i.title && i.link);
}
