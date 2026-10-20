// Create a dashboard login, or reset an existing one's password, from the Replit Shell:
//   npm run user:add -- jennifer@eichenbergassociates.com 'a-long-password' 'Jennifer Eichenberg'
import { readFileSync } from 'node:fs';
import pg from 'pg';
import { hashPassword, passwordOk, PASSWORD_RULE } from '../src/lib/password';

try { (process as any).loadEnvFile?.('.env'); } catch {}
const [email, password, name = ''] = process.argv.slice(2);
if (!email || !password) { console.error("Usage: npm run user:add -- <email> '<password>' ['Full name']"); process.exit(1); }
if (!passwordOk(password)) { console.error('Password rule: ' + PASSWORD_RULE); process.exit(1); }
if (!process.env.DATABASE_URL) { console.error('DATABASE_URL is not set. Add a PostgreSQL database in Replit first.'); process.exit(1); }
const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
await c.query(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'));
const hash = await hashPassword(password);
const r = await c.query('update users set password_hash = $2, name = coalesce(nullif($3, \'\'), name) where lower(email) = lower($1) returning id', [email, hash, name]);
if (r.rowCount) console.log('Password updated for', email);
else { await c.query('insert into users (email, name, password_hash) values (lower($1), $2, $3)', [email, name, hash]); console.log('Created login for', email); }
await c.query('delete from sessions where user_id in (select id from users where lower(email) = lower($1))', [email]);
await c.end();
