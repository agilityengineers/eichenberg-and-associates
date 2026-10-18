-- Eichenberg & Associates — sales data model. Run in Supabase SQL editor (or supabase db push).
create extension if not exists pgcrypto;

create table landing_pages (
  slug text primary key,                       -- operations | sponsor-90-days | pmo | integration | si-partners
  persona text not null,                       -- internal name (Thomas…) — never rendered publicly
  eyebrow text not null, frame text not null, headline text not null, situation text not null,
  awareness text, goals jsonb not null default '[]', pains jsonb not null default '[]',
  messages jsonb not null default '[]',        -- [{label,text}]
  offer jsonb not null default '{}',           -- {name,detail,price}
  show_price boolean not null default true,
  cta text not null default 'Start a conversation',
  magnet_title text, magnet_url text,          -- lead magnet PDF (Supabase Storage URL)
  booking_url text,                            -- Calendly event URL
  published boolean not null default true,
  updated_at timestamptz not null default now()
);

create table form_questions (
  id uuid primary key default gen_random_uuid(),
  page_slug text not null references landing_pages(slug) on delete cascade,
  step smallint not null default 2,            -- 1 = about you (fixed), 2 = situation (editable)
  position int not null default 0,
  key text not null,                           -- stable answer key, e.g. golive
  label text not null,
  type text not null check (type in ('text','textarea','email','number','date','select','radio')),
  options jsonb,                               -- for select/radio
  required boolean not null default false,
  locked boolean not null default false,       -- name/email cannot be removed
  unique (page_slug, key)
);

create table leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  page_slug text references landing_pages(slug),
  name text not null, email text not null, company text, title text,
  answers jsonb not null default '{}',         -- {key: value} for step-2 questions
  grid text check (grid in ('nn','nd','ln','ld')),
  grid_result text,
  source text default 'landing',               -- landing | contact | partner-session
  ip_hash text, user_agent text,
  deal_id uuid
);

create type deal_stage as enum ('Exploration','Discovery','Scoping','Preparation','Continuation');
create table deals (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  company text not null, contact text, lead_id uuid references leads(id),
  stage deal_stage not null default 'Exploration',
  offer text,                                  -- Assessment | Anchor | Role Readiness | Subcontract | White-label
  fee_estimate numeric,                        -- proposed fee; BD budget = 10%
  go_live date, source text,                   -- Partner | Signal | Content
  partner_id uuid, grid text,
  next_step text, next_due date,
  bd_hours numeric not null default 0,
  notes text, updated_at timestamptz not null default now()
);
alter table leads add constraint leads_deal_fk foreign key (deal_id) references deals(id);

create table partners (
  id uuid primary key default gen_random_uuid(),
  firm text not null, platform text, contact text, email text,
  status smallint not null default 0,          -- 0 contacted, 1 meeting, 2 active
  last_touch date, next_step text, notes text
);
alter table deals add constraint deals_partner_fk foreign key (partner_id) references partners(id);

create table activities (                        -- BD time log, feeds the 10% rule and tripwires
  id uuid primary key default gen_random_uuid(),
  at timestamptz not null default now(), deal_id uuid references deals(id), partner_id uuid references partners(id),
  kind text, hours numeric not null default 0, note text
);

create table subscribers (
  id uuid primary key default gen_random_uuid(),
  email text unique not null, created_at timestamptz not null default now(),
  source text, in_profile text default 'unknown'   -- in | out | unknown | partner
);

create table content_items (
  id uuid primary key default gen_random_uuid(),
  month date not null, title text not null, status smallint not null default 0,   -- 0 drafting, 1 published, 2 cut & scheduled
  cuts int not null default 6, cuts_done int not null default 0, newsletter text, url text
);

create table measures (                          -- targets from the 2027 strategy; actuals computed in the dashboard
  key text primary key, label text not null, target text not null, target_num numeric
);
insert into measures values
 ('exploration','Exploration conversations','12–18 a quarter',12),
 ('partners','Active SI partners','1 by Q1, 2–3 by Q2',2),
 ('assess_to_anchor','Assessments that become anchors','1 of the first 3',1),
 ('role_readiness','Role Readiness sales, attached','2 in 2027',2),
 ('subscribers','Newsletter subscribers in profile','150 by year end',150);

-- Row level security: public can read published pages + their questions; everything else is admin only.
alter table landing_pages enable row level security;
alter table form_questions enable row level security;
alter table leads enable row level security; alter table deals enable row level security; alter table partners enable row level security;
alter table activities enable row level security; alter table subscribers enable row level security; alter table content_items enable row level security; alter table measures enable row level security;

create policy "public read published pages" on landing_pages for select using (published);
create policy "public read questions of published pages" on form_questions for select
  using (exists (select 1 from landing_pages p where p.slug = page_slug and p.published));

-- Admin = any authenticated user whose email is in the allowlist (single-admin firm).
create or replace function is_admin() returns boolean language sql stable as $$
  select coalesce(auth.jwt() ->> 'email', '') = any (string_to_array(current_setting('app.admin_emails', true), ','));
$$;
do $$ declare t text; begin
  foreach t in array array['landing_pages','form_questions','leads','deals','partners','activities','subscribers','content_items','measures'] loop
    execute format('create policy "admin all" on %I for all to authenticated using (is_admin()) with check (is_admin())', t);
  end loop; end $$;
-- Set the allowlist once:  alter database postgres set app.admin_emails = 'jennifer@eichenbergassociates.com';
-- Inserts from the public site (leads, subscribers) go through the server with the service-role key, never the browser.
