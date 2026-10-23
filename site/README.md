# Eichenberg & Associates — website

Marketing site, five persona landing pages and a private sales dashboard for Eichenberg & Associates, in one Node app. It runs on **Replit**: the Run button for development, an **Autoscale deployment** for production, and **Replit's built-in PostgreSQL** for everything the site stores. Jennifer signs in at **`/login`** with her email and password; the dashboard is where she edits the website copy, the landing pages and the sales pipeline.

## Stack and why

- **Astro 4** with the Node adapter (`output: 'server'`). Pages render on request, so a change saved in the dashboard is live on the next page load. No rebuild, no Git commit.
- **Replit PostgreSQL** (`DATABASE_URL`) holds site content, uploaded images, leads, deals, partners, subscribers, settings and dashboard logins. The schema is `db/schema.sql`; it runs on every boot and is safe to re-run.
- **Email + password sign-in** built into the app: scrypt-hashed passwords, sessions in Postgres, an httpOnly cookie, password reset by email.
- **Resend** for transactional email (contact notifications, acknowledgements, password resets). **Cloudflare Turnstile** for spam protection. **Plausible** for cookieless analytics (optional).

## Project structure

```
.replit                      # (repo root) Run button + Autoscale deployment
site/
├─ astro.config.mjs          # Node adapter, port 5000, loads .env locally
├─ .env.example              # every environment variable (Replit: put them in Secrets)
├─ db/
│  ├─ schema.sql             # all tables; idempotent, runs on boot
│  └─ user.ts                # npm run user:add — create a login / reset a password
├─ public/images/            # logos, hero image, OG image
└─ src/
   ├─ content/               # DEFAULT copy, verbatim from the client documents.
   │                         #   Copied into Postgres on first boot; edited in the dashboard after that.
   ├─ lib/
   │  ├─ bootstrap.ts        # first boot: schema, seed content + landing pages, first admin login
   │  ├─ content.ts          # reads content from Postgres (falls back to src/content defaults)
   │  ├─ cms-schema.ts       # field definitions for every editable page/collection (drives the editor + validation)
   │  ├─ settings.ts         # dashboard settings defaults (stages, targets, tripwires, pick-lists)
   │  ├─ auth.ts, password.ts# sessions, password hashing, reset tokens
   │  ├─ feeds.ts, feed-parse.ts  # RSS/Atom/JSON Feed: fetch + cache, and the parser (post text, date, category, picture)
   │  ├─ db.ts, env.ts, mail.ts, turnstile.ts, ratelimit.ts, sanitize.ts, si.ts, personas.js
   ├─ middleware.ts          # login gate, security headers (CSP/HSTS in production), legacy redirects
   ├─ layouts/               # Base (public), Landing (persona pages), Dashboard
   ├─ components/            # Header, Footer, Cta, ContactForm, FeedList, cms/ (editor fields)
   ├─ pages/                 # public routes, /login, /for/[slug], /dashboard/*, /api/*
   ├─ scripts/               # motion, go-live slider, dashboard + CMS editor behaviour
   └─ styles/global.css      # brand tokens and base styles
```

## Local development

```bash
cd site
npm install
cp .env.example .env        # set DATABASE_URL and ADMIN_EMAIL / ADMIN_PASSWORD at minimum
npm run dev                  # http://localhost:5000
```

Without `RESEND_API_KEY` emails are logged to the console instead of sent (a password-reset link is printed there too). Without `TURNSTILE_SECRET_KEY` the spam check is skipped. Set both in production.

## Running on Replit

The repo root has a `.replit` file, so Replit knows what to do:

- **Run** (workspace): installs packages and starts the dev server on port 5000 with live reload.
- **Deploy → Autoscale**: build `npm ci && npm run build` (type-checks first), run `npm start` (production mode, binds `0.0.0.0:$PORT`).

First-time setup:

1. **Import** the GitHub repo into Replit.
2. **Add the database:** open the *Database* tool and create a PostgreSQL database. Replit adds `DATABASE_URL` to the workspace for you.
3. **Secrets** (padlock icon): add at least `ADMIN_EMAIL`, `ADMIN_PASSWORD` (10+ characters), `ADMIN_NAME`, `PUBLIC_SITE_URL`. Add the Resend, Turnstile, Calendly and newsletter variables when you have them (table below).
4. Press **Run**. On first boot the app creates the tables, copies the default copy into the database, seeds the five landing pages and their questions, and creates the first login from `ADMIN_EMAIL` / `ADMIN_PASSWORD`. Open `/login` and sign in.
5. **Publish:** *Deploy → Autoscale*. Make sure the deployment has the same Secrets. The deployed app uses its **own production database**, so first boot happens again there: it seeds content and creates the admin login from the deployment's `ADMIN_*` secrets.
6. **Custom domain:** *Deployments → Settings → Link a domain*, then add the DNS records Replit shows at the domain registrar. Set `PUBLIC_SITE_URL` to `https://eichenbergassociates.com`.

The workspace preview pane shows the site inside an iframe. Sign-in works there in Chrome; if a browser blocks it, open the dev URL in its own tab.

### Logins

- After the first sign-in, change the password in **Dashboard → Settings → Change your password**. `ADMIN_PASSWORD` is only read when no logins exist, so it can then be removed from Secrets.
- Add or remove other people in **Dashboard → Settings → Who can sign in**.
- **Forgot password** on `/login` emails a one-hour, single-use link (needs Resend). Without Resend the link is printed in the deployment logs.
- From the Replit Shell, `npm run user:add -- email@example.com 'a-long-password' 'Full Name'` creates a login or resets a password **in the workspace database**. For the production database, use the dashboard.

## Configuration

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection. Added automatically by Replit's database tool. |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` | First dashboard login, created on first boot when no logins exist. |
| `PUBLIC_SITE_URL` | Canonical URL, sitemap, Open Graph tags. |
| `PUBLIC_TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile (dash.cloudflare.com → Turnstile). Add the Replit and custom domains to the widget. |
| `RESEND_API_KEY`, `CONTACT_FROM_EMAIL`, `CONTACT_TO_EMAIL` | Email delivery. Verify the sending domain in Resend first. |
| `NEWSLETTER_PROVIDER` | `none`, `buttondown` (+`BUTTONDOWN_API_KEY`) or `resend-audience` (+`RESEND_AUDIENCE_ID`). Subscribers are always stored in the dashboard too. |
| `CALENDLY_URL` | Default booking link for the landing pages, used when they're first seeded. Edit per page in the dashboard after that. |
| `PUBLIC_PLAUSIBLE_DOMAIN` | Set to enable analytics; leave blank to disable. |

All variables are read when the server handles a request, so changing a Secret needs only a restart, not a rebuild.

## Editing content

**Everything a visitor reads is editable at `/dashboard` → *Website content* — no code.** Changes are live as soon as you save.

- **Site-wide:** firm details, navigation and footer, homepage hero (headline, rotating lines, background image, tint), the go-live slider, the "Who can lead it / who can do it" grid, the closing call to action, the Insights feed sources.
- **Pages:** every headline, paragraph, button and list on Home, Services, Who we serve, For SI partners, About, Insights, Contact, the landing-page form labels and the 404 page. Each page is one form, grouped by section in page order. Lists have add, remove and reorder controls.
- **Collections:** Services, Who-we-serve situations, Team, Testimonials, Insights posts, and **Custom pages** (page builder with Hero, Text, Two columns, Bullets, Pull quote, Image and Call to action blocks; appears at `/p/<slug>` and in the sitemap when published).
- **Images:** upload in any image field. Files are stored in the database (Autoscale has no persistent disk) and served from `/media/…`. Keep images ≤ 1600px wide, WebP or JPEG.
- **Pricing:** each service has a price and a *Show price* switch. Prices stay hidden until it's on.
- **Insights feed (RSS):** feed sources (any RSS/Atom URL — for a WordPress blog, the site address followed by `/feed` — or an rss.app .xml/.json URL; the blog at blog.eichenbergassociates.com is set up by default), how many posts the Insights page shows, whether to show each post's picture, and the home-page section. Posts from enabled feeds merge with the site's own Insights posts, newest first; each post's picture comes from the feed (featured image, enclosure or the first image in the post). The *Feed check* at the top of that page shows whether each feed loads and how many posts carry a picture; a feed that stops responding keeps showing its last good copy. Feeds are fetched on the server and cached (default 30 minutes).

Privacy and Terms are code files (`src/pages/privacy.astro`, `terms.astro`) so legal-reviewed wording can't be changed by accident. Ask a developer to update them.

`src/content/` holds the original copy. It is copied into the database once; editing a file there afterwards does not change the live site (the dashboard copy wins). A brand-new page or setting file added there is picked up on the next boot.

## Persona landing pages + sales dashboard

Five unlisted campaign pages at `/for/<slug>` (`operations`, `sponsor-90-days`, `pmo`, `integration`, `si-partners`), each with a 4-step guided form (about you → situation → the "who can lead it / who can do it" grid → outcome + Calendly + lead magnet). Copy and questions are seeded from `src/lib/personas.js` and edited in the dashboard.

Dashboard views: **Overview** (KPIs, measures vs targets, learning questions, tripwires, log BD time), **Lead inbox**, **Pipeline** (five stages, drag-and-drop, 10%-of-fee BD budget, deal detail page), **Form builder**, **Systems Integrator (SI) partners**, **Landing pages** (copy, fee toggle, magnet, Calendly URL, publish), **Subscribers**, **Content calendar**, **Website content**, and **Settings** (stage names and questions, measures and targets, tripwire rules, the KPI "Kept" figure, pick-lists for offers/sources/situations, who can sign in).

Every landing-form submission inserts a lead **and** an Exploration-stage deal, emails Jennifer, and sends the acknowledgement + lead magnet link to the sender. Server validation reads the live question list, so required questions can't be bypassed. Contact-form submissions land in the Lead inbox too.

## Motion

All motion is CSS keyframes plus a small script (`src/scripts/motion.ts`): scroll-reveal via IntersectionObserver, a top progress bar, count-ups. Home has three small interactive pieces in plain TypeScript: the rotating hero line, the "Where is your go-live?" slider (highlights the matching offer), and the "Who can lead it / who can do it" grid. Everything respects `prefers-reduced-motion`.

## Security notes

Server-side validation (zod) and sanitisation on every input; honeypot + Turnstile + per-IP rate limiting on public forms; passwords hashed with scrypt; sessions stored server-side and revocable; dashboard writes refused unless they come from the site's own origin; CSP, HSTS and frame headers in production; no secrets in client code (only `PUBLIC_*` values reach the browser). The rate limiter is in memory per instance; if Autoscale runs several instances and abuse appears, move it to a shared store.

## Accessibility & SEO

Semantic landmarks, skip link, visible focus rings, labelled form fields with inline errors and `aria-live` status, 4.5:1+ text contrast. Per-page titles/descriptions, canonical, Open Graph, `sitemap.xml`, `robots.txt`, and JSON-LD (`ProfessionalService`, `Service`, `Person`, `Article`). Landing pages, `/login` and the dashboard are `noindex`.
