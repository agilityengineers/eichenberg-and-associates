/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />
import type { SupabaseClient, User } from '@supabase/supabase-js';

declare global {
  namespace App {
    /** Set by src/middleware.ts for /dashboard/* and /api/admin/* only (allow-listed admin, RLS session client). */
    interface Locals { sb: SupabaseClient; user: User }
  }
}
export {};
