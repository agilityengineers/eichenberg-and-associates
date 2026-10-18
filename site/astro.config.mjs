import { defineConfig } from 'astro/config';
import netlify from '@astrojs/netlify';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: process.env.PUBLIC_SITE_URL || 'https://eichenbergassociates.com',
  output: 'hybrid',            // pages are static; /api/* run as serverless functions
  adapter: netlify(),
  integrations: [sitemap({ filter: (p) => !p.includes('/admin') })],
  build: { inlineStylesheets: 'auto' },
});
