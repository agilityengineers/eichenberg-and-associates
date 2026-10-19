import type { APIRoute } from 'astro';
import { getDocs } from '../lib/content';
import { siteUrl } from '../lib/env';
export const GET: APIRoute = async () => {
  const base = siteUrl();
  const paths = ['/', '/services', '/who-we-serve', '/partners', '/about', '/insights', '/contact', '/privacy', '/terms',
    ...(await getDocs('services')).map((d) => '/services/' + d.slug),
    ...(await getDocs('insights', (d) => !d.data.draft)).map((d) => '/insights/' + d.slug),
    ...(await getDocs('custom-pages', (d) => !!d.data.published)).map((d) => '/p/' + d.slug)];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${paths.map((p) => `  <url><loc>${base}${p === '/' ? '/' : p}</loc></url>`).join('\n')}\n</urlset>\n`;
  return new Response(xml, { headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=3600' } });
};
