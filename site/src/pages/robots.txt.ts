import type { APIRoute } from 'astro';
import { siteUrl } from '../lib/env';
export const GET: APIRoute = () => new Response(`User-agent: *\nAllow: /\nDisallow: /dashboard\nDisallow: /login\nDisallow: /for/\nDisallow: /api/\nSitemap: ${siteUrl()}/sitemap.xml\n`, { headers: { 'content-type': 'text/plain; charset=utf-8' } });
