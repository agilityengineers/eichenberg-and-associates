// Postgres access. Uses DATABASE_URL (set automatically when you add Replit's PostgreSQL database).
import pg from 'pg';
import { env } from './env';

let pool: pg.Pool | null = null;
export const dbConfigured = () => !!env('DATABASE_URL');

export function db(): pg.Pool {
  if (!pool) {
    const connectionString = env('DATABASE_URL');
    if (!connectionString) throw new Error('DATABASE_URL is not set. Add a PostgreSQL database in Replit (Tools → Database).');
    pool = new pg.Pool({ connectionString, max: 5, idleTimeoutMillis: 30_000 });
    pool.on('error', (e) => console.error('[db] idle client error', e.message));
  }
  return pool;
}

export async function q<T extends pg.QueryResultRow = any>(text: string, params: unknown[] = []): Promise<T[]> {
  const r = await db().query<T>(text, params as any[]);
  return r.rows;
}
export async function one<T extends pg.QueryResultRow = any>(text: string, params: unknown[] = []): Promise<T | null> {
  return (await q<T>(text, params))[0] ?? null;
}
export async function tx<T>(fn: (c: pg.PoolClient) => Promise<T>): Promise<T> {
  const c = await db().connect();
  try { await c.query('begin'); const r = await fn(c); await c.query('commit'); return r; }
  catch (e) { await c.query('rollback'); throw e; }
  finally { c.release(); }
}
