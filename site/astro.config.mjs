import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import { loadEnv } from 'vite';

// Replit injects Secrets as real environment variables. Locally, copy .env.example to .env:
// this makes those values visible to server code as process.env (read at runtime, never inlined).
for (const [k, v] of Object.entries(loadEnv(process.env.NODE_ENV || 'development', process.cwd(), ''))) process.env[k] ??= v;

export default defineConfig({
  site: process.env.PUBLIC_SITE_URL || 'https://eichenbergassociates.com',
  output: 'server',                 // content, leads and the dashboard all live in Postgres, so every route renders per request
  adapter: node({ mode: 'standalone' }),
  build: { inlineStylesheets: 'auto' },
  server: { host: true, port: Number(process.env.PORT) || 5000 },
  vite: { server: { allowedHosts: true } },   // Replit serves the dev server on *.replit.dev
});
