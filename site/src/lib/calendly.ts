// Calendly sync: keeps booked calls in step with the pipeline.
//   - /api/calendly/webhook receives invitee.created / invitee.canceled from Calendly (signed with CALENDLY_WEBHOOK_SIGNING_KEY)
//   - Settings → Calendly connects the account (CALENDLY_TOKEN), and "Sync now" pulls upcoming calls as a back-stop
// Config is read from process.env at request time (Replit Secrets). Nothing is written to disk.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { one, q, tx } from './db';
import { env, siteUrl } from './env';
import { getSettings } from './settings';

const base = () => env('CALENDLY_API_BASE', 'https://api.calendly.com').replace(/\/$/, '');
export const calendlyToken = () => env('CALENDLY_TOKEN');
export const signingKey = () => env('CALENDLY_WEBHOOK_SIGNING_KEY');
export const webhookUrl = () => siteUrl() + '/api/calendly/webhook';
const EVENTS = ['invitee.created', 'invitee.canceled'];

// ---------- connection state (one row in `settings`) ----------
export type CalendlyState = { user?: string; organization?: string; subscription?: string; timezone?: string; connectedAt?: string; lastSync?: string; lastEvent?: string };
export const getState = async (): Promise<CalendlyState> => (await one<{ data: CalendlyState }>("select data from settings where key = 'calendly'"))?.data || {};
const saveState = (s: CalendlyState) => q("insert into settings (key, data, updated_at) values ('calendly', $1, now()) on conflict (key) do update set data = excluded.data, updated_at = now()", [JSON.stringify(s)]);
export const validZone = (tz: string) => { try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true; } catch { return false; } };
export const timezone = (s: CalendlyState) => (s.timezone && validZone(s.timezone) ? s.timezone : 'America/Chicago');
export async function setTimezone(tz: string) { await saveState({ ...(await getState()), timezone: tz }); }

/** "Tue, Nov 24 · 2:00 PM CST" in the dashboard's time zone. */
export const callTime = (d: Date | string, tz: string) => new Date(d).toLocaleString('en-US', { timeZone: tz, weekday: 'short', month: 'short', day: 'numeric' }) + ' · ' + new Date(d).toLocaleString('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
const dayIn = (d: Date, tz: string) => new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);   // YYYY-MM-DD

// ---------- signature ----------
/** Calendly-Webhook-Signature: t=<unix seconds>,v1=<hex hmac-sha256 of "t.body">. Rejects anything older than three minutes. */
export function verifySignature(header: string | null, raw: string, key = signingKey(), now = Date.now()): boolean {
  if (!header || !key) return false;
  const parts = Object.fromEntries(header.split(',').map((p) => p.trim().split('=') as [string, string]));
  const t = Number(parts.t), sig = parts.v1 || '';
  if (!Number.isFinite(t) || !/^[0-9a-f]{64}$/i.test(sig) || Math.abs(now / 1000 - t) > 180) return false;
  const want = createHmac('sha256', key).update(`${parts.t}.${raw}`).digest();
  const got = Buffer.from(sig, 'hex');
  return got.length === want.length && timingSafeEqual(got, want);
}

// ---------- API client ----------
async function api<T = any>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = calendlyToken(); if (!token) throw new Error('CALENDLY_TOKEN is not set.');
  const r = await fetch(path.startsWith('http') ? path : base() + path, { method: init.method || 'GET', headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' }, body: init.body === undefined ? undefined : JSON.stringify(init.body), signal: AbortSignal.timeout(15_000) });
  if (r.status === 204) return undefined as T;
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(r.status === 401 ? 'Calendly did not accept the access token. Create a new one and update CALENDLY_TOKEN.' : r.status === 403 ? 'Calendly refused: ' + (j.message || 'this plan or token cannot use webhooks.') : `Calendly error ${r.status}: ${j.message || j.title || 'request failed'}`);
  return j as T;
}

/** Reads the account and makes sure one webhook subscription points at this site. Safe to run again. */
export async function connect(): Promise<CalendlyState> {
  if (!signingKey()) throw new Error('CALENDLY_WEBHOOK_SIGNING_KEY is not set.');
  const me = (await api('/users/me')).resource;
  const prev = await getState();
  const list = await api(`/webhook_subscriptions?scope=user&organization=${encodeURIComponent(me.current_organization)}&user=${encodeURIComponent(me.uri)}&count=100`);
  let sub = (list.collection || []).find((x: any) => x.callback_url === webhookUrl() && x.state !== 'disabled');
  if (!sub) sub = (await api('/webhook_subscriptions', { method: 'POST', body: { url: webhookUrl(), events: EVENTS, organization: me.current_organization, user: me.uri, scope: 'user', signing_key: signingKey() } })).resource;
  const state: CalendlyState = { ...prev, user: me.uri, organization: me.current_organization, subscription: sub.uri, timezone: prev.timezone || (me.timezone && validZone(me.timezone) ? me.timezone : undefined), connectedAt: new Date().toISOString() };
  await saveState(state); return state;
}
export async function disconnect() {
  const s = await getState();
  if (s.subscription && calendlyToken()) { try { await api(s.subscription, { method: 'DELETE' }); } catch (e) { console.error('[calendly] could not delete the subscription:', (e as Error).message); } }
  await saveState({ timezone: s.timezone });
}
/** Pulls upcoming calls from Calendly. Covers anything a missed notification dropped. */
export async function syncUpcoming(): Promise<number> {
  const s = await getState(); if (!s.user) throw new Error('Connect Calendly first.');
  const events = (await api(`/scheduled_events?user=${encodeURIComponent(s.user)}&status=active&min_start_time=${encodeURIComponent(new Date().toISOString())}&sort=start_time:asc&count=100`)).collection || [];
  let n = 0;
  for (const ev of events) for (const inv of (await api(ev.uri + '/invitees?count=100')).collection || []) {
    if (inv.status === 'canceled') continue;
    await applyBooking('invitee.created', { ...inv, scheduled_event: ev }); n++;
  }
  await saveState({ ...(await getState()), lastSync: new Date().toISOString() });
  return n;
}

// ---------- applying a booking to the pipeline ----------
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const s = (v: unknown, max = 500) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
const httpsOnly = (v: unknown) => { const u = s(v, 1000); return u && /^https:\/\//.test(u) ? u : null; };

/** `p` is the invitee object from the webhook payload (or the API), with its scheduled_event. */
export async function applyBooking(kind: string, p: any): Promise<{ ok: boolean; deal?: string; note?: string }> {
  const inviteeUri = s(p?.uri, 400); if (!inviteeUri) return { ok: false, note: 'no invitee uri' };
  let ev = p.scheduled_event && typeof p.scheduled_event === 'object' ? p.scheduled_event : null;
  const eventUri = s(ev?.uri, 400) || s(p.event, 400);
  if (!ev?.start_time && eventUri && calendlyToken()) { try { ev = (await api(eventUri)).resource; } catch { /* keep what we have */ } }
  const start = ev?.start_time && !isNaN(+new Date(ev.start_time)) ? new Date(ev.start_time) : null;
  const end = ev?.end_time && !isNaN(+new Date(ev.end_time)) ? new Date(ev.end_time) : null;
  const b = { inviteeUri, eventUri, eventName: s(ev?.name, 200) || 'Call', start, end, name: s(p.name, 200), email: s(p.email, 200)?.toLowerCase() || null,
    joinUrl: httpsOnly(ev?.location?.join_url), rescheduleUrl: httpsOnly(p.reschedule_url), cancelUrl: httpsOnly(p.cancel_url),
    leadId: UUID.test(String(p.tracking?.utm_content || '')) ? String(p.tracking.utm_content) : null, rescheduled: !!p.rescheduled };
  const state = await getState(); const tz = timezone(state);
  const firstStage = (await getSettings()).stages[0].name;

  const result = await tx(async (c) => {
    const existing = (await c.query('select * from bookings where invitee_uri = $1 for update', [b.inviteeUri])).rows[0];

    if (kind === 'invitee.canceled') {
      if (!existing) return { ok: true, note: 'unknown booking' };
      if (existing.status === 'canceled') return { ok: true, deal: existing.deal_id, note: 'already canceled' };
      await c.query("update bookings set status = 'canceled', updated_at = now() where id = $1", [existing.id]);
      // A reschedule cancels the old time and books a new one straight after; only a real cancellation changes the next step.
      if (!b.rescheduled && existing.deal_id) {
        const other = (await c.query("select 1 from bookings where deal_id = $1 and status = 'active' and start_at > now() limit 1", [existing.deal_id])).rows[0];
        if (!other) await c.query("update deals set next_step = 'Call canceled: rebook', next_due = current_date, updated_at = now() where id = $1 and status = 'open'", [existing.deal_id]);
      }
      return { ok: true, deal: existing.deal_id };
    }

    // invitee.created — find whose call this is: the lead id passed through the on-site calendar, then the email address.
    let dealId: string | null = existing?.deal_id || null, leadId: string | null = existing?.lead_id || null;
    if (!dealId) {
      let lead = b.leadId ? (await c.query('select * from leads where id = $1', [b.leadId])).rows[0] : null;
      if (!lead && b.email) lead = (await c.query('select * from leads where lower(email) = $1 order by (deal_id is not null) desc, created_at desc limit 1', [b.email])).rows[0];
      if (lead) { leadId = lead.id; dealId = lead.deal_id; }   // a partner inquiry has no deal; booking a call opens one
      if (!dealId && b.email) dealId = (await c.query('select deal_id from bookings where lower(email) = $1 and deal_id is not null order by created_at desc limit 1', [b.email])).rows[0]?.deal_id || null;
      if (!dealId) {   // booked from a bare Calendly link (outreach, email signature), or a lead that was never added to the pipeline
        const company = lead?.company || lead?.name || b.name || b.email || 'Calendly booking';
        const contact = lead ? lead.name + (lead.title ? ', ' + lead.title : '') : [b.name, b.email].filter(Boolean).join(' · ');
        dealId = (await c.query('insert into deals (company, contact, lead_id, stage, grid, source, next_step, next_due) values ($1, $2, $3, 0, $4, $5, $6, current_date) returning id',
          [company, contact, lead?.id || null, lead?.grid || null, lead ? (lead.source === 'contact' ? 'Contact form' : 'Content') : 'Calendly', firstStage + ' call'])).rows[0].id;
        if (lead) await c.query('update leads set deal_id = $1 where id = $2 and deal_id is null', [dealId, lead.id]);
      }
    }
    await c.query(`insert into bookings (invitee_uri, event_uri, event_name, start_at, end_at, status, name, email, join_url, reschedule_url, cancel_url, deal_id, lead_id)
      values ($1,$2,$3,$4,$5,'active',$6,$7,$8,$9,$10,$11,$12)
      on conflict (invitee_uri) do update set event_uri = excluded.event_uri, event_name = excluded.event_name, start_at = excluded.start_at, end_at = excluded.end_at, status = 'active',
        name = excluded.name, email = excluded.email, join_url = excluded.join_url, reschedule_url = excluded.reschedule_url, cancel_url = excluded.cancel_url, updated_at = now()`,
      [b.inviteeUri, b.eventUri, b.eventName, b.start, b.end, b.name, b.email, b.joinUrl, b.rescheduleUrl, b.cancelUrl, dealId, leadId]);
    // The deal's next step follows its soonest upcoming call.
    const next = (await c.query("select event_name, start_at from bookings where deal_id = $1 and status = 'active' and start_at > now() - interval '1 hour' order by start_at limit 1", [dealId])).rows[0];
    if (next?.start_at) await c.query("update deals set next_step = $2, next_due = $3, updated_at = now() where id = $1 and status = 'open'", [dealId, String(next.event_name).slice(0, 200), dayIn(new Date(next.start_at), tz)]);
    return { ok: true, deal: dealId as string };
  });
  await saveState({ ...(await getState()), lastEvent: new Date().toISOString() });
  return result;
}

/** Upcoming calls for the Overview, and a deal's calls for its page. */
export const upcomingCalls = (days = 14) => q("select b.*, d.company from bookings b join deals d on d.id = b.deal_id where b.status = 'active' and b.start_at > now() - interval '1 hour' and b.start_at < now() + ($1 || ' days')::interval order by b.start_at limit 20", [days]);
export const dealCalls = (dealId: string) => q('select * from bookings where deal_id = $1 order by start_at desc limit 10', [dealId]);
