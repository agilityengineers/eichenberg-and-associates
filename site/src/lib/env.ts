// Server-side configuration, read at request time from process.env (Replit Secrets in production, .env locally —
// astro.config.mjs copies .env into process.env). Never use import.meta.env for secrets: Vite would inline the
// build-time value, and Replit gives the deployment a different DATABASE_URL than the workspace.
export const env = (key: string, fallback = ''): string => (process.env[key] ?? '').trim() || fallback;
export const isProd = () => process.env.NODE_ENV === 'production';
export const siteUrl = () => env('PUBLIC_SITE_URL', 'https://eichenbergassociates.com').replace(/\/$/, '');
