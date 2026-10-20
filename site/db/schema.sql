-- Eichenberg & Associates — Postgres schema (Replit built-in database or any Postgres 13+).
-- Idempotent: the app runs this on boot, and `npm run db:setup` runs it by hand.

-- Accounts for /login. Every user is an administrator of the dashboard and the website content.
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  name text not null default '',
  password_hash text not null,
  created_at timestamptz not null default now(),
  last_login_at timestamptz
);
create unique index if not exists users_email_key on users (lower(email));

create table if not exists sessions (
  id text primary key,                         -- sha256 of the cookie token; the token itself is never stored
  user_id uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index if not exists sessions_user_idx on sessions (user_id);

create table if not exists password_resets (
  id text primary key,                         -- sha256 of the emailed token
  user_id uuid not null references users(id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz
);

-- Website copy. One row per page/settings file or collection entry (services, situations, team, testimonials, insights, custom pages).
create table if not exists content (
  collection text not null,
  slug text not null,
  data jsonb not null default '{}',
  body text not null default '',               -- Markdown body (service detail, bio, insight post)
  updated_at timestamptz not null default now(),
  primary key (collection, slug)
);

-- Uploaded files (hero image, portrait, lead-magnet PDFs). Stored in the database because Replit deployments have no persistent disk.
create table if not exists media (
  id uuid primary key default gen_random_uuid(),
  filename text not null,
  mime text not null,
  size int not null,
  bytes bytea not null,
  created_at timestamptz not null default now()
);

-- Dashboard settings (stages, measures, tripwires, pick-lists…): one JSON document.
create table if not exists settings (
  key text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists landing_pages (
  slug text primary key,                       -- operations | sponsor-90-days | pmo | integration | si-partners
  persona text not null,                       -- internal name — never rendered publicly
  eyebrow text not null, frame text not null, headline text not null, situation text not null,
  awareness text, goals jsonb not null default '[]', pains jsonb not null default '[]',
  messages jsonb not null default '[]',        -- [{label,text}]
  offer jsonb not null default '{}',           -- {name,detail,price}
  show_price boolean not null default true,
  cta text not null default 'Start a conversation',
  magnet_title text, magnet_url text,
  booking_url text,
  published boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists form_questions (
  id uuid primary key default gen_random_uuid(),
  page_slug text not null references landing_pages(slug) on delete cascade,
  step smallint not null default 2,            -- 1 = about you (fixed), 2 = situation (editable)
  position int not null default 0,
  key text not null,
  label text not null,
  type text not null check (type in ('text','textarea','email','number','date','select','radio')),
  options jsonb,
  required boolean not null default false,
  locked boolean not null default false,
  unique (page_slug, key)
);

create table if not exists partners (
  id uuid primary key default gen_random_uuid(),
  firm text not null, platform text, contact text, email text,
  status smallint not null default 0,          -- 0 contacted, 1 meeting, 2 active
  last_touch date, next_step text, notes text,
  created_at timestamptz not null default now()
);

create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  page_slug text,                              -- landing page slug; null for the contact form
  name text not null, email text not null, company text, title text,
  answers jsonb not null default '{}',
  grid text check (grid in ('nn','nd','ln','ld')),
  grid_result text,
  source text not null default 'landing',      -- landing | contact
  ip_hash text, user_agent text,
  deal_id uuid
);

create table if not exists deals (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  company text not null, contact text, lead_id uuid references leads(id) on delete set null,
  stage smallint not null default 0 check (stage between 0 and 4),   -- index into Settings → pipeline stages
  offer text, fee_estimate numeric, go_live text, source text,
  partner_id uuid references partners(id) on delete set null, grid text,
  next_step text, next_due date,
  bd_hours numeric not null default 0,
  notes text, updated_at timestamptz not null default now()
);
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'leads_deal_fk') then
    alter table leads add constraint leads_deal_fk foreign key (deal_id) references deals(id) on delete set null;
  end if;
end $$;

create table if not exists activities (            -- business-development time log (feeds the BD-hours KPI and tripwire)
  id uuid primary key default gen_random_uuid(),
  at timestamptz not null default now(),
  deal_id uuid references deals(id) on delete set null, partner_id uuid references partners(id) on delete set null,
  kind text not null default 'bd', hours numeric not null default 0, note text
);

create table if not exists subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null, created_at timestamptz not null default now(),
  source text, in_profile text not null default 'unknown'   -- in | out | unknown | partner
);
create unique index if not exists subscribers_email_key on subscribers (lower(email));

create table if not exists content_items (
  id uuid primary key default gen_random_uuid(),
  month date not null, title text not null, status smallint not null default 0,   -- 0 drafting, 1 published, 2 cut & scheduled
  cuts int not null default 6, cuts_done int not null default 0, newsletter text, url text
);
