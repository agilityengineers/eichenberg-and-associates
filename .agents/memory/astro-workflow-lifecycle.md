---
name: Astro workflow lifecycle
description: Why the Replit-managed Astro dev command must avoid automatic backgrounding.
---

Astro 7 detects agent environments and may automatically background its dev server, even without an explicit background flag.

**Why:** The workflow then exits as finished, and the proxied preview can return 502 despite a startup message claiming the server is ready.

**How to apply:** Keep the dev server in the foreground under the managed workflow. Astro's documented `--ignore-lock` flag opts out of agent-inferred backgrounding. If changing the dev command, verify that the workflow remains running and that a request through the Replit development domain succeeds.
