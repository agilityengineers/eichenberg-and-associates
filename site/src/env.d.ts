/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />
declare global {
  namespace App {
    /** Set by src/middleware.ts: the signed-in dashboard user on /dashboard/*, /api/admin/* and /login, otherwise null. */
    interface Locals { user: { id: string; email: string; name: string } | null }
  }
}
export {};
