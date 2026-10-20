// Dashboard settings: one JSON document in the `settings` table, edited at Dashboard → Settings.
import { dbConfigured, one, q } from './db';
import { withDefaults } from './content';

export const DEFAULT_SETTINGS = {
  stages: [
    { name: 'Exploration', question: 'What are the reasons to talk?' },
    { name: 'Discovery', question: 'What are the needs?' },
    { name: 'Scoping', question: 'What could we do together?' },
    { name: 'Preparation', question: 'What else do you need before we start?' },
    { name: 'Continuation', question: 'What comes next for us?' },
  ],
  signedFromStage: 4,               // 1-based: deals at this stage or later count as signed (4 = Preparation)
  kept: { value: 380000, label: 'Kept, 2027 plan' },
  bridge: { income: 0, revenue: 0 },
  bdTargetText: 'target 20–25 between engagements',
  measures: [
    { key: 'exploration', label: 'Exploration conversations', target: '12–18 a quarter', targetNum: 12 },
    { key: 'partners', label: 'Active Systems Integrator (SI) partners', target: '1 by Q1, 2–3 by Q2', targetNum: 2 },
    { key: 'assess_to_anchor', label: 'Assessments that become anchors', target: '1 of the first 3', targetNum: 1 },
    { key: 'role_readiness', label: 'Role Readiness sales, attached', target: '2 in 2027', targetNum: 2 },
    { key: 'subscribers', label: 'Newsletter subscribers in profile', target: '150 by year end', targetNum: 150 },
  ],
  learningQuestions: ['Do assessments lead to anchors?', 'Does Role Readiness sell when it’s attached?', 'Where is the mid-market anchor price ceiling?', 'What does the toolkit actually save in hours?', 'Which channels produce wins?'],
  tripwires: [
    { rule: 'Business development under 8 hours a week for a month', metric: 'bd_hours', threshold: 8, status: '', level: 'clear' },
    { rule: 'Bridge income above a third of the year’s revenue', metric: 'bridge_share', threshold: 33, status: '', level: 'clear' },
    { rule: 'Six months on one engagement with no move to fixed fee', metric: 'manual', threshold: 6, status: '', level: 'clear' },
  ],
  partnerTargets: { contacts: 15, meetings: 5, active: 3, activeLabel: '2–3', note: 'Target: 15 contacts → 5 meetings → 2–3 active partners by mid-2027. Click a status to advance it.' },
  lists: {
    offers: ['Readiness Assessment', 'Anchor', 'Anchor + Role Readiness', 'Role Readiness', 'Subcontract anchor', 'White-label assessment'],
    sources: ['Partner', 'Signal', 'Content'],
    platforms: ['NetSuite', 'Dynamics', 'Epicor', 'Workday'],
    situations: [
      { value: 'funded', label: 'Program funded, Systems Integrator (SI) selected, go-live 6–12 months out' },
      { value: '90days', label: 'Go-live within 90 days and cracks are showing' },
      { value: 'portfolio', label: 'Several go-lives at once' },
      { value: 'merger', label: 'Deal closed; integration lead named' },
      { value: 'partner', label: "I'm an SI partner with a won deal" },
      { value: 'other', label: 'Something else' },
    ],
  },
};
export type Settings = typeof DEFAULT_SETTINGS;

let cached: { at: number; s: Settings } | null = null;
export async function getSettings(): Promise<Settings> {
  if (!dbConfigured()) return DEFAULT_SETTINGS;
  if (cached && Date.now() - cached.at < 10_000) return cached.s;
  const row = await one<{ data: any }>("select data from settings where key = 'dashboard'");
  const s = withDefaults(DEFAULT_SETTINGS, row?.data || {}) as Settings;
  cached = { at: Date.now(), s }; return s;
}
export async function saveSettings(data: Settings) {
  await q("insert into settings (key, data, updated_at) values ('dashboard', $1, now()) on conflict (key) do update set data = excluded.data, updated_at = now()", [JSON.stringify(data)]);
  cached = null;
}
