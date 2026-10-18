// Seeds landing_pages + form_questions from the shared persona content. Run: npx tsx supabase/seed.ts
import { createClient } from '@supabase/supabase-js';
import { PERSONAS, BASE_QUESTIONS } from '../src/lib/personas.js';
const sb = createClient(process.env.PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
for (const p of PERSONAS) {
  await sb.from('landing_pages').upsert({ slug: p.slug, persona: p.internal, eyebrow: p.eyebrow, frame: p.frame, headline: p.headline, situation: p.situation, awareness: p.awareness, goals: p.goals, pains: p.pains, messages: p.messages, offer: p.offer, cta: p.cta, magnet_title: p.magnet, booking_url: process.env.CALENDLY_URL || null });
  const rows = [...BASE_QUESTIONS.map((q, i) => ({ ...q, step: 1, position: i })), ...p.questions.map((q, i) => ({ ...q, step: 2, position: i }))];
  for (const q of rows) await sb.from('form_questions').upsert({ page_slug: p.slug, step: q.step, position: q.position, key: q.id, label: q.label, type: q.type, options: (q as any).options ?? null, required: !!q.required, locked: !!(q as any).locked }, { onConflict: 'page_slug,key' });
}
console.log('seeded', PERSONAS.length, 'pages');
