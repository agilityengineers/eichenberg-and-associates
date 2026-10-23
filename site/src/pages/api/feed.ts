import type { APIRoute } from 'astro';
import { allPosts } from '../../lib/feeds';
// Live JSON of merged posts (local Insights + RSS feeds). FeedList refreshes from this in the browser.
export const GET: APIRoute = async ({ url }) => {
  const { items } = await allPosts(Math.min(50, Math.max(1, Number(url.searchParams.get('limit')) || 24)));
  // Feed errors stay server-side (signed-in admins see them on the page and under Website content → Insights feed).
  return new Response(JSON.stringify({ items }), { headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=300, s-maxage=900, stale-while-revalidate=3600' } });
};
