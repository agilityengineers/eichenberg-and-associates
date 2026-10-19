// Shared numbers and labels for the sales dashboard.
import { one, q } from './db';
import type { Settings } from './settings';

export const GRID_SHORT: Record<string, string> = { nn: 'Can’t lead · Can’t do', nd: 'Can’t lead · Can do', ln: 'Can lead · Can’t do', ld: 'Can lead · Can do' };
export const money = (n: number) => (n >= 1000 ? '$' + Math.round(n / 1000) + 'K' : '$' + Math.round(n));
export const shortDate = (d: Date | string | null) => { if (!d) return '—'; const x = new Date(d); return isNaN(+x) ? String(d) : x.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }); };
/** BD budget in hours: 10% of the proposed fee at $200/h, or 15h when there is no fee yet. */
export const bdCap = (fee: number | null) => (fee ? Math.round((Number(fee) * 0.1) / 200) : 15);

export async function navCounts() {
  return (await one<{ leads: number; deals: number; active: number; pages: number; subs: number }>(`select
    (select count(*) from leads where deal_id is null)::int as leads, (select count(*) from deals)::int as deals,
    (select count(*) from partners where status = 2)::int as active, (select count(*) from landing_pages)::int as pages,
    (select count(*) from subscribers)::int as subs`))!;
}
export async function bdHours(days = 7) {
  return Number((await one<{ h: string }>(`select coalesce(sum(hours), 0) as h from activities where kind = 'bd' and at > now() - ($1 || ' days')::interval`, [days]))!.h);
}
export const quarterLabel = (d = new Date()) => `Q${Math.floor(d.getMonth() / 3) + 1} ${d.getFullYear()}`;

/** Status of each tripwire for the Overview. */
export async function tripwireStatus(s: Settings) {
  const week = await bdHours(7), month = await bdHours(28);
  const share = s.bridge.revenue > 0 ? Math.round((s.bridge.income / s.bridge.revenue) * 100) : null;
  return s.tripwires.map((t: any) => {
    if (t.metric === 'bd_hours') { const lvl = month / 4 < t.threshold ? 'tripped' : week < t.threshold ? 'watch' : 'clear'; return { rule: t.rule, level: lvl, status: `${week}h this week · ${lvl === 'clear' ? 'clear' : lvl === 'watch' ? 'watch' : 'tripped'}` }; }
    if (t.metric === 'bridge_share') { if (share === null) return { rule: t.rule, level: 'clear', status: 'Add this year’s bridge income in Settings' }; const lvl = share >= t.threshold ? 'tripped' : share >= t.threshold - 10 ? 'watch' : 'clear'; return { rule: t.rule, level: lvl, status: `${share}% · ${lvl}` }; }
    return { rule: t.rule, level: t.level || 'clear', status: t.status || '' };
  });
}
export const LEVEL_COLOR: Record<string, string> = { clear: '#14B6A1', watch: '#E0A82E', tripped: '#B3261E' };
export { q };
