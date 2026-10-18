// Renames "-slug-.astro"/"-table-.ts" placeholders to Astro's "[param]" dynamic routes.
// (The export tool that produced this package can't write square brackets in filenames.)
import { renameSync, existsSync } from 'node:fs';
for (const [from, to] of [['src/pages/services/-slug-.astro', 'src/pages/services/[slug].astro'], ['src/pages/insights/-slug-.astro', 'src/pages/insights/[slug].astro'], ['src/pages/for/-slug-.astro', 'src/pages/for/[slug].astro'], ['src/pages/api/admin/-table-.ts', 'src/pages/api/admin/[table].ts'], ['src/pages/p/-slug-.astro', 'src/pages/p/[slug].astro']])
  if (existsSync(from)) { renameSync(from, to); console.log('renamed', from, '→', to); }
