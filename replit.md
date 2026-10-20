# Eichenberg & Associates

## Run on Replit

- Click **Run**. The `Start application` workflow runs `cd site && npm ci --include=dev --no-audit --no-fund && npm run dev`.
- The Astro server listens on `0.0.0.0:5000` and accepts Replit's proxied preview host.
- Node.js 24.13+ and Astro 7 are used. The imported Astro 4 dependency was blocked by the package security policy, so the user approved upgrading Astro and Node.
- Keep the existing `site/` structure, design references, CMS-driven content, and verbatim marketing copy. See `CLAUDE.md` for project conventions.

## Database and sign-in

- The application uses Replit's managed PostgreSQL through the runtime-provided `DATABASE_URL`. Do not commit connection strings or `.env` files.
- In development, the existing bootstrap initializes the schema, default site content, and five landing pages on the first request.
- Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` (at least 10 characters) in **Secrets** to create the first dashboard account. `ADMIN_NAME` is optional.
- Restart Run after setting those values, then open `/login`. Admin bootstrap only creates an account when the database has no users.
- `/dashboard` and `/api/admin/*` require the existing email/password session. Do not replace or bypass authentication.

## Checks

- `cd site && npm run build` runs Astro's type check and production build.
- The public home, services, about, contact, login, and operations landing page have been checked over the proxied preview URL.
- Without sign-in, dashboard navigation redirects to login and the admin API returns 401.

## Optional services and publishing

- Email delivery is not configured. The app logs messages in development when `RESEND_API_KEY` is missing.
- Cloudflare Turnstile is not configured; the app skips its spam check without `TURNSTILE_SECRET_KEY`.
- Configure and verify Resend, Turnstile, sender addresses, and the intended public URL before launching publicly. Booking and newsletter settings are documented in `site/.env.example`.
- The existing Autoscale build is `cd site && npm ci --include=dev --no-audit --no-fund && npm run build`; the run command is `cd site && npm start`.
- Publishing is a separate user action. Replit's Publish flow manages production schema changes; do not add production migration scripts or new startup-time DDL.

## Astro compatibility

- `astro dev --ignore-lock` stays in the foreground so Replit can manage its lifecycle. Without that flag, Astro 7 auto-backgrounds in agent environments.
- `compressHTML: true` preserves the imported inline whitespace behavior.
- The legacy collection compatibility flag preserves the existing content configuration and directory layout; a future Content Layer migration should not change the database-backed CMS behavior.
