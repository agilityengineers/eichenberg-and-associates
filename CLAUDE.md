# CLAUDE.md — Eichenberg & Associates site

You are continuing a finished design/implementation handoff. Read `README.md` in this folder first, then `site/README.md`.

## Ground rules
- The codebase is `site/` (Astro 4 + Node adapter, hosted on **Replit**: Autoscale deployment + Replit's built-in PostgreSQL). Do not switch frameworks or restructure folders. Everything must run on Replit: bind `0.0.0.0` and `PORT` (5000), read config from `process.env` at request time (Replit Secrets), no writes to local disk (store files in Postgres).
- `design-references/*.dc.html` are the visual source of truth. Match them; don't redesign.
- **Copy is verbatim from client documents.** Never rewrite, shorten or "improve" marketing copy. Second-person/"we" voice. "Eichenberg" spelling. First "SI" per page = "Systems Integrator (SI)", later = `<abbr title="Systems Integrator">SI</abbr>`.
- Every visitor-facing string must remain CMS-editable (defaults in `src/content/**`, fields in `src/lib/cms-schema.ts`, edited at Dashboard → Website content). If you add a string, add its CMS field.
- Brand tokens only: #120F38 #343C97 #14B6A1 #F6F5F0 #4A4868 #8A889C; Newsreader / Albert Sans / Poppins (hero only).
- Keep accessibility: labels, focus rings, 4.5:1 contrast, reduced-motion.

## Status
The first tasks (build fixes, route renames, Dashboard → Settings, repeatable row editors, PLACEHOLDER list) are done. Remaining content gaps are the `PLACEHOLDER` items; don't invent content for them.

## Conventions
- Styling: global tokens in `src/styles/global.css`; component-scoped `<style>` otherwise. No Tailwind.
- Server writes go through `src/lib/db.ts` (Postgres via `DATABASE_URL`); the browser never talks to the database. Dashboard pages and `/api/admin/*` are gated by the session check in `src/middleware.ts`.
- Validate every API input with zod; keep honeypot + Turnstile + rate limit on public POSTs.
