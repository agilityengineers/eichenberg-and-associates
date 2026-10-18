# Handoff: Eichenberg & Associates website + sales dashboard

## Overview
Full revamp of eichenbergassociates.com: public marketing site, five unlisted persona landing pages with a guided 4-step lead form, an admin CMS for all site content, and a sales dashboard (lead inbox, 5-stage pipeline with drag-and-drop, form builder, SI partner tracker, measures vs 2027 targets, subscribers, content calendar). Positioning, copy, personas, offers, pricing and sales process come from two internal documents (Growth Strategy 2027 and Ideal Client Profile decks) plus a brand-voice PDF; **copy is to be kept verbatim** — do not rewrite it.

## What's in this bundle
```
design_handoff_eichenberg_site/
├─ README.md                 ← this file
├─ CLAUDE.md                 ← instructions for Claude Code (copy to repo root)
├─ design-references/        ← HTML prototypes (look + behaviour). Reference only — do not ship.
│  ├─ Eichenberg Website.dc.html      public site, all pages (hash-routed)
│  ├─ Persona Landing Pages.dc.html   5 landing pages + guided form
│  ├─ Admin Dashboard.dc.html         sales dashboard, 8 views, sample data
│  ├─ personas.js                     persona content (verbatim from ICP deck)
│  └─ assets/                         logos, hero image, mark halves
└─ site/                     ← the production codebase. THIS is what goes to GitHub.
```

## About the design files
Files under `design-references/` are **design references created in HTML** — interactive prototypes showing intended look and behaviour. They are not production code. The production implementation already exists in `site/` (Astro). Where the prototype and `site/` differ, treat the **prototype as the visual source of truth** and `site/` as the code to bring up to that standard.

## Fidelity
**High-fidelity.** Colours, type, spacing, motion and copy are final. Recreate pixel-accurately.

## Stack (already chosen and implemented in `site/`)
- **Astro 4** (hybrid: static pages + serverless `/api/*`), TypeScript, no UI framework.
- **Netlify** hosting + functions; `netlify.toml` carries CSP/HSTS headers and legacy redirects.
- **Decap CMS** at `/admin` (git-based; Netlify Identity + Git Gateway) for all public content.
- **Supabase** (Postgres + Auth + RLS) for leads, deals, partners, form builder, landing-page copy; magic-link login with email allow-list for `/dashboard`.
- **Resend** (email), **Cloudflare Turnstile** (spam), **Plausible** (analytics, optional), **fast-xml-parser** (RSS).
See `site/README.md` for setup, env vars, deployment and content editing.

## Packaging for GitHub
1. Move `CLAUDE.md` into `site/` (repo root), then `cd site && git init && git add -A && git commit -m "Eichenberg & Associates site v1"`.
2. Create an empty **private** repo on GitHub; `git remote add origin <url> && git branch -M main && git push -u origin main`.
3. `npm install` runs `scripts/fix-routes.mjs`, which renames `-slug-.astro` / `-table-.ts` placeholders to Astro's `[slug].astro` / `[table].ts` (the export tool couldn't write square brackets). After the first install, commit the renamed files and delete the script + `postinstall` hook.
4. Connect the repo to Netlify (base dir `site`), add env vars from `.env.example`, enable Identity + Git Gateway, run `supabase/schema.sql`, then `npm run seed`.
5. `.gitignore` already excludes `node_modules`, `dist`, `.env*`. Never commit `.env`.

## Known gaps / first tasks for Claude Code
1. **Build has never been run** — code was authored without a Node toolchain. Expect small type/syntax fixes on first `npm run build`. Fix in place; don't restructure.
2. **Dashboard settings are hardcoded** (stage names/questions, 2027 targets, tripwire rules, KPI "Kept $380K", pick-lists, nav). Add a `settings` JSON row in Supabase + a *Dashboard → Settings* view so the admin can edit them without a deploy.
3. Placeholders to replace (search `PLACEHOLDER`): portrait + full bio, lead-magnet titles/PDFs, Calendly URL, blog + rss.app feed URLs, "what we cover / what you cover" chart, OG image, privacy/terms legal review.
4. Dashboard forms use JSON textareas for list fields (goals, pains, messages, options). Replace with repeatable row editors.
5. Rate limiter is per function instance; swap `src/lib/ratelimit.ts` for Upstash if abuse appears.

## Screens / views

### Public site (`Eichenberg Website.dc.html` ↔ `site/src/pages/*`)
Routes: `/`, `/services`, `/services/{project-role-readiness|ocm-leadership|readiness-assessment}`, `/who-we-serve`, `/partners`, `/about`, `/insights`, `/insights/[slug]`, `/contact`, `/privacy`, `/terms`, `/p/[slug]` (CMS page builder), `/404`.

**Header** — sticky, `rgba(246,245,240,.92)` + `backdrop-filter: blur(10px)`, 1px bottom border `rgba(18,15,56,.1)`. Logo lockup: colour mark (≈56px tall — 70% larger than the original 33px) + "EICHENBERG" (Albert Sans 600, 14px, tracking .22em) / "& ASSOCIATES" (500, 8.5px, tracking .3em, indigo). Logo hover: **vertical bob** (translateY ±4px, ~.6s ease-in-out) — not a tilt. Nav links 14px/500, 8×12 padding, radius 6, hover bg `rgba(52,60,151,.08)`, active = 2px teal bottom border. CTA "Start a conversation" navy pill, hover indigo. Mobile ≤860px: burger → stacked menu.

**Home hero** — navy `#120F38`, full-bleed background image (`assets/hero-bg.jpg`, admin-replaceable) under gradient tint `linear-gradient(100deg, rgba(18,15,56,.62) 0%, rgba(18,15,56,.47) 55%, rgba(18,15,56,.35) 100%)` (tint admin-adjustable 0–1). Two logo-mark halves drift in from left/right at 5%/10% opacity (2.4s cubic-bezier(.2,.7,.2,1)). Eyebrow teal 12px/600 tracking .28em uppercase. H1 **Poppins 600**, `clamp(44px,6.4vw,88px)`, line-height 1.04, tracking −.02em: "**Change** is inevitable, / **Success** isn't." with *Change* and *Success* in teal `#14B6A1`, rest white; lines animate in (wordIn: translateY(.4em) rotate(2deg) → 0, .8s, delays .1s/.35s). Subtitle white 17–20px: "Eichenberg & Associates provide a seamless approach that leads your company through the successful adoption of change." Rotating italic Newsreader line (18–22px, 85% white) cycles buyer messages every ~4s with fade. Buttons: teal filled (hover white, translateY(−2px)) "Start Building Your Success Today"; ghost outlined "See the three offers"; both `white-space: nowrap`. Right column (≥700px): floating "Go-live readiness" dashboard card (floatY 7s loop), positioned so its teal footer card sits at the subject's waistline (wrapper padding `0 6% 34px`, teal card absolute bottom 0); card typography full-contrast navy on white; status chips in brand teal/indigo (not generic green). Proof strip below: 4 items, 14px, on `rgba(18,15,56,.55)` + blur(6px).

**Sections in order:** The gap (2-col, serif H2 `clamp(34px,4.4vw,56px)`) → What we offer (3 cards; each "Learn more →" links to its **own** service page) → Who this is for (dl of 4 facts) → How an engagement runs (indigo `#343C97` band, 3 phases Prepare/Act/Sustain) → **Latest insights** (RSS, admin-toggleable, 3 cards) → Testimonials (3, teal left rule) → For Systems Integrator (SI) partners → The first call: "Who can lead it? Who can do it?" 2×2 grid (buttons `minmax(0,1fr)`, selected = teal) → Footer (navy; logo, 3 nav columns, contact, © + Privacy + Terms).

**Copy rules:** second person / organisational voice ("we", never "I"). First mention of SI per page is "Systems Integrator (SI)"; later mentions use `<abbr title="Systems Integrator">SI</abbr>` with dotted underline. "Eichenberg" exact spelling everywhere.

**Services / Who we serve / Partners / About / Insights / Contact** — see prototype; all headline/lead/list copy lives in `site/src/content/pages/*.json` and must stay CMS-driven. Contact form: name*, work email*, company, role, "Where are you?" select*, message, honeypot, Turnstile; inline errors `#B3261E`; success state replaces the form.

### Persona landing pages (`Persona Landing Pages.dc.html` ↔ `site/src/pages/for/[slug].astro`)
Unlisted, `noindex`, SSR from Supabase `landing_pages` + `form_questions`. Slugs: `operations`, `sponsor-90-days`, `pmo`, `integration`, `si-partners`. Hero (same image/tint as home), eyebrow "{audience} · {frame}", Poppins H1 = persona headline, "Sound familiar?" + situation, lead message in a teal-ruled quote, CTA. Then goals (✓ teal dots) / pains (indigo dash), the engagement (offer + fee range, admin toggle), key-message cards, and the **4-step form**: 1 About you (fixed: name, email, company, title) → 2 Your situation (admin-editable questions: text/textarea/email/number/date/select/radio) → 3 the grid (2×2, required) → 4 outcome: "Continue to Discovery." for 3 quadrants, "Stay in touch, ask for a referral." for can-lead+can-do; then Calendly inline embed (URL from DB) and lead-magnet confirmation. Progress bar gradient indigo→teal. Form card: white, radius 12, shadow `0 30px 60px rgba(18,15,56,.08)`. Submit → `POST /api/lead` → inserts lead + Exploration-stage deal, emails admin + sender.

### Sales dashboard (`Admin Dashboard.dc.html` ↔ `site/src/pages/dashboard/*`)
Sidebar 232px navy; active item `rgba(255,255,255,.1)` bg + 3px teal left bar. Main on paper `#F6F5F0`, panels white radius 12, border `rgba(18,15,56,.1)`. Views: **Overview** (KPI tiles, measures vs targets with progress bars, five learning questions on indigo, tripwires), **Lead inbox** (table, page filter pills, "Add to pipeline"), **Pipeline** (5 columns Exploration/Discovery/Scoping/Preparation/Continuation with guiding question; cards show offer, fee, go-live, source, partner, grid, BD hours vs 10%-of-fee budget, next step; **drag-and-drop between columns** plus ←/Advance buttons; column highlights teal on drag-over; dragged card opacity .45), **Form builder** (per page: reorder ▲▼, label, type, required, options, remove, add; steps 1 & 3 locked), **SI partners** (funnel 15→5→2–3, table, click status to cycle), **Landing pages** (copy editor, fee toggle, magnet, Calendly, publish), **Subscribers**, **Content calendar** (month → post → LinkedIn cut dots → newsletter), link out to **Website content** (`/admin`).

## Interactions & motion
- Entrance: `rise` (translateY 14–18px → 0, .7s ease-out, staggered .1–.85s); `wordIn` for hero headline.
- Hover lifts: cards translateY(−4px) + `0 20px 36px rgba(18,15,56,.1)`, .35s cubic-bezier(.2,.7,.2,1). Buttons translateY(−2px).
- Logo bob vertical; hero dashboard floatY 7s; mark halves drift once.
- `prefers-reduced-motion`: all animations off.
- Focus: 3px teal outline, offset 2px. Skip link. All forms labelled, errors inline + `aria-live`.

## Design tokens
Colours: navy `#120F38` (ink / dark bg), indigo `#343C97`, teal `#14B6A1`, paper `#F6F5F0`, muted text `#4A4868`, faint `#8A889C`, line `rgba(18,15,56,.1)`, error `#B3261E`, teal-dark text `#0E7C6E`.
Type: **Newsreader** (display/serif; 300 display, 400 H2/H3), **Albert Sans** (UI/body 400–700), **Poppins 600** (hero + landing H1 only). Scale: display `clamp(44px,7vw,96px)`, H2 `clamp(34px,4.4vw,56px)`, H3 32px, lead 19px/1.55, body 16–17px, label 12px/600 tracking .2em uppercase, note 13px.
Spacing: container 1240px, side padding 24px, section padding `clamp(72px,9vw,120px)`, grid gap 48px, card padding 28–36px.
Radii: buttons/inputs 6px, cards 10–12px, pills 99px.
Contrast: ≥4.5:1 body text everywhere; hero tint ≥.6 recommended over photos.

## Assets
`design-references/assets/`: `logo-color.png`, `logo-white.png`, `logo-navy.png` (lockups), `mark-color/white/teal.png`, `mark-half-left-white.png`, `mark-half-right-teal.png`, `hero-bg.jpg` (Magnific-generated, 1920w, admin-replaceable), `hero-a/b/c.png` alternates. Same files under `site/public/images/`.
