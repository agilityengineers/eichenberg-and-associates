// Dashboard settings: one JSON document in the `settings` table, edited at Dashboard → Settings.
import { dbConfigured, one, q } from './db';
import { withDefaults } from './content';

export const DEFAULT_SETTINGS = {
  // The sales process. Each stage is one column on the Pipeline board and one section of a deal page. Everything here is
  // edited at Dashboard → Settings: stages can be added, removed and reordered, and a stage with gate checks holds deals
  // until the checks are ticked. `id`s are stable keys; saved answers hang off them, so renaming never loses data.
  stages: [
    { id: 'exploration', name: 'Exploration', question: 'Is there a reason to talk?', callLength: '15-min call', countsAsSigned: false,
      note: 'Before the call: check fit (5 minutes). Minutes 12–15: run the gate and close. Being vetted? Answer in under a minute, then ask.',
      open: '',
      moves: [
        { title: 'Context', when: 'Min 0–4', blocks: [{ label: 'Ask', text: 'You mentioned [their form answer]. What prompted you to reach out now?\nWhat made you think I could help?' }, { label: 'Listen for', text: 'The trigger, in their words.' }] },
        { title: 'Cost and clock', when: 'Min 4–8', blocks: [{ label: 'Ask', text: 'What’s the date that matters most, and who’s accountable for it?\nIf people aren’t ready on day one, what happens, and who notices first?' }, { label: 'Listen for', text: 'A date, a name, and a cost they can picture.' }] },
        { title: 'Observe, then ask', when: 'Min 8–12', blocks: [{ label: 'Say, then ask', text: 'One observation they haven’t read on your site.\nWhich matters most to you?\nWhat does success look like for you a year out?' }, { label: 'Listen for', text: 'What they care about personally.' }] },
      ],
      close: 'Close every call with one line: “Based on what you’ve told me, I’d suggest [offer from the routing slide]. Can we take an hour to scope it? Who else should join?” Asked about price? Give the range.',
      capture: [
        { id: 'trigger', label: 'What prompted them to reach out', type: 'text', onCard: false },
        { id: 'dateowner', label: 'Who’s accountable for the date', type: 'text', onCard: false },
        { id: 'matters', label: 'What matters most to them', type: 'text', onCard: false },
      ],
      gate: {
        label: 'Gate', intro: 'Fit first, then Pain · Person · Pressure', pass: 'All four? Book the longer call before you hang up.',
        checks: [
          { id: 'fit', label: 'Fit', description: 'Checked before the call: $100M–$1B revenue · 250+ people affected · a fixed date and a seven-figure program · a sponsor you can reach · no large firm already running change.' },
          { id: 'pain', label: 'Pain', description: 'A problem they admit, with a cost.' },
          { id: 'person', label: 'Person', description: 'Who signs, and who champions. Often two people.' },
          { id: 'pressure', label: 'Pressure', description: 'A fixed date that matters: go-live, Day 1 or go/no-go.' },
        ],
        outcomes: [
          { have: 'Not a fit', do: 'Say so plainly, and refer them if you can.' },
          { have: 'Fit, pain, person and pressure', do: 'Book the longer call now. Ask who else should join.' },
          { have: 'A champion, but the signer isn’t on the call', do: 'Book the longer call with the sponsor invited. Never go around the sponsor.' },
          { have: 'Person and pressure, pain not admitted', do: 'Offer one observation to test it. If it lands, book the call.' },
          { have: 'Pain and person, no pressure', do: 'Ask what would make it urgent. Follow up near their date.' },
          { have: 'None of the three', do: 'Thank them and close politely.' },
        ],
      } },
    { id: 'discovery', name: 'Discovery', question: 'What are the needs, and whose?', callLength: '60-min call', countsAsSigned: false, note: '',
      open: 'Open with a recap: You told me [the trigger], [the date and who’s accountable] and [what matters most]. Did I get that right? What’s changed?',
      moves: [
        { title: 'Issue framing', when: '', blocks: [{ label: 'Ask', text: 'What do you think is causing [the problem they named]?\nHow long has it been going on, and what have you tried?' }, { label: 'Listen for', text: 'The root cause and the full cost.' }] },
        { title: 'People framing', when: '', blocks: [{ label: 'Ask', text: 'Who else feels this, and who needs to be part of solving this?\nWhat does success look like for you?' }, { label: 'Listen for', text: 'The sponsor, and what each person needs to win.' }] },
        { title: 'Needs framing', when: '', blocks: [{ label: 'Ask', text: 'What has to be true for this to work?' }, { label: 'Listen for', text: 'Requirements you can design to.' }] },
      ],
      close: 'Close: Let’s schedule time to agree on scope. Who should join?',
      capture: [
        { id: 'cause', label: 'The root cause and the full cost', type: 'text', onCard: false },
        { id: 'needs', label: 'What has to be true for this to work', type: 'text', onCard: false },
      ],
      gate: { label: 'Gate', intro: '', pass: '', checks: [], outcomes: [] } },
    { id: 'scoping', name: 'Scoping', question: 'What could we do together?', callLength: '60-min call', countsAsSigned: false, note: '', open: '',
      moves: [
        { title: 'Results', when: '', blocks: [{ label: 'Name both', text: 'Business results: the pain resolved, in numbers. Personal wins: what the sponsor gets.' }, { label: 'Ask', text: 'How will you know this worked? How will you be measured?' }] },
        { title: 'Process', when: '', blocks: [{ label: 'Do', text: 'Confirm the routed offer, and shape the work to who can lead and who can do it.' }, { label: 'Ask', text: 'Who on your team will carry this after we finish?' }] },
        { title: 'Terms', when: '', blocks: [{ label: 'Do', text: 'Price from the offer’s range, scaled to the stakes. Build associate work into OCM Leadership.' }, { label: 'Say', text: 'Repeat the cost they told you, then name the price.' }] },
      ],
      close: 'No document yet: agree on scope and price out loud. Close: I’ll bring the full proposal to our next meeting. Who needs to be there to approve it?',
      capture: [
        { id: 'results', label: 'Business results', type: 'text', onCard: false },
        { id: 'wins', label: 'Personal wins for the sponsor', type: 'text', onCard: false },
      ],
      gate: { label: 'Gate', intro: '', pass: '', checks: [], outcomes: [] } },
    { id: 'commitment', name: 'Commitment', question: 'What else do you need before we start?', callLength: '60-min call', countsAsSigned: false, note: '',
      open: 'Open: present the proposal live, with the approver in the room.',
      moves: [
        { title: 'Information', when: '', blocks: [{ label: 'Ask', text: 'What can slow this down?' }, { label: 'Listen for', text: 'Hidden objections and missing voices.' }] },
        { title: 'Decision process', when: '', blocks: [{ label: 'Ask', text: 'Who signs, how, and by when?\nDoes everyone who signs or approves see it the way you do?' }, { label: 'Listen for', text: 'Whether the decision-maker shares your champion’s motivation.' }] },
        { title: 'Logistics', when: '', blocks: [{ label: 'Do', text: 'Agree on dates, access and the first working session.' }, { label: 'Listen for', text: 'Real commitment, not polite interest.' }] },
      ],
      close: 'Close with a decision date, then send the proposal PDF the same day. Write sponsor access and go/no-go criteria into the agreement. Procurement involved? Mention your WBENC certification.',
      capture: [
        { id: 'signs', label: 'Who signs, how, and by when', type: 'text', onCard: false },
        { id: 'decision', label: 'Decision date', type: 'date', onCard: true },
        { id: 'sent', label: 'Proposal sent', type: 'date', onCard: false },
      ],
      gate: { label: 'Gate', intro: '', pass: '', checks: [], outcomes: [] } },
    { id: 'onboarding', name: 'Onboarding & account growth', question: 'What comes next for us?', callLength: '', countsAsSigned: true, note: '', open: '', moves: [], close: '', capture: [],
      gate: { label: 'Gate', intro: '', pass: '', checks: [], outcomes: [] } },
  ],
  // After the gate: which offer each form situation points to (shown on the deal page as a reference).
  routing: {
    heading: 'Match their situation to the offer',
    rows: [
      { situation: 'Program funded, SI selected, go-live 6–12 months out', offer: 'OCM Leadership, plus Project Role Readiness at kickoff', aim: 'A phased proposal' },
      { situation: 'Go-live within 90 days, cracks showing', offer: 'Readiness Assessment, 3–4 weeks', aim: 'The assessment; it can lead to gap closure' },
      { situation: 'Several go-lives at once', offer: 'Readiness Assessment as a pilot, then one standard', aim: 'One program first' },
      { situation: 'Deal closed, integration lead named', offer: 'OCM Leadership, phased to Day 1 and Day 100', aim: 'A proposal fast; the timeline is tight' },
      { situation: 'SI partner', offer: 'Partner track, outside this process', aim: 'Your partners page' },
    ],
    note: 'Shape the work by who can lead and who can do it: no one for either, people but no leader, a leader but no capacity, or both in-house (light touch or not a fit).',
  },
  offerRanges: [
    { offer: 'OCM Leadership', range: '$100–150K phased, with associate build work inside it' },
    { offer: 'Readiness Assessment', range: '$15–20K' },
    { offer: 'Project Role Readiness', range: '$15–20K per license' },
  ],
  // Ways a deal leaves the board. The codes are fixed; the labels are editable.
  closeReasons: [
    { value: 'not_fit', label: 'Not a fit' },
    { value: 'referred', label: 'Referred out' },
    { value: 'later', label: 'Follow up later' },
    { value: 'lost', label: 'Lost' },
  ],
  stakeholderMap: {
    heading: 'Map every stakeholder, not just your contact', note: 'The person who feels the pain most is often not the person who will push for the fix.',
    who: 'Stakeholder', feels: 'Feels the pain?', role: 'Signs or champions?', drives: 'What drives them', needs: 'What they need to see',
  },
  // What each card on the Pipeline board shows.
  cardFields: { contact: true, offer: true, source: true, goLive: true, partner: true, leadDo: true, hours: true, nextStep: true, gate: true },
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
    offers: ['OCM Leadership', 'Readiness Assessment', 'Project Role Readiness'],
    sources: ['Partner', 'Signal', 'Content', 'Contact form'],
    platforms: ['NetSuite', 'Dynamics', 'Epicor', 'Workday'],
    situations: [
      { value: 'funded', label: 'Program funded, SI selected, go-live 6–12 months out' },
      { value: '90days', label: 'Go-live within 90 days and cracks are showing' },
      { value: 'portfolio', label: 'Several go-lives at once' },
      { value: 'merger', label: 'Deal closed; integration lead named' },
      { value: 'partner', label: "I'm an SI partner" },
      { value: 'other', label: 'Something else' },
    ],
  },
};
export type Settings = typeof DEFAULT_SETTINGS;
export type Stage = Settings['stages'][number];
export const OLD_OFFERS = ['Readiness Assessment', 'Anchor', 'Anchor + Role Readiness', 'Role Readiness', 'Subcontract anchor', 'White-label assessment'];
export const EMPTY_GATE = { label: 'Gate', intro: '', pass: '', checks: [] as Stage['gate']['checks'], outcomes: [] as Stage['gate']['outcomes'] };
export const newId = () => Math.random().toString(36).slice(2, 10).padEnd(8, '0');

/** Fills in anything a stored stage is missing, so pages can rely on the full shape. */
export const normStage = (st: any): Stage => ({
  id: st?.id || newId(), name: st?.name || 'Stage', question: st?.question || '', callLength: st?.callLength || '', countsAsSigned: !!st?.countsAsSigned,
  note: st?.note || '', open: st?.open || '', close: st?.close || '',
  moves: (Array.isArray(st?.moves) ? st.moves : []).map((m: any) => ({ title: m?.title || '', when: m?.when || '', blocks: (Array.isArray(m?.blocks) ? m.blocks : []).map((b: any) => ({ label: b?.label || '', text: b?.text || '' })) })),
  capture: (Array.isArray(st?.capture) ? st.capture : []).map((c: any) => ({ id: c?.id || newId(), label: c?.label || '', type: c?.type === 'date' ? 'date' : 'text', onCard: !!c?.onCard })),
  gate: { ...EMPTY_GATE, ...(st?.gate || {}), checks: (Array.isArray(st?.gate?.checks) ? st.gate.checks : []).map((c: any) => ({ id: c?.id || newId(), label: c?.label || '', description: c?.description || '' })), outcomes: (Array.isArray(st?.gate?.outcomes) ? st.gate.outcomes : []).map((o: any) => ({ have: o?.have || '', do: o?.do || '' })) },
});
/** Gate progress for one deal at one stage. */
export const gateState = (st: Stage | undefined, gate: Record<string, boolean> | null | undefined) => {
  const checks = st?.gate?.checks || []; const done = checks.filter((c) => gate?.[c.id]).length;
  return { total: checks.length, done, passed: checks.length > 0 && done === checks.length, open: checks.length > 0 && done < checks.length };
};

let cached: { at: number; s: Settings } | null = null;
export async function getSettings(): Promise<Settings> {
  if (!dbConfigured()) return DEFAULT_SETTINGS;
  if (cached && Date.now() - cached.at < 10_000) return cached.s;
  const row = await one<{ data: any }>("select data from settings where key = 'dashboard'");
  const s = withDefaults(DEFAULT_SETTINGS, row?.data || {}) as Settings;
  s.stages = (Array.isArray(s.stages) && s.stages.length ? s.stages : DEFAULT_SETTINGS.stages).map(normStage);
  cached = { at: Date.now(), s }; return s;
}
export const clearSettingsCache = () => { cached = null; };
export async function saveSettings(data: Settings) {
  await q("insert into settings (key, data, updated_at) values ('dashboard', $1, now()) on conflict (key) do update set data = excluded.data, updated_at = now()", [JSON.stringify(data)]);
  cached = null;
}
