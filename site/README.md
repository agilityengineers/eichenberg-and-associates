# Eichenberg & Associates — website

Marketing site for Eichenberg & Associates. Static pages, two small serverless endpoints (contact form, newsletter), and a git-based CMS so the firm can edit content without touching code.

## Stack and why

- **Astro 4** (static HTML, zero JS by default) — fast, cheap to host, easy for any web developer to maintain.
- **Netlify** (free tier is enough) — hosting, HTTPS, serverless functions for `/api/*`, security headers via `netlify.toml`, Identity for CMS login. Any Node host works with a different Astro adapter.
- **Decap CMS** at `/admin` — edits commit Markdown/JSON to the repo; every change is versioned and triggers a rebuild.
- **Resend** for transactional email (contact notifications + acknowledgement). **Cloudflare Turnstile** for spam protection (free, no CAPTCHA puzzles). **Plausible** for cookieless analytics (optional).

## Project structure

```
site/
├─ astro.config.mjs          # site URL, hybrid output, Netlify adapter, sitemap
├─ netlify.toml              # build, security headers (CSP, HSTS…), legacy redirects
├─ .env.example              # all environment variables
├─ public/
│  ├─ admin/                 # Decap CMS (index.html + config.yml)
│  ├─ images/                # logos, OG image, team photos
│  ├─ favicon.svg, robots.txt
└─ src/
   ├─ content/               # ALL editable content
   │  ├─ settings/site.json  # firm details, nav
   │  ├─ services/*.md       # three offers
   │  ├─ situations/*.json   # "Who we serve" cards
   │  ├─ team/*.md           # bios
   │  ├─ testimonials/*.json
   │  └─ insights/*.md       # blog posts
   ├─ layouts/Base.astro     # <head>, SEO, Open Graph, JSON-LD, header/footer
   ├─ components/            # Header, Footer, Cta, ContactForm
   ├─ lib/                   # ratelimit, sanitize, turnstile
   ├─ pages/                 # one file per route (+ /api/contact, /api/newsletter)
   ├─ pages/for/             # persona landing pages (SSR from Supabase)
   ├─ pages/dashboard/       # sales dashboard (auth-gated)
   └─ supabase/              # schema.sql + seed.ts
   └─ styles/global.css      # brand tokens and base styles
```

## Local development

```bash
cd site
npm install
cp .env.example .env        # fill in what you have; everything is optional locally
npm run dev                  # http://localhost:4321
```

Without `RESEND_API_KEY` the contact endpoint logs submissions to the console instead of emailing. Without `TURNSTILE_SECRET_KEY` the spam check is skipped (dev only — set it in production).

## Configuration

| Variable | Purpose |
|---|---|
| `PUBLIC_SITE_URL` | Canonical URL, sitemap, OG tags |
| `PUBLIC_TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile (dash.cloudflare.com → Turnstile) |
| `RESEND_API_KEY`, `CONTACT_FROM_EMAIL`, `CONTACT_TO_EMAIL` | Email delivery. Verify the sending domain in Resend first. |
| `NEWSLETTER_PROVIDER` | `none`, `buttondown` (+`BUTTONDOWN_API_KEY`) or `resend-audience` (+`RESEND_AUDIENCE_ID`) |
| `PUBLIC_PLAUSIBLE_DOMAIN` | Set to enable analytics; leave blank to disable |

## Deployment (Netlify)

1. Push this folder to a Git repo (GitHub/GitLab). In Netlify: *Add new site → Import from Git*. Base directory `site`, build `npm run build`, publish `dist` (already in `netlify.toml`).
2. Add the environment variables above under *Site configuration → Environment variables*.
3. Point the `eichenbergassociates.com` DNS at Netlify; HTTPS is automatic.
4. **CMS login:** *Site configuration → Identity → Enable*, set registration to *Invite only*, enable *Git Gateway*, then invite Jennifer's email. She logs in at `/admin`.
5. Old WordPress URLs (`/speaking-engagements`, `/resources`, `/book-a-meeting`) redirect in `netlify.toml`; add others as needed.

## Editing content

**Everything a visitor reads is editable at `/admin` — no code.** The CMS sidebar is organised by what the admin wants to do:

- **Website pages (copy)** — every headline, paragraph, button and list on Home, Services, Who we serve, For SI partners, About, Insights, Contact. Each page is one form, grouped by section in page order.
- **Homepage hero** — headline words, subtitle, buttons, background image/video, tint.
- **New pages (page builder)** — create any future page from blocks: Hero, Text (Markdown), Two columns, Bullets, Pull quote, Image, Call to action. Set a slug, tick *Published*, optionally *Show in navigation*. Appears at `/p/<slug>` and in the sitemap.
- **Insights feed (RSS)** — toggle the "Latest insights" home section, and add feed sources: any standard RSS/Atom URL or an rss.app URL (.xml or .json). Posts from all enabled feeds merge with the site's own Insights posts, newest first, on the home page and `/insights`. Feeds are fetched server-side (`src/lib/feeds.ts`, cached) and refreshed live via `/api/feed`, so new blog posts appear without a rebuild.
- **Services / Team / Testimonials / Insights / Who-we-serve situations** — structured lists; add, remove, reorder.
- **Firm details & navigation** — email, phone, LinkedIn, menu items.

Persona landing pages and their forms are edited in the **sales dashboard** (`/dashboard`), because they're backed by the lead database. Privacy and Terms are code files (`src/pages/privacy.astro`, `terms.astro`) so legal-reviewed wording can't be changed accidentally — ask a developer to update them.

- **Through the CMS:** `/admin` → pick a collection → edit → *Publish*. Netlify rebuilds in ~1 minute.
- **Through files:** edit anything in `src/content/`. Front-matter fields are validated by `src/content/config.ts`; the build fails loudly on a typo.
- **Insights:** new post = new `.md` in `src/content/insights`. Set `draft: false` to publish.
- **Homepage hero:** `/admin` → *Site settings → Homepage hero*. Change the headline words, subtitle, buttons, and upload a background image (or paste an MP4 URL for video). The *tint* slider keeps text readable over busy photos — keep it ≥ 0.6 for AA contrast.
- **Pricing:** each service has `price` and `showPrice`. Prices stay hidden until `showPrice: true`.
- **Images:** drop into `public/images`; reference as `/images/...`. Keep hero/team images ≤ 1600px wide, WebP or JPEG.

## Persona landing pages + sales dashboard

Five unlisted campaign pages at `/for/<slug>` (`operations`, `sponsor-90-days`, `pmo`, `integration`, `si-partners`), each with a 4-step guided form (about you → situation → the “who can lead it / who can do it” grid → outcome + Calendly + lead magnet). Copy and questions live in **Supabase**, edited from the dashboard at `/dashboard` (magic-link sign-in, allow-listed emails only).

Setup:
1. Create a free Supabase project. SQL editor → paste `supabase/schema.sql` → run. Then run `alter database postgres set app.admin_emails = 'jennifer@eichenbergassociates.com';`.
2. Auth → Providers → Email: enable, turn **off** sign-ups (the allowlist does the rest). Auth → URL configuration: add `https://eichenbergassociates.com/api/auth/callback`.
3. Fill the `PUBLIC_SUPABASE_*`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_EMAILS`, `CALENDLY_URL` variables, then `npm run seed` to load the five pages and their default questions from `src/lib/personas.js`.
4. Dashboard views: Overview (measures vs 2027 targets, tripwires), Lead inbox, Pipeline (five stages, 10%-of-fee BD budget), Form builder, SI partners (15 → 5 → 2–3), Landing pages (copy, fee toggle, magnet, Calendly URL, publish), Subscribers, Content calendar.
5. Every landing-form submission inserts a lead **and** an Exploration-stage deal, emails Jennifer, and sends the acknowledgement + lead magnet link to the sender. Server validation reads the live question list, so required questions can’t be bypassed.

Data model and RLS are in `supabase/schema.sql`. Public pages read only published rows with the anon key; writes from the site use the service-role key server-side; the dashboard uses the signed-in session under RLS.

## Motion

All motion is CSS keyframes plus a 30-line script (`src/scripts/motion.ts`): scroll-reveal via IntersectionObserver, a top progress bar, count-ups. Home has three small interactive pieces written in plain TypeScript inside `index.astro`: the rotating hero line, the “Where is your go-live?” slider (highlights the matching offer), and the “Who can lead it / who can do it” grid. Everything respects `prefers-reduced-motion`.

## Security notes

Server-side validation (zod) and sanitisation on every field; honeypot + Turnstile; per-IP rate limiting (5 per 10 min, per function instance — swap `src/lib/ratelimit.ts` for Upstash if you need a global limit); strict CSP/HSTS/frame headers; no secrets in client code (only `PUBLIC_*` vars reach the browser).

## Accessibility & SEO

Semantic landmarks, skip link, visible focus rings, labelled form fields with inline errors and `aria-live` status, 4.5:1+ text contrast. Per-page titles/descriptions, canonical, Open Graph, `sitemap-index.xml`, `robots.txt`, and JSON-LD (`ProfessionalService`, `Service`, `Person`, `Article`).
