import type { APIRoute } from 'astro';
import { allPosts } from '../../lib/feeds';
export const prerender = false;
// Live JSON of merged posts; the static pages hydrate from this so new blog posts appear without a rebuild.
export const GET: APIRoute = async ({ url }) => {
  const { items, errors } = await allPosts(Number(url.searchParams.get('limit') || 24));
  return new Response(JSON.stringify({ items, errors }), { headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=300, s-maxage=900, stale-while-revalidate=3600' } });
};
