# CLAUDE.md — Eichenberg & Associates site

You are continuing a finished design/implementation handoff. Read `README.md` in this folder first, then `site/README.md`.

## Ground rules
- The codebase is `site/` (Astro 4 + Netlify + Decap CMS + Supabase). Do not switch frameworks or restructure folders.
- `design-references/*.dc.html` are the visual source of truth. Match them; don't redesign.
- **Copy is verbatim from client documents.** Never rewrite, shorten or "improve" marketing copy. Second-person/"we" voice. "Eichenberg" spelling. First "SI" per page = "Systems Integrator (SI)", later = `<abbr title="Systems Integrator">SI</abbr>`.
- Every visitor-facing string must remain CMS-editable (`src/content/**` + `public/admin/config.yml`). If you add a string, add its CMS field.
- Brand tokens only: #120F38 #343C97 #14B6A1 #F6F5F0 #4A4868 #8A889C; Newsreader / Albert Sans / Poppins (hero only).
- Keep accessibility: labels, focus rings, 4.5:1 contrast, reduced-motion.

## First tasks, in order
1. `cd site && npm install && npm run build` — fix any type/syntax errors (code has not been compiled before). Commit the `[slug].astro` / `[table].ts` renames and remove `scripts/fix-routes.mjs` + the postinstall hook.
2. Run locally with `.env` from `.env.example`; verify every route in the README renders, forms validate, `/admin` loads, `/dashboard` redirects to `/login`.
3. Add **Dashboard → Settings** (Supabase `settings` JSON row + UI): pipeline stage names/questions, measures & targets, tripwire rules, KPI "Kept" figure, pick-lists (offers, sources, situations), admin email allow-list display.
4. Replace JSON-textarea list editors in `/dashboard/pages` and `/dashboard/forms` with repeatable row editors.
5. Grep `PLACEHOLDER` and surface the list to the user; don't invent content.

## Conventions
- Styling: global tokens in `src/styles/global.css`; component-scoped `<style>` otherwise. No Tailwind.
- Server writes go through the service-role client in `src/lib/supabase.ts`; browser never sees the service key.
- Validate every API input with zod; keep honeypot + Turnstile + rate limit on public POSTs.
